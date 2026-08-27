import 'dotenv/config';
import { loadLedger, saveLedger, mintClaims } from '../server/ledger.ts';
import { computeSignals } from '../server/signal.ts';
import { scoreClaim, accuracyByVerdict } from '../server/scoring.ts';
import type { Claim, Ledger } from '../server/types.ts';

/**
 * Walk-forward backtest — the loop's third step, run against history.
 *
 * Rather than minting a call today and waiting a quarter to learn anything, this
 * replays the ledger month by month: at each step it grades whatever calls have
 * come due, then mints new ones from *only* the data that existed at that point.
 *
 * The no-lookahead property is the whole point and it is load-bearing. Signals at
 * step m are computed from `snapshots.slice(0, m + 1)`, so the reference scale,
 * the momentum window and the source-eligibility rule all see exactly what they
 * would have seen at the time. Score the calls against a scale that includes their
 * own future and you will produce a flattering number that means nothing.
 */

const MIN_HISTORY = 3; // classify() refuses to call anything below this anyway

const ledger = loadLedger();
if (ledger.seeded) {
  console.error('Refusing to backtest a seeded ledger — those numbers are invented.');
  console.error('Run `npm run backfill` first.');
  process.exit(1);
}
if (ledger.snapshots.length < MIN_HISTORY + 2) {
  console.error(`Need at least ${MIN_HISTORY + 2} snapshots to backtest; ledger has ${ledger.snapshots.length}.`);
  process.exit(1);
}

const snapshots = ledger.snapshots;
const asOf = (m: number): Ledger => ({ ...ledger, snapshots: snapshots.slice(0, m + 1) });

const claims: Claim[] = [];
let minted = 0;
let scored = 0;

console.log(`replaying ${snapshots.length} snapshots · ${snapshots[0].ts.slice(0, 7)} → ${snapshots.at(-1)!.ts.slice(0, 7)}\n`);

for (let m = MIN_HISTORY; m < snapshots.length; m++) {
  const now = new Date(snapshots[m].ts);
  const signals = computeSignals(asOf(m), {});
  const byId = new Map(signals.map((s) => [s.skill.id, s]));

  // 1. Grade anything that has come due, using only data up to this point.
  for (const c of claims) {
    if (c.outcome || new Date(c.checkBackAt) > now) continue;
    const then = byId.get(c.skillId);
    if (!then) continue;
    const { outcome, note } = scoreClaim(c, then);
    c.outcome = outcome;
    c.scoredAt = now.toISOString();
    c.scoringNote = note;
    scored++;
  }

  // 2. Mint fresh calls from what was knowable then. Resolved claims free up the
  //    skill+verdict slot, so a skill can be called more than once across the run.
  const fresh = mintClaims({ ...ledger, claims }, signals, now);
  claims.push(...fresh);
  minted += fresh.length;

  const due = claims.filter((c) => c.outcome && c.scoredAt === now.toISOString()).length;
  console.log(`  ${snapshots[m].ts.slice(0, 7)}   minted ${String(fresh.length).padStart(2)}   graded ${String(due).padStart(2)}`);
}

const done = claims.filter((c) => c.outcome);
const correct = done.filter((c) => c.outcome === 'correct').length;
const wrong = done.filter((c) => c.outcome === 'wrong').length;
const partial = done.filter((c) => c.outcome === 'partial').length;

console.log(`\n  ${minted} calls minted · ${scored} graded · ${claims.length - scored} still open\n`);
console.log(`  correct ${correct}   wrong ${wrong}   partial ${partial}`);
console.log(`  hit rate: ${done.length ? Math.round((correct / done.length) * 100) : 0}%\n`);

const table = accuracyByVerdict(claims);
for (const [verdict, row] of Object.entries(table)) {
  console.log(`    ${verdict.padEnd(14)} ${String(row.rate).padStart(3)}%  (${row.correct} right, ${row.wrong} wrong, ${row.partial} partial)`);
}

const misses = done.filter((c) => c.outcome === 'wrong').slice(0, 6);
if (misses.length) {
  console.log('\n  where it was wrong:');
  for (const c of misses) console.log(`    ${c.skillId} · called ${c.verdict} · ${c.scoringNote}`);
}

saveLedger({ ...ledger, claims });
console.log('\nwritten to data/ledger.json');
