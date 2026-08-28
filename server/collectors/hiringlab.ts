import { getText } from './http.ts';

/**
 * Indeed Hiring Lab's Software Development postings index — the control series.
 *
 * Counting share per 1,000 job posts was the right fix for thread-size noise, but
 * it left one blind spot: share says nothing about whether the market itself is
 * growing or shrinking. This index went 233.8 at the 2022 peak to 65.2 in Aug
 * 2025. A skill that held its share through that lost two thirds of its absolute
 * demand, and nothing in the ledger could see it.
 *
 * Market-level, not per-skill — it is a denominator, not a signal. CC BY 4.0,
 * keyless. Attribution: Indeed Hiring Lab.
 */

const URL =
  'https://raw.githubusercontent.com/hiring-lab/job_postings_tracker/master/US/job_postings_by_sector_US.csv';

export type MarketSeries = Record<string, number>; // month -> index (Feb 2020 = 100)

export interface MarketData {
  source: string;
  attribution: string;
  sector: string;
  baseline: string;
  monthly: MarketSeries;
}

export async function fetchMarketIndex(): Promise<MarketData | null> {
  const csv = await getText(URL, { timeoutMs: 60_000 });
  if (!csv) return null;

  const lines = csv.split('\n');
  const header = lines[0].split(',').map((h) => h.trim());
  const iDate = header.indexOf('date');
  const iValue = header.indexOf('indexed_value') >= 0 ? header.indexOf('indexed_value') : 2;
  const iIndicator = header.findIndex((h) => /indicator|variable/.test(h));

  // Daily values averaged into months. "total postings" is the stock of open roles,
  // which is what the hiring share is a share *of*; "new postings" is the flow.
  const buckets = new Map<string, number[]>();
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    if (row.length < 4) continue;
    if (!/Software Development/.test(lines[i])) continue;
    if (!/total postings/.test(lines[i])) continue;
    const date = row[iDate]?.trim();
    const value = Number(row[iValue]);
    if (!date || !Number.isFinite(value)) continue;
    const month = date.slice(0, 7);
    const arr = buckets.get(month) ?? [];
    arr.push(value);
    buckets.set(month, arr);
  }

  const monthly: MarketSeries = {};
  for (const [month, vals] of buckets) {
    monthly[month] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }

  if (!Object.keys(monthly).length) return null;
  return {
    source: URL,
    attribution: 'Indeed Hiring Lab, CC BY 4.0',
    sector: 'Software Development',
    baseline: 'February 2020 = 100',
    monthly,
  };
}
