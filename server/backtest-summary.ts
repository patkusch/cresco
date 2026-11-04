import { SKILLS } from './taxonomy.ts';
import { accuracyByVerdict } from './scoring.ts';
import type { Claim, Ledger } from './types.ts';

/**
 * The backtest's headline numbers as plain data, written to data/backtest.json
 * so the README score table can be checked against a file instead of copied out
 * of a terminal. No timestamp: the replay is deterministic, so an unchanged
 * ledger gives a byte-identical file and git shows no change.
 */
export interface BacktestSummary {
  months: number;
  from: string;
  to: string;
  skills: number;
  graded: number;
  open: number;
  correct: number;
  wrong: number;
  partial: number;
  /** Whole-number percent of graded calls that were right, or null if none graded. */
  rate: number | null;
  byVerdict: ReturnType<typeof accuracyByVerdict>;
}

export function backtestSummary(ledger: Ledger, claims: Claim[]): BacktestSummary {
  const done = claims.filter((c) => c.outcome);
  const count = (o: string) => done.filter((c) => c.outcome === o).length;
  const correct = count('correct');
  return {
    months: ledger.snapshots.length,
    from: ledger.snapshots[0]?.ts.slice(0, 7) ?? '',
    to: ledger.snapshots.at(-1)?.ts.slice(0, 7) ?? '',
    skills: SKILLS.length,
    graded: done.length,
    open: claims.length - done.length,
    correct,
    wrong: count('wrong'),
    partial: count('partial'),
    rate: done.length ? Math.round((correct / done.length) * 100) : null,
    byVerdict: accuracyByVerdict(claims),
  };
}
