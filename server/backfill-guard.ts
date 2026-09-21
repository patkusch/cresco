import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Ledger, Snapshot } from './types.ts';

/**
 * The backfill rebuilds the ledger from scratch. That is the right thing for a
 * first run and a dangerous thing for a repo that already holds years of real
 * history: `npm run backfill` defaults to 8 months, and a ledger of 72 months
 * would quietly become a ledger of 8. These functions are the whole seat
 * belt, kept out of the scripts so they can be tested without a network.
 *
 * `seed`, `backfill` and `collect` all ask the same question first: is what is
 * on disk real? The answer comes from the snapshots, never from the ledger's
 * `seeded` flag alone. `npm run collect` used to append real snapshots to a
 * ledger still flagged `seeded`, and the flag then said "sample data" about a
 * file that held measurements.
 */

/**
 * True when a snapshot holds anything measured: a number not flagged `fixture`,
 * or a source that reports itself live. A sample week from `npm run seed` has
 * neither. A real collect run has both, next to the fixture numbers it carries
 * for sources it has no key for.
 */
export const hasRealData = (s: Snapshot): boolean =>
  s.observations.some((o) => !o.fixture) || s.sources.some((src) => src.live);

/**
 * True when nothing real would be lost by replacing this ledger: no ledger at
 * all, or one flagged `seeded` in which every snapshot is sample data. A ledger
 * flagged `seeded` that holds even one real snapshot is real, whatever its flag
 * says, and a ledger not flagged `seeded` is always real.
 */
export const isReplaceable = (ledger: Ledger | null): boolean =>
  !ledger || (ledger.seeded && !ledger.snapshots.some(hasRealData));

/**
 * How many months of real history would be lost by replacing this ledger.
 * A ledger not flagged `seeded` says all its months are real, and is counted
 * whole. One that is flagged `seeded` is counted by the snapshots that really are.
 */
export const realMonths = (ledger: Ledger | null): number =>
  !ledger ? 0 : ledger.seeded ? ledger.snapshots.filter(hasRealData).length : ledger.snapshots.length;

const monthsOf = (n: number) => `${n} real month${n === 1 ? '' : 's'}`;

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
 * - No ledger, or one that is sample data all the way through (`isReplaceable`):
 *   always allowed. Nothing real is lost.
 * - A real ledger that holds more months than the new run would produce: refused
 *   unless `force`.
 * - A new run that is as long or longer: allowed.
 *
 * It counts months, not which months. A run of the same length over a different
 * window is allowed; the timestamped backup is what covers that case.
 */
export function assessOverwrite(existing: Ledger | null, newMonths: number, force: boolean): OverwriteVerdict {
  const existingMonths = realMonths(existing);
  const monthsLost = Math.max(0, existingMonths - newMonths);
  if (isReplaceable(existing) || monthsLost === 0 || force) {
    return { allowed: true, monthsLost, existingMonths };
  }
  return {
    allowed: false,
    monthsLost,
    existingMonths,
    message:
      `Refusing to overwrite data/ledger.json: it holds ${monthsOf(existingMonths)} and this run would produce ` +
      `${newMonths}, losing ${monthsLost}.\n` +
      `To extend history, ask for at least ${existingMonths} months:\n  BACKFILL_MONTHS=${existingMonths} npm run backfill\n` +
      `To replace it anyway (a timestamped backup is kept):\n  npm run backfill -- --force`,
  };
}

/**
 * The same seat belt for `npm run seed`, which replaces the whole ledger with
 * eight invented weekly snapshots.
 *
 * It cannot reuse `assessOverwrite`, because that one compares lengths and a
 * real ledger of 8 months would slip through. Replacing real months with
 * invented ones is a loss whatever the length, so here every real month counts
 * as lost.
 *
 * - No ledger, or one that is sample data all the way through: allowed. `npm run seed` recreates it.
 * - A real ledger (including a `seeded` one that has since gained a real snapshot): refused unless `force`; the caller then backs it up with `backUpLedger`.
 */
export function assessSeedOverwrite(existing: Ledger | null, force: boolean): OverwriteVerdict {
  const existingMonths = realMonths(existing);
  if (isReplaceable(existing)) return { allowed: true, monthsLost: 0, existingMonths };
  if (force) return { allowed: true, monthsLost: existingMonths, existingMonths };
  return {
    allowed: false,
    monthsLost: existingMonths,
    existingMonths,
    message:
      `Refusing to overwrite data/ledger.json: it holds ${monthsOf(existingMonths)} and \`npm run seed\` would replace ` +
      `${existingMonths === 1 ? 'it' : 'all of them'} with invented sample data.\n` +
      `You almost certainly want to keep it: \`npm run dev\` shows the real ledger as it is.\n` +
      `To replace it anyway (a timestamped backup is kept):\n  npm run seed -- --force`,
  };
}

export interface CollectVerdict {
  /** True when the run may go on and save. */
  allowed: boolean;
  /**
   * True when the run may go on only by first turning the ledger into a real one
   * (`startRealLedger`). Only ever set together with `allowed`, and only by `--force`.
   */
  startReal: boolean;
  /** Set when the run was refused; ready to print. */
  message?: string;
}

/**
 * The seat belt for `npm run collect`, which appends one snapshot to whatever
 * ledger is on disk.
 *
 * A ledger flagged `seeded` lets fixtures score (that is what makes the demo
 * dashboard work), and a real snapshot appended to it would be scored next to
 * invented numbers, in a file flagged as sample data, which the seed and
 * backfill guards would then wrongly treat as disposable. So a run that
 * collected anything real is refused on a `seeded` ledger unless `force`.
 *
 * Refusing, rather than quietly turning the ledger real, is the smaller and
 * safer choice: the ledger is never in a mixed state, so no rule downstream has
 * to reason about one. `--force` does the conversion deliberately.
 *
 * - Ledger not flagged `seeded`: allowed, unchanged.
 * - Ledger flagged `seeded`, and the run collected nothing real (offline, keyless):
 *   allowed. It adds one more sample-only snapshot to a sample-only ledger.
 * - Ledger flagged `seeded`, and the run collected something real: refused unless `force`.
 */
export function assessCollect(existing: Ledger, snapshot: Snapshot, force: boolean): CollectVerdict {
  if (!existing.seeded || !hasRealData(snapshot)) return { allowed: true, startReal: false };
  if (force) return { allowed: true, startReal: true };
  const already = existing.snapshots.filter(hasRealData).length;
  return {
    allowed: false,
    startReal: false,
    message:
      `Refusing to add a real snapshot to data/ledger.json: it is flagged seeded (sample data)` +
      (already
        ? `, and it already holds ${already} real snapshot${already === 1 ? '' : 's'} from an earlier collect, so it is scoring invented numbers next to real ones.\n`
        : `, and this run collected real numbers.\n` +
          `Adding them would score invented numbers next to real ones in one file.\n`) +
      `To build a real ledger from Hacker News history (no key needed):\n  npm run backfill\n` +
      `To drop the sample data and start a real ledger from this run` +
      (already ? ` (the real snapshots are kept, and a timestamped backup is made first)` : ``) +
      `:\n  npm run collect -- --force`,
  };
}

/**
 * What `assessCollect` means by starting a real ledger: keep every snapshot that
 * holds real data, drop the sample-only ones, and stop calling it seeded.
 *
 * The claims go too. On a seeded ledger they were minted with fixtures scoring,
 * and a real ledger must never carry a call that sample data made; the run mints
 * fresh ones from what is left. Anything fixture-flagged inside a kept snapshot
 * stays flagged, so a real ledger still keeps it out of the score.
 */
export function startRealLedger(existing: Ledger): Ledger {
  return { ...existing, seeded: false, snapshots: existing.snapshots.filter(hasRealData), claims: [] };
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
 * overwriting it loses nothing. "Synthetic" means every snapshot is sample data
 * (`isReplaceable`); a `seeded` ledger that holds a real snapshot gets the
 * timestamped copy.
 */
export function backUpLedger(dir: string, existing: Ledger, now = new Date()): string {
  const source = join(dir, 'ledger.json');
  if (isReplaceable(existing)) {
    copyFileSync(source, join(dir, 'ledger.seeded.json'));
    return 'ledger.seeded.json';
  }
  const base = `ledger.previous-${stamp(now)}`;
  let name = `${base}.json`;
  for (let n = 2; existsSync(join(dir, name)); n++) name = `${base}-${n}.json`;
  copyFileSync(source, join(dir, name));
  return name;
}
