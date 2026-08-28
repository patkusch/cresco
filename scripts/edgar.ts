import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLedger } from '../server/ledger.ts';
import { EDGAR_QUERIES, edgarCount, quarterTotal, assertVaries } from '../server/collectors/edgar.ts';
import type { LeadingData } from '../server/collectors/leading.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Cover the ledger's own span plus a lead-in, so lags can actually be tested.
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
const lastDay = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
};

console.log(`EDGAR: ${Object.keys(EDGAR_QUERIES).length} skills × ${months.length} months (${months[0]} → ${months.at(-1)})\n`);

// Denominator: total filings per quarter, so a 10-K season spike is not read as demand.
const quarters = [...new Set(months.map((m) => {
  const [y, mo] = m.split('-').map(Number);
  return `${y}-${Math.floor((mo - 1) / 3) + 1}`;
}))];
const totals: Record<string, number> = {};
for (const q of quarters) {
  const [y, n] = q.split('-').map(Number);
  const t = await quarterTotal(y, n);
  if (t) totals[q] = t;
}
console.log(`filing totals for ${Object.keys(totals).length}/${quarters.length} quarters\n`);
const quarterOf = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return `${y}-${Math.floor((mo - 1) / 3) + 1}`;
};

const data: LeadingData = { months, series: {}, resolved: [], missing: [] };

for (const [skillId, phrase] of Object.entries(EDGAR_QUERIES)) {
  const raw: Record<string, number> = {};
  for (const m of months) {
    const c = await edgarCount(phrase, `${m}-01`, lastDay(m));
    if (c !== null) raw[m] = c;
  }

  try {
    assertVaries(skillId, raw);
  } catch (err) {
    console.log(`  ✗ ${skillId.padEnd(18)} ${(err as Error).message.slice(0, 90)}`);
    data.missing.push({ skillId, source: 'edgar', ref: phrase });
    continue;
  }

  // Share per 10,000 filings — same rule as job posts, for the same reason.
  const share: Record<string, number> = {};
  for (const [m, v] of Object.entries(raw)) {
    const total = totals[quarterOf(m)];
    if (!total) continue;
    share[m] = Math.round((v / (total / 3)) * 10_000 * 100) / 100;
  }

  const vals = Object.values(raw);
  const nonZero = vals.filter((v) => v > 0).length;
  if (nonZero < 6) {
    console.log(`  ✗ ${skillId.padEnd(18)} "${phrase}" — only ${nonZero} months with any filings, too sparse`);
    data.missing.push({ skillId, source: 'edgar', ref: phrase });
    continue;
  }

  data.series[skillId] = { edgar: share };
  data.resolved.push({ skillId, source: 'edgar', ref: phrase, points: Object.keys(share).length });
  console.log(`  ✓ ${skillId.padEnd(18)} "${phrase}"  ${Object.keys(share).length} months · ${Math.min(...vals)}–${Math.max(...vals)} filings/mo`);
}

mkdirSync(join(ROOT, 'data'), { recursive: true });
writeFileSync(join(ROOT, 'data', 'edgar.json'), JSON.stringify(data, null, 2));
console.log(`\n${data.resolved.length} skills with an EDGAR series → data/edgar.json`);
