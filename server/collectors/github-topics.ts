/**
 * GitHub repositories by topic × creation month.
 *
 * Creating a repository is a human act in a way a download is not, and the
 * `topic:mcp` series inflects in exactly the month MCP launched — a natural
 * experiment for calibrating lead time. Keyless at 10 requests a minute, 30 with
 * a token in GITHUB_TOKEN. History is effectively unlimited; ours is bounded by
 * the hiring ledger, as always.
 *
 * Two traps from docs/RESEARCH.md apply here, and one is this API's own:
 *
 *   - Secular platform inflation. Repo creation rises for everything (`php`
 *     +71% over two years), so a raw count is mostly platform drift. Every
 *     series is a share of all repos created that month — the same rule as job
 *     posts and EDGAR filings, for the same reason.
 *   - Non-stationary history. The same query returns a different number later,
 *     as repos are deleted and topics applied retroactively. The output file is a
 *     snapshot and records when it was taken. A re-run is a new snapshot, not a
 *     reproduction, and should not be expected to match.
 *   - A timed-out search answers with `incomplete_results: true` and a total
 *     that is an undercount, often 0. That is not a zero. It is refused and
 *     retried, and never written.
 */

/**
 * Hand-checked topic per skill. Topics are exact tags, so the substring trap that
 * turned `RAG` into 464 FOSDEM hits does not apply; the residual risk is a tag that
 * means something else, which is why the short ambiguous ones are avoided:
 * `go` → `golang`, `edge` → `edge-computing`, `spark` → `apache-spark`,
 * `streaming` → `kafka`. Coverage is partial on purpose: a skill with no tag that
 * is both specific and in use gets no series rather than a bad one.
 */
export const GITHUB_TOPICS: Record<string, string> = {
  'ai-agents': 'ai-agents',
  'llm-apps': 'llm',
  rag: 'rag',
  mcp: 'mcp',
  evals: 'llm-evaluation',
  finetuning: 'fine-tuning',
  'ai-safety': 'ai-safety',
  rust: 'rust',
  go: 'golang',
  typescript: 'typescript',
  python: 'python',
  kubernetes: 'kubernetes',
  terraform: 'terraform',
  'platform-eng': 'platform-engineering',
  wasm: 'webassembly',
  ebpf: 'ebpf',
  duckdb: 'duckdb',
  iceberg: 'apache-iceberg',
  dbt: 'dbt',
  streaming: 'kafka',
  'supply-chain-sec': 'sbom',
  'post-quantum': 'post-quantum-cryptography',
  'zero-trust': 'zero-trust',
  rsc: 'react-server-components',
  edge: 'edge-computing',
  'llm-serving': 'llm-inference',
  cuda: 'cuda',
  mlops: 'mlops',
  'computer-vision': 'computer-vision',
  embeddings: 'embeddings',
  java: 'java',
  csharp: 'csharp',
  cpp: 'cpp',
  kotlin: 'kotlin',
  swift: 'swift',
  scala: 'scala',
  ruby: 'ruby',
  php: 'php',
  elixir: 'elixir',
  aws: 'aws',
  azure: 'azure',
  gcp: 'gcp',
  docker: 'docker',
  gitops: 'gitops',
  observability: 'observability',
  sre: 'sre',
  'service-mesh': 'service-mesh',
  spark: 'apache-spark',
  snowflake: 'snowflake',
  clickhouse: 'clickhouse',
  postgres: 'postgresql',
  airflow: 'airflow',
  elasticsearch: 'elasticsearch',
  redis: 'redis',
  react: 'react',
  vue: 'vue',
  graphql: 'graphql',
  accessibility: 'accessibility',
  ios: 'ios',
  android: 'android',
  'cross-platform-mobile': 'react-native',
  'cloud-security': 'cloud-security',
  appsec: 'application-security',
  'detection-eng': 'detection-engineering',
};

/** What the search endpoint gives back, reduced to what the collector needs. */
export interface SearchAnswer {
  status: number;
  body: { total_count?: unknown; incomplete_results?: unknown } | null;
}

/**
 * The count a search answer actually supports. Null — never zero — when the
 * request failed, was rate-limited, or came back marked incomplete: an incomplete
 * search reports whatever it had counted when it gave up, which is an undercount
 * that would read as a real dip in the series.
 */
export function parseSearch(answer: SearchAnswer): number | null {
  if (answer.status !== 200 || !answer.body) return null;
  if (answer.body.incomplete_results === true) return null;
  const v = answer.body.total_count;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Share per 10,000 repos created in the same month, rounded to two decimals. */
export function shareOf(raw: Record<string, number>, totals: Record<string, number>): Record<string, number> {
  const share: Record<string, number> = {};
  for (const [m, v] of Object.entries(raw)) {
    const total = totals[m];
    if (!total) continue;
    share[m] = Math.round((v / total) * 10_000 * 100) / 100;
  }
  return share;
}

/**
 * A series that never changes is a failure, not a flat trend. EDGAR taught this
 * lesson by returning the all-time count for a malformed date; a search API can
 * do the same by ignoring a qualifier it does not parse.
 */
export function assertVaries(skillId: string, series: Record<string, number>): void {
  const vals = Object.values(series);
  if (vals.length < 3) return;
  if (new Set(vals).size === 1) {
    throw new Error(
      `GitHub series for "${skillId}" is constant at ${vals[0]} across ${vals.length} months — ` +
        `a qualifier was probably ignored. Check the query.`,
    );
  }
}

/** Fewer months with any repos than this and the series is noise, not a signal. */
export const MIN_NONZERO_MONTHS = 6;

const API = 'https://api.github.com/search/repositories';

/**
 * The search limit is 30 requests a minute per token. GITHUB_TOKEN gives one;
 * GITHUB_TOKENS (comma-separated) gives several, used round-robin, each behind
 * its own gate — so two tokens collect twice as fast without either one being
 * pushed past its limit.
 */
const TOKENS: string[] = (process.env.GITHUB_TOKENS ?? process.env.GITHUB_TOKEN ?? '')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);

function headers(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'Cresco skill-demand research (github.com/patkusch/cresco)',
  };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

/** One sequential gate per token (or one keyless gate at the slower rate). */
const gates: Promise<void>[] = (TOKENS.length ? TOKENS : ['']).map(() => Promise.resolve());
let next = 0;
function throttled<T>(fn: (token?: string) => Promise<T>): Promise<T> {
  const i = next++ % gates.length;
  const token = TOKENS[i] || undefined;
  const gapMs = token ? 2_050 : 6_100;
  const run = gates[i].then(() => fn(token));
  // The gap runs from the moment the request is sent, not from when it answers:
  // the limit is requests per minute, and waiting out the latency as well would
  // halve the rate for nothing.
  const gap = gates[i].then(() => new Promise<void>((r) => setTimeout(r, gapMs)));
  gates[i] = Promise.all([run.catch(() => undefined), gap]).then(() => undefined);
  return run;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function search(q: string, token?: string): Promise<SearchAnswer & { resetAt?: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(`${API}?q=${encodeURIComponent(q)}&per_page=1`, { signal: ctrl.signal, headers: headers(token) });
    const reset = Number(res.headers.get('x-ratelimit-reset'));
    const remaining = Number(res.headers.get('x-ratelimit-remaining'));
    let body: SearchAnswer['body'] = null;
    try {
      body = (await res.json()) as SearchAnswer['body'];
    } catch {
      body = null;
    }
    // Out of budget: the reset header says exactly how long to wait.
    const resetAt = (res.status === 403 || res.status === 429 || remaining === 0) && reset ? reset * 1000 : undefined;
    return { status: res.status, body, resetAt };
  } catch {
    return { status: 0, body: null };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Repositories created between two dates, optionally carrying a topic. Null on
 * failure after retries — never zero. `topic` null gives the month's denominator.
 */
export async function repoCount(topic: string | null, start: string, end: string): Promise<number | null> {
  const q = `${topic ? `topic:${topic} ` : ''}created:${start}..${end}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await sleep(3_000 * attempt);
    const answer = await throttled((token) => search(q, token));
    const n = parseSearch(answer);
    if (n !== null) return n;
    // Say why, so a slow run can be read from its log rather than guessed at.
    const why = answer.body?.incomplete_results === true ? 'incomplete' : `http ${answer.status}`;
    const wait = answer.resetAt ? Math.max(0, answer.resetAt - Date.now()) + 1_000 : 0;
    console.error(`  retry ${attempt + 1}/5 (${why}${wait ? `, reset in ${Math.round(wait / 1000)}s` : ''}): ${q}`);
    if (wait) await sleep(wait);
  }
  return null;
}
