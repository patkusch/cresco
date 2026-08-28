import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLedger } from '../server/ledger.ts';
import { loadIndicators, availableSources } from '../server/sources.ts';

/**
 * Does adoption lead hiring — and by how many months?
 *
 * This is the question the whole reframe rests on, so it is answered rather than
 * assumed. Growth rates are correlated, never levels: two series that both drift
 * upward correlate at 0.9 while telling you nothing, and that artefact is how
 * most "leading indicator" claims get made.
 *
 * A positive correlation at lag L means adoption growth this month goes with
 * hiring growth L months later. Zero or negative means it does not lead, and the
 * honest thing is then to stop claiming that it does.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WINDOW = 3;          // months over which growth is measured
const MAX_LAG = 9;

const leading = loadIndicators();

const ledger = loadLedger();
if (ledger.seeded) { console.error('Refusing to analyse a seeded ledger. Run `npm run backfill`.'); process.exit(1); }

// Hiring share per skill per month, straight from the ledger.
const hiring: Record<string, Record<string, number>> = {};
for (const snap of ledger.snapshots) {
  const m = snap.ts.slice(0, 7);
  for (const o of snap.observations) {
    if (o.sourceId !== 'whoshiring') continue;
    (hiring[o.skillId] ??= {})[m] = o.value;
  }
}

const addMonths = (m: string, n: number) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

/** Growth over WINDOW months. Returns null when the base is too small to divide by. */
function growth(series: Record<string, number>, m: string): number | null {
  const now = series[m];
  const before = series[addMonths(m, -WINDOW)];
  if (now === undefined || before === undefined || before < 1) return null;
  return (now - before) / before;
}

function pearson(pairs: [number, number][]): number | null {
  if (pairs.length < 8) return null;
  const n = pairs.length;
  const mx = pairs.reduce((a, p) => a + p[0], 0) / n;
  const my = pairs.reduce((a, p) => a + p[1], 0) / n;
  let cov = 0, sx = 0, sy = 0;
  for (const [x, y] of pairs) { cov += (x - mx) * (y - my); sx += (x - mx) ** 2; sy += (y - my) ** 2; }
  return sx && sy ? cov / Math.sqrt(sx * sy) : null;
}

const SOURCES = availableSources(leading);
const hiringMonths = [...new Set(ledger.snapshots.map((s) => s.ts.slice(0, 7)))].sort();

console.log(`hiring: ${hiringMonths.length} months (${hiringMonths[0]} → ${hiringMonths.at(-1)})`);
console.log(`leading: ${Object.keys(leading.series).length} skills with a proxy · ${WINDOW}-month growth\n`);
console.log('  lag        npm            wikipedia');
console.log('  ---------------------------------------');

const best: { source: string; lag: number; r: number }[] = [];

for (let lag = 0; lag <= MAX_LAG; lag++) {
  const cells: string[] = [];
  for (const source of SOURCES) {
    const pairs: [number, number][] = [];
    for (const [skillId, bySource] of Object.entries(leading.series)) {
      const lead = bySource[source];
      if (!lead || !hiring[skillId]) continue;
      for (const m of hiringMonths) {
        const target = addMonths(m, lag);
        const g1 = growth(lead, m);
        const g2 = growth(hiring[skillId], target);
        if (g1 === null || g2 === null) continue;
        pairs.push([g1, g2]);
      }
    }
    const r = pearson(pairs);
    if (r !== null) best.push({ source, lag, r });
    cells.push(r === null ? `n/a (n=${pairs.length})`.padEnd(15) : `${r >= 0 ? '+' : ''}${r.toFixed(3)} (n=${pairs.length})`.padEnd(15));
  }
  console.log(`  ${String(lag).padStart(2)}mo   ${cells.join(' ')}`);
}

console.log('');
for (const source of SOURCES) {
  const rows = best.filter((b) => b.source === source);
  if (!rows.length) { console.log(`  ${source}: no lag had enough data`); continue; }
  const top = rows.reduce((a, b) => (Math.abs(b.r) > Math.abs(a.r) ? b : a));
  const verdict = top.r > 0.2 ? 'LEADS' : top.r < -0.2 ? 'INVERSE' : 'no usable lead';
  console.log(`  ${source.padEnd(10)} strongest at ${top.lag}mo: ${top.r >= 0 ? '+' : ''}${top.r.toFixed(3)}  →  ${verdict}`);
}
