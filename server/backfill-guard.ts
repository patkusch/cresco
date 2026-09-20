import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Ledger } from './types.ts';

/**
 * The backfill rebuilds the ledger from scratch. That is the right thing for a
 * first run and a dangerous thing for a repo that already holds years of real
 * history: `npm run backfill` defaults to 8 months, and a ledger of 72 months
 * would quietly become a ledger of 8. These two functions are the whole seat
 * belt, kept out of the script so they can be tested without a network.
 */

export interface OverwriteVerdict {
  /** True when the run may replace the existing ledger. */
  allowed: boolean;
  /** Months in the ledger on disk that the run would not reproduce. */
  monthsLost: number;
  existingMonths: number;
  /** Set when the run was refused; ready to print. */
  message?: string;
}

/**
 * Decide whether a backfill that would produce `newMonths` months may replace
 * `existing`.
 *
 * - No ledger, or a synthetic one (`seeded`): always allowed. Nothing real is lost.
 * - A real ledger that is at least as long as the new run: refused unless `force`.
 * - A new run that is as long or longer: allowed.
 *
 * It counts months, not which months. A run of the same length over a different
 * window is allowed; the timestamped backup is what covers that case.
 */
export function assessOverwrite(existing: Ledger | null, newMonths: number, force: boolean): OverwriteVerdict {
  const existingMonths = existing?.snapshots.length ?? 0;
  const monthsLost = Math.max(0, existingMonths - newMonths);
  if (!existing || existing.seeded || monthsLost === 0 || force) {
    return { allowed: true, monthsLost, existingMonths };
  }
  return {
    allowed: false,
    monthsLost,
    existingMonths,
    message:
      `Refusing to overwrite data/ledger.json: it holds ${existingMonths} real months and this run would produce ` +
      `${newMonths}, losing ${monthsLost}.\n` +
      `To extend history, ask for at least ${existingMonths} months:\n  BACKFILL_MONTHS=${existingMonths} npm run backfill\n` +
      `To replace it anyway (a timestamped backup is kept):\n  npm run backfill -- --force`,
  };
}

/** `2026-09-19T10:15:30.123Z` -> `20260919T101530Z`, safe in a file name. */
const stamp = (now: Date) => now.toISOString().replace(/\.\d+Z$/, 'Z').replace(/[-:]/g, '');

/**
 * Copy the ledger about to be replaced into `dir` and return the file name.
 *
 * A real ledger goes to `ledger.previous-<timestamp>.json`, and an existing
 * backup is never overwritten (a counter is added if two land in the same
 * second). The old scheme kept one `ledger.previous.json`, so a second run
 * destroyed the good copy the first run had saved. A synthetic ledger still
 * goes to `ledger.seeded.json`: it can be regenerated with `npm run seed`, so
 * overwriting it loses nothing.
 */
export function backUpLedger(dir: string, existing: Ledger, now = new Date()): string {
  const source = join(dir, 'ledger.json');
  if (existing.seeded) {
    copyFileSync(source, join(dir, 'ledger.seeded.json'));
    return 'ledger.seeded.json';
  }
  const base = `ledger.previous-${stamp(now)}`;
  let name = `${base}.json`;
  for (let n = 2; existsSync(join(dir, name)); n++) name = `${base}-${n}.json`;
  copyFileSync(source, join(dir, name));
  return name;
}
