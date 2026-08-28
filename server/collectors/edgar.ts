import { getJSON, getText } from './http.ts';

/**
 * SEC EDGAR full-text search — how many filings name a technology, per month.
 *
 * Companies describe commitments to investors before they staff them, so this
 * should sit upstream of job postings. Keyless, documented, history to 2001.
 * SEC requires a descriptive User-Agent and asks for <10 req/s.
 */

const UA = { 'user-agent': 'Cresco skill-demand research patricia.kusch@gmail.com' };

/**
 * Hand-checked query per skill. Coverage is deliberately partial.
 *
 * Bare terms are dangerous here in a way that would quietly fabricate a series:
 * `Terraform` returns thousands of hits that are oil and real-estate entities
 * (TFC Thornton Oil LLC) and bond funds, not HashiCorp; `dbt` hits the result cap
 * on unrelated text; `DuckDB` returns zero all-time. Where no query is both
 * specific and non-trivial, the skill gets no EDGAR series rather than a bad one.
 */
export const EDGAR_QUERIES: Record<string, string> = {
  'ai-agents': 'AI agents',
  'llm-apps': 'large language model',
  'rag': 'retrieval-augmented generation',
  'mcp': 'Model Context Protocol',
  'ai-safety': 'AI governance',
  'kubernetes': 'Kubernetes',
  'post-quantum': 'post-quantum cryptography',
  'zero-trust': 'zero trust',
  'supply-chain-sec': 'software supply chain',
  'wasm': 'WebAssembly',
  'streaming': 'Apache Kafka',
  'iceberg': 'Apache Iceberg',
  'edge': 'edge computing',
  'finetuning': 'fine-tuning',
};

let gate: Promise<void> = Promise.resolve();
function throttled<T>(fn: () => Promise<T>, gapMs = 220): Promise<T> {
  const run = gate.then(fn);
  gate = run.then(() => new Promise((r) => setTimeout(r, gapMs)), () => new Promise((r) => setTimeout(r, gapMs)));
  return run;
}

/** Filings mentioning `phrase` between two dates. Null on failure — never zero. */
export async function edgarCount(phrase: string, start: string, end: string): Promise<number | null> {
  const url =
    `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${phrase}"`)}` +
    `&startdt=${start}&enddt=${end}`;
  for (let i = 0; i < 3; i++) {
    if (i) await new Promise((r) => setTimeout(r, 1000 * i));
    const j = await throttled(() => getJSON<any>(url, { timeoutMs: 30_000, headers: UA }));
    const v = j?.hits?.total?.value;
    if (typeof v === 'number') return v;
  }
  return null;
}

/** Total filings in a quarter, the denominator for share-normalisation. */
export async function quarterTotal(year: number, quarter: number): Promise<number | null> {
  const idx = await throttled(() =>
    getText(`https://www.sec.gov/Archives/edgar/full-index/${year}/QTR${quarter}/form.idx`, {
      timeoutMs: 60_000,
      headers: UA,
    }),
  );
  if (!idx) return null;
  // The header block ends with a dashed rule; every line after it is one filing.
  const lines = idx.split('\n');
  const start = lines.findIndex((l) => /^-{10,}/.test(l));
  return start >= 0 ? lines.length - start - 1 : null;
}

/**
 * EDGAR does NOT error on a malformed or missing date range — it silently returns
 * the ALL-TIME count. A first run of this collector returned an identical number
 * for every month and looked like perfectly plausible flat data. Any series whose
 * values never change is therefore treated as a failure, not as a finding.
 */
export function assertVaries(skillId: string, series: Record<string, number>): void {
  const vals = Object.values(series);
  if (vals.length < 3) return;
  const unique = new Set(vals);
  if (unique.size === 1) {
    throw new Error(
      `EDGAR series for "${skillId}" is constant at ${vals[0]} across ${vals.length} months — ` +
        `that is the all-time-count failure, not a flat trend. Check the date parameters.`,
    );
  }
}
