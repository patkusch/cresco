import 'dotenv/config';
import { loadLedger, mintClaims } from '../server/ledger.ts';
import { computeSignals } from '../server/signal.ts';
import { scoreClaim, accuracyByVerdict } from '../server/scoring.ts';
import { marketAdjust, loadMarket, marketCoverage } from '../server/market.ts';
import type { Claim, Ledger } from '../server/types.ts';

/**
 * Same walk-forward backtest, same grader, two different ledgers:
 * hiring share as-is, versus hiring share scaled by the market index.
 *
 * The point is to find out whether correcting for market contraction actually
 * produces better calls, rather than assuming a more sophisticated measure must
 * be a better one.
 */

const MIN_HISTORY = 3;

function run(ledger: Ledger) {
  const snapshots = ledger.snapshots;
  const asOf = (m: number): Ledger => ({ ...ledger, snapshots: snapshots.slice(0, m + 1) });
  const claims: Claim[] = [];

  for (let m = MIN_HISTORY; m < snapshots.length; m++) {
    const now = new Date(snapshots[m].ts);
    const signals = computeSignals(asOf(m), {});
    const byId = new Map(signals.map((s) => [s.skill.id, s]));

    for (const c of claims) {
      if (c.outcome || new Date(c.checkBackAt) > now) continue;
      const then = byId.get(c.skillId);
      if (!then) continue;
      const { outcome, note } = scoreClaim(c, then);
      c.outcome = outcome; c.scoredAt = now.toISOString(); c.scoringNote = note;
    }
    claims.push(...mintClaims({ ...ledger, claims }, signals, now));
  }

  const done = claims.filter((c) => c.outcome);
  const correct = done.filter((c) => c.outcome === 'correct').length;
  return {
    minted: claims.length,
    graded: done.length,
    correct,
    rate: done.length ? Math.round((correct / done.length) * 100) : 0,
    byVerdict: accuracyByVerdict(claims),
  };
}

const base = loadLedger();
if (base.seeded) { console.error('Refusing to compare a seeded ledger.'); process.exit(1); }
const market = loadMarket();
if (!market) { console.error('No data/market.json — run `npm run market` first.'); process.exit(1); }

const cov = marketCoverage(base, market);
console.log(`ledger: ${base.snapshots.length} months (${base.snapshots[0].ts.slice(0,7)} → ${base.snapshots.at(-1)!.ts.slice(0,7)})`);
console.log(`market index covers ${cov.covered}/${cov.total} of them\n`);

const a = run(base);
const b = run(marketAdjust(base, market));

console.log('                        share only     market-adjusted');
console.log(`  calls graded            ${String(a.graded).padStart(6)}          ${String(b.graded).padStart(6)}`);
console.log(`  hit rate                ${String(a.rate + '%').padStart(6)}          ${String(b.rate + '%').padStart(6)}`);
console.log('');
for (const v of ['rising', 'cooling', 'hype', 'table-stakes']) {
  const x = a.byVerdict[v], y = b.byVerdict[v];
  const f = (r: any) => (r?.scored ? `${String(r.rate).padStart(3)}% (n=${r.scored})` : '     —      ');
  console.log(`  ${v.padEnd(14)}  ${f(x)}     ${f(y)}`);
}

const delta = b.rate - a.rate;
console.log(`\n  → market adjustment ${delta > 2 ? 'IMPROVES' : delta < -2 ? 'HURTS' : 'makes no clear difference'} the calls (${delta > 0 ? '+' : ''}${delta}pp)`);
