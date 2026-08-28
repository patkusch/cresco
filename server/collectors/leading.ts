import { getJSON, mapLimit } from './http.ts';
import { PROXIES } from './proxies.ts';
import { SKILLS } from '../taxonomy.ts';

/** month key, e.g. "2026-08" */
export type Month = string;
export type Series = Record<Month, number>;

const monthKey = (d: Date) => d.toISOString().slice(0, 7);

export function monthsBack(n: number): Month[] {
  const out: Month[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  return out;
}

/**
 * npm download counts, aggregated daily → monthly.
 *
 * The registry caps a range request at 18 months, so long histories are stitched
 * from consecutive windows. Absolute numbers are inflated by CI and mirrors —
 * consistently so, which makes them fine for trend and useless for levels.
 */
export async function npmMonthly(pkg: string, months: number): Promise<Series> {
  const series: Series = {};
  const now = new Date();
  const windows: [string, string][] = [];
  for (let start = months; start > 0; start -= 17) {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - start + 1, 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - Math.max(0, start - 17) + 1, 0));
    windows.push([from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)]);
  }

  for (const [from, to] of windows) {
    const data = await persist(
      () => getJSON<{ downloads: { day: string; downloads: number }[] }>(
        `https://api.npmjs.org/downloads/range/${from}:${to}/${pkg}`,
        { timeoutMs: 25_000 },
      ),
      (d) => !!d?.downloads?.length,
    );
    for (const d of data?.downloads ?? []) {
      const m = d.day.slice(0, 7);
      series[m] = (series[m] ?? 0) + d.downloads;
    }
  }
  return series;
}

/**
 * A single gate for every outbound request in this module.
 *
 * Both Wikimedia and the npm registry throttle, and getJSON turns a 429 into null
 * — which reads exactly like "this package/article does not exist". Widening the
 * fetch from 36 to 84 months made this dramatically worse: coverage FELL from 19
 * skills to 12, because asking for more data got more of it silently refused.
 * Slower and complete beats fast and quietly wrong.
 */
let gate: Promise<void> = Promise.resolve();
function throttled<T>(fn: () => Promise<T>, gapMs = 700): Promise<T> {
  const run = gate.then(fn);
  gate = run.then(() => new Promise((r) => setTimeout(r, gapMs)), () => new Promise((r) => setTimeout(r, gapMs)));
  return run;
}

/** Retry with backoff, and only believe an empty result after the last attempt. */
async function persist<T>(fn: () => Promise<T | null>, ok: (v: T | null) => boolean, tries = 4): Promise<T | null> {
  let out: T | null = null;
  for (let i = 0; i < tries; i++) {
    if (i) await new Promise((r) => setTimeout(r, 1200 * i));
    out = await throttled(fn);
    if (ok(out)) return out;
  }
  return out;
}

/** Wikipedia pageviews, monthly, human traffic only (bots excluded by the `user` agent filter). */
export async function wikipediaMonthly(title: string, months: number): Promise<Series> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '') + '00';
  const url =
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/` +
    `${encodeURIComponent(title)}/monthly/${fmt(start)}/${fmt(now)}`;
  const opts = { timeoutMs: 20_000, headers: { 'user-agent': 'cresco/0.1 (skill-demand research; github.com/patkusch/cresco)' } };

  const data = await persist(
    () => getJSON<{ items: { timestamp: string; views: number }[] }>(url, opts),
    (d) => !!d?.items?.length,
  );
  const series: Series = {};
  for (const it of data?.items ?? []) {
    series[`${it.timestamp.slice(0, 4)}-${it.timestamp.slice(4, 6)}`] = it.views;
  }
  return series;
}

export interface LeadingData {
  months: Month[];
  /** skillId → sourceId → month → value */
  series: Record<string, Record<string, Series>>;
  resolved: { skillId: string; source: string; ref: string; points: number }[];
  missing: { skillId: string; source: string; ref: string }[];
}

function sumSeries(list: Series[]): Series {
  const out: Series = {};
  for (const s of list) for (const [m, v] of Object.entries(s)) out[m] = (out[m] ?? 0) + v;
  return out;
}

export async function collectLeading(months: number): Promise<LeadingData> {
  const data: LeadingData = { months: monthsBack(months), series: {}, resolved: [], missing: [] };

  await mapLimit(SKILLS, 2, async (skill) => {
    const proxy = PROXIES[skill.id];
    if (!proxy) return;
    const bucket: Record<string, Series> = {};

    if (proxy.npm?.length) {
      const parts: Series[] = [];
      for (const pkg of proxy.npm) {
        const s = await npmMonthly(pkg, months);
        const points = Object.keys(s).length;
        if (points) { parts.push(s); data.resolved.push({ skillId: skill.id, source: 'npm', ref: pkg, points }); }
        else data.missing.push({ skillId: skill.id, source: 'npm', ref: pkg });
      }
      if (parts.length) bucket.npm = sumSeries(parts);
    }

    if (proxy.wikipedia?.length) {
      const parts: Series[] = [];
      for (const title of proxy.wikipedia) {
        const s = await wikipediaMonthly(title, months);
        const points = Object.keys(s).length;
        if (points) { parts.push(s); data.resolved.push({ skillId: skill.id, source: 'wikipedia', ref: title, points }); }
        else data.missing.push({ skillId: skill.id, source: 'wikipedia', ref: title });
      }
      if (parts.length) bucket.wikipedia = sumSeries(parts);
    }

    if (Object.keys(bucket).length) data.series[skill.id] = bucket;
  });

  return data;
}
