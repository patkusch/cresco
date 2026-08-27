import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLedger } from '../server/ledger.ts';
import type { LeadingData } from '../server/collectors/leading.ts';
import { MAX_LAG, hiringByMonth, pairsAtLag, pearson, mulberry32, shuffled, median } from '../server/leadlag.ts';

/**
 * Out-of-sample validation for the lead-lag claim.
 *
 * The headline "Wikipedia leads hiring by 7 months" was measured on the same
 * skills it was chosen from, which is the exact mistake the backtest refused to
 * make with the rising thresholds. Two questions here, and the claim has to
 * survive both:
 *
 *   1. SPLIT — pick the peak lag on half the skills, then test it on the half it
 *      never saw. Repeated over many random splits, because a single split is
 *      itself a coin toss.
 *
 *   2. NULL — pair each skill's attention series with a DIFFERENT skill's hiring.
 *      Any correlation left is what the method manufactures from autocorrelated
 *      growth windows alone. If the real result sits inside that distribution,
 *      there is no finding.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPLITS = 400;
const SOURCES = ['wikipedia', 'npm'] as const;

const path = join(ROOT, 'data', 'leading.json');
if (!existsSync(path)) { console.error('No data/leading.json — run `npm run leading` first.'); process.exit(1); }
const leading = JSON.parse(readFileSync(path, 'utf8')) as LeadingData;

const ledger = loadLedger();
if (ledger.seeded) { console.error('Refusing to validate against a seeded ledger.'); process.exit(1); }

const hiring = hiringByMonth(ledger);
const months = [...new Set(ledger.snapshots.map((s) => s.ts.slice(0, 7)))].sort();

console.log(`hiring: ${months.length} months (${months[0]} → ${months.at(-1)})\n`);

for (const source of SOURCES) {
  const skills = Object.keys(leading.series).filter((s) => leading.series[s][source] && hiring[s]);
  console.log(`── ${source} · ${skills.length} skills with both series ──`);
  if (skills.length < 8) { console.log('  too few skills to split meaningfully\n'); continue; }

  const rand = mulberry32(20260827);
  const holdRs: number[] = [];
  const pickedLags: number[] = [];

  for (let i = 0; i < SPLITS; i++) {
    const order = shuffled(skills, rand);
    const fit = order.slice(0, Math.floor(order.length / 2));
    const hold = order.slice(Math.floor(order.length / 2));

    // Choose the lag using ONLY the fit half.
    let bestLag = -1, bestR = -Infinity;
    for (let lag = 0; lag <= MAX_LAG; lag++) {
      const r = pearson(pairsAtLag(leading, hiring, months, source, lag, { skills: fit }));
      if (r !== null && r > bestR) { bestR = r; bestLag = lag; }
    }
    if (bestLag < 0) continue;

    // Then test that lag on skills the choice never saw.
    const r = pearson(pairsAtLag(leading, hiring, months, source, bestLag, { skills: hold }));
    if (r === null) continue;
    holdRs.push(r);
    pickedLags.push(bestLag);
  }

  // Null: same procedure, but each skill's attention paired with another's hiring.
  const nullRand = mulberry32(77);
  const nullRs: number[] = [];
  for (let i = 0; i < SPLITS; i++) {
    const targets = shuffled(skills, nullRand);
    const map: Record<string, string> = {};
    skills.forEach((s, k) => (map[s] = targets[k]));
    const order = shuffled(skills, nullRand);
    const fit = order.slice(0, Math.floor(order.length / 2));
    const hold = order.slice(Math.floor(order.length / 2));

    let bestLag = -1, bestR = -Infinity;
    for (let lag = 0; lag <= MAX_LAG; lag++) {
      const r = pearson(pairsAtLag(leading, hiring, months, source, lag, { skills: fit, shuffleMap: map }));
      if (r !== null && r > bestR) { bestR = r; bestLag = lag; }
    }
    if (bestLag < 0) continue;
    const r = pearson(pairsAtLag(leading, hiring, months, source, bestLag, { skills: hold, shuffleMap: map }));
    if (r !== null) nullRs.push(r);
  }

  const realMed = median(holdRs);
  const nullMed = median(nullRs);
  const beat = nullRs.length ? nullRs.filter((n) => n >= realMed).length / nullRs.length : NaN;
  const lagMode = pickedLags.sort((a, b) => a - b)[Math.floor(pickedLags.length / 2)];
  const positive = holdRs.filter((r) => r > 0).length / holdRs.length;

  console.log(`  lag chosen on fit half (median):     ${lagMode} months`);
  console.log(`  hold-out r (median of ${String(holdRs.length).padStart(3)} splits):  ${realMed >= 0 ? '+' : ''}${realMed.toFixed(3)}`);
  console.log(`  hold-out splits with r > 0:          ${(positive * 100).toFixed(0)}%`);
  console.log(`  NULL r (shuffled skill labels):      ${nullMed >= 0 ? '+' : ''}${nullMed.toFixed(3)}`);
  console.log(`  share of nulls beating the real:     ${(beat * 100).toFixed(1)}%   ← the number that matters`);

  const verdict =
    beat < 0.05 && realMed > 0.15 ? 'SURVIVES — holds out of sample and beats the null'
    : beat < 0.2 && realMed > 0.1 ? 'WEAK — directionally there, not established'
    : 'DOES NOT SURVIVE — indistinguishable from the method’s own artefact';
  console.log(`  → ${verdict}\n`);
}
