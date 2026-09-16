import 'dotenv/config';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLedger } from '../server/ledger.ts';
import {
  CONFERENCE_CATEGORIES,
  MIN_NONZERO_MONTHS,
  categoriesForYear,
  fetchYear,
  bucketByMonth,
  shareOf,
  assertVaries,
  type ConferenceEntry,
} from '../server/collectors/conference-programmes.ts';
import type { LeadingData } from '../server/collectors/leading.ts';

/**
 * `npm run conference-programmes [-- --fresh]`
 *
 * Unlike GITHUB_TOPICS (one request per skill per month), the source here is
 * organised one file per topic per *year* — so the collector fetches every
 * category file once per year, buckets locally by month, and derives every
 * skill's share from that cache. ~40 categories × 7 years is a couple of hundred
 * plain file fetches with no auth and no per-minute limit, so a full run takes
 * minutes, not hours. The cache is still a checkpoint: a killed run resumes
 * without re-fetching what it already has.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'conference-programmes.json');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));

interface Snapshot extends LeadingData {
  collectedAt?: string;
  /** Category filenames the source repo actually has, per year — ground truth, cached so a resumed run does not re-list. */
  categoriesByYear?: Record<string, string[]>;
  /** "{year}:{category}" -> month -> conference count. The raw fetch cache; totals and shares are derived fresh from this every run. */
  monthCounts?: Record<string, Record<string, number>>;
  /** "{year}:{category}" fetches that never succeeded after retries — a hole, not a zero, and excluded from every total. */
  fetchFailures?: string[];
}

const ledger = loadLedger();
const ledgerMonths = ledger.snapshots.map((s) => s.ts.slice(0, 7)).sort();
const EXTRA_LEAD = 12;

function monthRange(first: string, last: string, leadIn: number): string[] {
  const [y, m] = first.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1 - leadIn, 1));
  const [ey, em] = last.split('-').map(Number);
  const end = new Date(Date.UTC(ey, em - 1, 1));
  const out: string[] = [];
  for (let d = start; d <= end; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

const months = monthRange(ledgerMonths[0], ledgerMonths.at(-1)!, EXTRA_LEAD);
const firstMonth = months[0];
const lastMonth = months.at(-1)!;
const years = [...new Set(months.map((m) => Number(m.slice(0, 4))))].sort();

const data: Snapshot =
  !('fresh' in args) && existsSync(OUT)
    ? (JSON.parse(readFileSync(OUT, 'utf8')) as Snapshot)
    : { months, series: {}, resolved: [], missing: [] };
data.months = months;
data.categoriesByYear ??= {};
data.monthCounts ??= {};
data.fetchFailures ??= [];

const save = () => {
  data.collectedAt = new Date().toISOString();
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data, null, 2));
};

console.log(
  `Conference programmes: ${years.length} years (${firstMonth} → ${lastMonth}), ` +
    `${Object.keys(CONFERENCE_CATEGORIES).length} mapped skills\n`,
);

// Ground truth for which category files exist each year.
for (const year of years) {
  if (data.categoriesByYear[year]) continue;
  const cats = await categoriesForYear(year);
  if (!cats) {
    console.error(`  ✗ could not list categories for ${year} — that whole year is a hole, not zero`);
    continue;
  }
  data.categoriesByYear[year] = cats;
  save();
  console.log(`  ${year}: ${cats.length} categories`);
}

// Fetch every category file once per year, checkpointing after each year.
for (const year of years) {
  const cats = data.categoriesByYear[year];
  if (!cats) continue;
  const pending = cats.filter((c) => !(`${year}:${c}` in data.monthCounts!) && !data.fetchFailures!.includes(`${year}:${c}`));
  if (!pending.length) continue;
  const fetched = await fetchYear(year, pending);
  for (const [file, entries] of Object.entries(fetched)) {
    const key = `${year}:${file}`;
    if (entries === null) {
      data.fetchFailures!.push(key);
      console.error(`  ✗ ${key} — never succeeded, excluded from every total`);
      continue;
    }
    data.monthCounts![key] = bucketByMonth(entries as ConferenceEntry[], firstMonth, lastMonth);
  }
  save();
  console.log(`  ${year}: fetched ${pending.length} categories`);
}

// Derive totals (every category, every year) and each mapped skill's raw count from the cache.
const totals: Record<string, number> = {};
for (const monthly of Object.values(data.monthCounts!)) {
  for (const [m, v] of Object.entries(monthly)) totals[m] = (totals[m] ?? 0) + v;
}

data.resolved = data.resolved.filter((r) => r.source !== 'conference');
data.missing = data.missing.filter((r) => r.source !== 'conference');

const monthsOfYear = (year: number) => months.filter((m) => Number(m.slice(0, 4)) === year);

for (const [skillId, category] of Object.entries(CONFERENCE_CATEGORIES)) {
  const file = `${category}.json`;
  // Zero-fill every month of a year where the category file is confirmed to exist and was
  // fetched successfully — a real "no conference that month", not an absence of data. A year
  // where the category was never split out by the source (categoriesByYear lacks it) or whose
  // fetch never succeeded (fetchFailures) is skipped entirely: a hole, not a zero.
  const raw: Record<string, number> = {};
  for (const year of years) {
    const cats = data.categoriesByYear![year];
    const key = `${year}:${file}`;
    if (!cats || !cats.includes(file) || data.fetchFailures!.includes(key)) continue;
    const monthly = data.monthCounts![key] ?? {};
    for (const m of monthsOfYear(year)) raw[m] = monthly[m] ?? 0;
  }

  if (!Object.keys(raw).length) {
    console.log(`  ✗ ${skillId.padEnd(14)} ${file} never appears in the window — no series`);
    data.missing.push({ skillId, source: 'conference', ref: category });
    continue;
  }

  try {
    assertVaries(skillId, raw);
  } catch (err) {
    console.log(`  ✗ ${skillId.padEnd(14)} ${(err as Error).message.slice(0, 90)}`);
    data.missing.push({ skillId, source: 'conference', ref: category });
    continue;
  }

  const nonZero = Object.values(raw).filter((v) => v > 0).length;
  if (nonZero < MIN_NONZERO_MONTHS) {
    console.log(`  ✗ ${skillId.padEnd(14)} ${category}.json — only ${nonZero} months with any conference, too sparse`);
    data.missing.push({ skillId, source: 'conference', ref: category });
    continue;
  }

  const share = shareOf(raw, totals);
  data.series[skillId] = { ...(data.series[skillId] ?? {}), conference: share };
  data.resolved.push({ skillId, source: 'conference', ref: category, points: Object.keys(share).length });
  const vals = Object.values(raw);
  console.log(
    `  ✓ ${skillId.padEnd(14)} ${category}.json  ${nonZero}/${Object.keys(raw).length} months with any · ${Math.min(...vals)}–${Math.max(...vals)} conferences/mo`,
  );
}

save();
console.log(
  `\n${data.resolved.filter((r) => r.source === 'conference').length}/${Object.keys(CONFERENCE_CATEGORIES).length} skills with a conference series` +
    `${data.fetchFailures!.length ? `, ${data.fetchFailures!.length} category-years never fetched` : ''} → data/conference-programmes.json`,
);
