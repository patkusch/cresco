import 'dotenv/config';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLedger } from '../server/ledger.ts';
import { GITHUB_TOPICS, MIN_NONZERO_MONTHS, repoCount, shareOf, assertVaries } from '../server/collectors/github-topics.ts';
import type { LeadingData } from '../server/collectors/leading.ts';

/**
 * `npm run github-topics [-- --only=mcp,rust] [--months=N] [--fresh]`
 *
 * One request per skill per month plus one per month for the denominator, at
 * 30 a minute: the full 64 × 84 run takes about three hours. So the file is a
 * checkpoint, written after every skill, and a re-run picks up where the last
 * one stopped unless --fresh is given. --only and --months exist for spot checks.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'github-topics.json');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));

interface Snapshot extends LeadingData {
  collectedAt?: string;
  /** Repos created per month, the denominator. Kept so a resumed run reuses it. */
  totals?: Record<string, number>;
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
const lastDay = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
};

let months = monthRange(ledgerMonths[0], ledgerMonths.at(-1)!, EXTRA_LEAD);
if (args.months) months = months.slice(-Number(args.months));
const only = args.only ? new Set(String(args.only).split(',')) : null;
const skills = Object.entries(GITHUB_TOPICS).filter(([id]) => !only || only.has(id));

const data: Snapshot =
  !('fresh' in args) && existsSync(OUT)
    ? (JSON.parse(readFileSync(OUT, 'utf8')) as Snapshot)
    : { months, series: {}, resolved: [], missing: [], totals: {} };
data.months = months;
data.totals ??= {};
const done = new Set([...data.resolved, ...data.missing].filter((r) => r.source === 'github').map((r) => r.skillId));
const save = () => {
  data.collectedAt = new Date().toISOString();
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data, null, 2));
};

console.log(
  `GitHub topics: ${skills.length} skills × ${months.length} months (${months[0]} → ${months.at(-1)})` +
    `${process.env.GITHUB_TOKENS ? `, ${process.env.GITHUB_TOKENS.split(',').length} tokens` : process.env.GITHUB_TOKEN ? ', with token' : ', keyless — set GITHUB_TOKEN for 3× the rate'}` +
    `${done.size ? `, ${done.size} already collected` : ''}\n`,
);

// Denominator first: all repos created in each month.
for (const m of months) {
  if (data.totals[m]) continue;
  const t = await repoCount(null, `${m}-01`, lastDay(m));
  if (t !== null) data.totals[m] = t;
}
save();
console.log(`repos created per month for ${Object.keys(data.totals).length}/${months.length} months\n`);

for (const [skillId, topic] of skills) {
  if (done.has(skillId)) continue;
  const raw: Record<string, number> = {};
  for (const m of months) {
    const c = await repoCount(topic, `${m}-01`, lastDay(m));
    if (c !== null) raw[m] = c;
  }

  try {
    assertVaries(skillId, raw);
  } catch (err) {
    console.log(`  ✗ ${skillId.padEnd(22)} ${(err as Error).message.slice(0, 90)}`);
    data.missing.push({ skillId, source: 'github', ref: topic });
    save();
    continue;
  }

  const vals = Object.values(raw);
  const nonZero = vals.filter((v) => v > 0).length;
  if (nonZero < MIN_NONZERO_MONTHS) {
    console.log(`  ✗ ${skillId.padEnd(22)} topic:${topic} — only ${nonZero} months with any repos, too sparse`);
    data.missing.push({ skillId, source: 'github', ref: topic });
    save();
    continue;
  }

  const share = shareOf(raw, data.totals);
  data.series[skillId] = { ...(data.series[skillId] ?? {}), github: share };
  data.resolved.push({ skillId, source: 'github', ref: topic, points: Object.keys(share).length });
  save();
  console.log(
    `  ✓ ${skillId.padEnd(22)} topic:${topic}  ${Object.keys(share).length} months · ${Math.min(...vals)}–${Math.max(...vals)} repos/mo`,
  );
}

console.log(`\n${data.resolved.filter((r) => r.source === 'github').length} skills with a GitHub series → data/github-topics.json`);
