/**
 * Tech conference occurrences × topic × month.
 *
 * A conference programme is a public bet on what practitioners want to hear about
 * this year, fixed months before the event by an organiser reading proposals. That
 * puts it upstream of hiring in the same way a job advert is upstream of a start
 * date — a mechanism worth testing, the last one on the candidate list.
 *
 * Data source: `tech-conferences/conference-data`, the open dataset behind
 * confs.tech (github.com/tech-conferences/conference-data, MIT-licensed,
 * community-maintained). It is organised as one JSON file per topic category per
 * calendar year — `conferences/2024/rust.json`, `conferences/2024/python.json`,
 * and so on — each entry a real, named, dated conference with a `startDate`.
 *
 * This is a coarser signal than a conference's own session list would give: it
 * counts *conferences*, not individual talks, so a 3-day event with 80 sessions
 * counts once. Docs/RESEARCH.md's original plan was per-session counts from
 * sched.com / FOSDEM `.ics` feeds for a handful of named events. That is truer to
 * "talk counts" but only covers a few franchises; this dataset trades session-level
 * granularity for breadth — hundreds of recurring conferences, curated by topic,
 * with no key and no per-request rate limit, which is what makes 64 skills × 7
 * years of real coverage possible in one run. Both are real signals; this is the
 * one that was actually collectible in the time available.
 *
 * Two things this collector must get right, both lessons already paid for by
 * earlier collectors in this project:
 *
 *   - Share, never raw count. A raw conference count mostly measures how many
 *     conferences confs.tech's volunteers happened to log that month — busier
 *     months (spring and autumn conference season) would make every topic look
 *     "hot" together. Every series here is a share of every conference the source
 *     recorded that month, the same rule as job posts, EDGAR filings and GitHub
 *     repos, for the same reason.
 *   - A topic's category file is only created for a year once the curators split
 *     it out — `sre.json` first appears in 2023, `accessibility.json` in 2022.
 *     A skill reading zero before its category exists in the source is the
 *     source's own coverage starting, not proven zero conference activity that
 *     year; the write-up says so rather than presenting it as a real trend.
 */

import { getJSON, mapLimit } from './http.ts';

/**
 * Hand-checked category per skill, the same discipline as GITHUB_TOPICS: a skill
 * gets a category only when the mapping is unambiguous. `security` conflates
 * appsec, cloud-security, detection-eng, zero-trust and supply-chain-sec, so none
 * of those get one; `devops` and `data` are similarly too broad to stand for any
 * one of cresco's more specific skills. Coverage is 17 of 64 skills — partial on
 * purpose, the same trade-off GITHUB_TOPICS made.
 */
export const CONFERENCE_CATEGORIES: Record<string, string> = {
  rust: 'rust',
  go: 'golang',
  typescript: 'typescript',
  python: 'python',
  java: 'java',
  csharp: 'dotnet',
  cpp: 'cpp',
  kotlin: 'kotlin',
  scala: 'scala',
  ruby: 'ruby',
  php: 'php',
  elixir: 'elixir',
  graphql: 'graphql',
  accessibility: 'accessibility',
  ios: 'ios',
  android: 'android',
  sre: 'sre',
};

export interface ConferenceEntry {
  name?: unknown;
  startDate?: unknown;
}

const REPO = 'tech-conferences/conference-data';
const RAW = `https://raw.githubusercontent.com/${REPO}/main/conferences`;
const API = `https://api.github.com/repos/${REPO}/contents/conferences`;
const UA = { 'user-agent': 'Cresco skill-demand research (github.com/patkusch/cresco) patricia.kusch@gmail.com' };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetries<T>(fn: () => Promise<T | null>, label: string, tries = 4): Promise<T | null> {
  for (let i = 0; i < tries; i++) {
    if (i) await sleep(1_500 * i);
    const v = await fn();
    if (v !== null) return v;
    if (i < tries - 1) console.error(`  retry ${i + 1}/${tries - 1}: ${label}`);
  }
  return null;
}

/**
 * The category filenames the source repo actually has for a year — ground truth,
 * not a guessed union, so a genuinely-absent category is never confused with a
 * transient fetch failure. Null only after retries are exhausted.
 */
export async function categoriesForYear(year: number): Promise<string[] | null> {
  return withRetries(async () => {
    const body = await getJSON<{ name: string; type: string }[]>(`${API}/${year}`, { timeoutMs: 20_000, headers: UA });
    if (!Array.isArray(body)) return null;
    return body.filter((e) => e && e.type === 'file' && e.name.endsWith('.json')).map((e) => e.name);
  }, `category listing for ${year}`);
}

/**
 * One category's conferences for one year. Called only for a (year, category)
 * pair `categoriesForYear` already confirmed exists, so a null here is a real
 * fetch failure worth retrying — never an absent file read as empty.
 */
export async function fetchCategoryYear(file: string, year: number): Promise<ConferenceEntry[] | null> {
  return withRetries(async () => {
    const data = await getJSON<unknown>(`${RAW}/${year}/${file}`, { timeoutMs: 20_000, headers: UA });
    return Array.isArray(data) ? (data as ConferenceEntry[]) : null;
  }, `${year}/${file}`);
}

/** Bucket entries by the month of their startDate, keeping only months in range. */
export function bucketByMonth(entries: ConferenceEntry[], firstMonth: string, lastMonth: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    const sd = typeof e.startDate === 'string' ? e.startDate : '';
    if (sd.length < 7) continue;
    const m = sd.slice(0, 7);
    if (m < firstMonth || m > lastMonth) continue;
    out[m] = (out[m] ?? 0) + 1;
  }
  return out;
}

/**
 * Share per 1,000 conferences the source recorded that month — the same scale as
 * hiring's "per 1,000 job posts", chosen over GitHub's "per 10,000" on purpose.
 * GitHub's collector found that a share stored per 10,000 repos left most months
 * below 1, and this project's own growth() treats anything under 1 as "no base to
 * divide by" and silently drops it — quietly deleting most of a quiet topic's
 * history. Conference totals run in the tens to low hundreds a month, not
 * millions, so per 1,000 keeps a typical single-conference month just above that
 * floor instead of repeating the bug.
 */
export function shareOf(raw: Record<string, number>, totals: Record<string, number>): Record<string, number> {
  const share: Record<string, number> = {};
  for (const [m, v] of Object.entries(raw)) {
    const total = totals[m];
    if (!total) continue;
    share[m] = Math.round((v / total) * 1_000 * 100) / 100;
  }
  return share;
}

/** A series that never changes is a failure, not a flat trend — same guard as the other three collectors. */
export function assertVaries(skillId: string, series: Record<string, number>): void {
  const vals = Object.values(series);
  if (vals.length < 3) return;
  if (new Set(vals).size === 1) {
    throw new Error(
      `Conference series for "${skillId}" is constant at ${vals[0]} across ${vals.length} months — ` +
        `a fetch probably failed silently. Check the category file.`,
    );
  }
}

/** Fewer months with any conference than this and the series is too sparse to mean anything. */
export const MIN_NONZERO_MONTHS = 4;

/** Fetch every category file for a year, capped concurrency, politely. */
export async function fetchYear(year: number, categories: string[]): Promise<Record<string, ConferenceEntry[] | null>> {
  const out: Record<string, ConferenceEntry[] | null> = {};
  await mapLimit(categories, 4, async (file) => {
    out[file] = await fetchCategoryYear(file, year);
  });
  return out;
}
