import type { Ledger } from './types.ts';
import type { LeadingData } from './collectors/leading.ts';
import { WINDOW, addMonths, hiringByMonth, pearson, mulberry32, shuffled } from './leadlag.ts';

/**
 * Pre-registered rescaled retest — GitHub topic-creation, rescaled growth.
 *
 * Full method and trigger condition: `docs/PREREGISTERED.md`, written
 * 2026-09-16, before any hiring month after August 2026 existed. Every
 * constant below is copied from that file; nothing here may be tuned once new
 * data starts arriving without breaking the pre-registration it implements.
 *
 * This module holds only pure functions (the eligibility gate and the
 * rescaled analysis), so the gate can be unit-tested against fabricated
 * ledgers without needing real new data to exist. `scripts/rescaled-retest.ts`
 * does the I/O: load the real ledger and indicators, call these, print the
 * result.
 */

/** Last month already analysed and rejected for GitHub topic-creation (see README.md, docs/RESEARCH.md). */
export const REGISTRATION_CUTOFF = '2026-08';

/** The one candidate this file pre-registers a retest for. */
export const CANDIDATE_SOURCE = 'github';

/**
 * Fixed now, not re-chosen when new data arrives. This is the lag the
 * project already published from the post-hoc check on OLD data
 * (`npm run holdout -- --only=github --scale=100`, 2026-09-15): best lag 3
 * months. Re-deriving a "better" lag from new data would be fitting on the
 * test set; reusing an already-published number computed on already-seen
 * data is not a new researcher degree of freedom.
 */
export const PRESPECIFIED_LAG = 3;

/** Null-distribution shuffles and the fixed seed, chosen today, not tuned. */
export const NULL_SHUFFLES = 2000;
export const NULL_SEED = 20260916;

/** Same standing thresholds as `scripts/holdout.ts`, and the project's "anything above 5% is luck" rule from README.md. */
export const SURVIVE_BEAT = 0.05;
export const SURVIVE_R = 0.15;
export const WEAK_BEAT = 0.2;
export const WEAK_R = 0.1;

export const MIN_PAIRS = 8;

export interface EligibilityResult {
  eligible: boolean;
  reason: string;
  newHiringMonths: string[];
}

/** All distinct months with a snapshot in the ledger, sorted. */
export function hiringMonthsOf(ledger: Ledger): string[] {
  return [...new Set(ledger.snapshots.map((s) => s.ts.slice(0, 7)))].sort();
}

/**
 * How to collect the next month. A plain `npm run backfill` fetches 8 months and
 * the backfill refuses to shrink a real ledger, so the count has to be asked for:
 * one more than the ledger holds today. The message is built from the ledger, not
 * hard-coded, so it stays right as months are added.
 */
export function collectInstruction(monthsHeld: number): string {
  if (monthsHeld === 0) {
    return 'The ledger is empty. Build it with `BACKFILL_MONTHS=<how many months of history you want> npm run backfill`.';
  }
  return (
    `To collect the next month, ask the backfill for one more month than the ledger holds (${monthsHeld} now):\n` +
    `  BACKFILL_MONTHS=${monthsHeld + 1} npm run backfill\n` +
    `Plain \`npm run backfill\` fetches only 8 months and refuses to shorten the ledger. ` +
    `When it finishes, check that the newest month is after ${REGISTRATION_CUTOFF}, then run this again.`
  );
}

/**
 * The trigger condition from docs/PREREGISTERED.md: refuse unless the ledger
 * is a real (non-seeded) backfill AND it has at least one snapshot for a
 * calendar month after REGISTRATION_CUTOFF. Never falls back to running the
 * test on the old window — a caller must treat `eligible: false` as "there is
 * nothing to report yet," not as a signal to substitute old data.
 */
export function checkEligibility(ledger: Ledger): EligibilityResult {
  if (ledger.seeded) {
    return {
      eligible: false,
      reason: 'The ledger is seeded/synthetic data (npm run seed), not a real backfill. Refusing to run the pre-registered retest against it.',
      newHiringMonths: [],
    };
  }

  const months = hiringMonthsOf(ledger);
  const newHiringMonths = months.filter((m) => m > REGISTRATION_CUTOFF);

  if (!newHiringMonths.length) {
    return {
      eligible: false,
      reason:
        `Not triggered yet. docs/PREREGISTERED.md fires only once data/ledger.json has real hiring data for a ` +
        `calendar month after ${REGISTRATION_CUTOFF}, collected by the backfill — not a ` +
        `re-analysis of the Sep 2019 – Aug 2026 window already used to reject GitHub topic-creation. The ` +
        `ledger's most recent month is ${months.at(-1) ?? '(no snapshots)'}.\n${collectInstruction(months.length)}\n` +
        `Refusing to run.`,
      newHiringMonths: [],
    };
  }

  return {
    eligible: true,
    reason: `Triggered: ${newHiringMonths.length} new month(s) past ${REGISTRATION_CUTOFF} — ${newHiringMonths.join(', ')}.`,
    newHiringMonths,
  };
}

/**
 * The rescaled growth step from docs/PREREGISTERED.md. Identical to
 * `growth()` in server/leadlag.ts except the unsafe-to-divide guard: the
 * original drops any month whose starting share is below 1 (a near-empty
 * guard for a series stored per 1,000, but one that silently deletes most
 * months of a series stored per 10,000). This version keeps any positive
 * starting share and drops a month only when dividing by zero would be
 * undefined.
 */
export function rescaledGrowth(series: Record<string, number>, m: string): number | null {
  const now = series[m];
  const before = series[addMonths(m, -WINDOW)];
  if (now === undefined || before === undefined || before <= 0) return null;
  return (now - before) / before;
}

export type Verdict = 'SURVIVES' | 'WEAK' | 'DOES NOT SURVIVE';

export function verdictFor(realR: number, beat: number): Verdict {
  if (beat < SURVIVE_BEAT && realR > SURVIVE_R) return 'SURVIVES';
  if (beat < WEAK_BEAT && realR > WEAK_R) return 'WEAK';
  return 'DOES NOT SURVIVE';
}

export interface RescaledPair {
  skillId: string;
  month: string;
  leadGrowth: number;
  hiringGrowth: number;
}

/**
 * Build the (github growth, hiring growth) pairs for the pre-registered test:
 * hiring growth at each month in `newHiringMonths` only (never an old month),
 * paired against GitHub growth PRESPECIFIED_LAG months earlier — which may
 * fall inside the already-collected window, since only the hiring value being
 * predicted has to be new. `shuffleMap` reassigns which skill's hiring a
 * skill's GitHub growth is paired against, for building the null.
 */
export function buildPairs(
  leading: LeadingData,
  hiring: Record<string, Record<string, number>>,
  newHiringMonths: string[],
  skills: string[],
  shuffleMap?: Record<string, string>,
): RescaledPair[] {
  const pairs: RescaledPair[] = [];
  for (const skillId of skills) {
    const lead = leading.series[skillId]?.[CANDIDATE_SOURCE];
    const targetSkill = shuffleMap?.[skillId] ?? skillId;
    const hire = hiring[targetSkill];
    if (!lead || !hire) continue;
    for (const m of newHiringMonths) {
      const hiringGrowth = rescaledGrowth(hire, m);
      const leadGrowth = rescaledGrowth(lead, addMonths(m, -PRESPECIFIED_LAG));
      if (hiringGrowth === null || leadGrowth === null) continue;
      pairs.push({ skillId, month: m, leadGrowth, hiringGrowth });
    }
  }
  return pairs;
}

export interface RescaledResult {
  status: 'ran';
  n: number;
  realR: number;
  beat: number;
  nullMedian: number;
  verdict: Verdict;
}

export interface InsufficientResult {
  status: 'insufficient';
  n: number;
  reason: string;
}

/**
 * Run the pre-registered test itself. Caller must have already confirmed
 * `checkEligibility(ledger).eligible` — this function does not re-check it,
 * so it can also be exercised directly in tests against fabricated series.
 */
export function runRescaledRetest(leading: LeadingData, ledger: Ledger, newHiringMonths: string[]): RescaledResult | InsufficientResult {
  const hiring = hiringByMonth(ledger);
  const skills = Object.keys(leading.series).filter((s) => leading.series[s][CANDIDATE_SOURCE] && hiring[s]);

  const real = buildPairs(leading, hiring, newHiringMonths, skills);
  if (real.length < MIN_PAIRS) {
    return {
      status: 'insufficient',
      n: real.length,
      reason:
        `Eligible, but only ${real.length} (skill, month) observation(s) overlap between the new hiring month(s) ` +
        `and the collected GitHub topic-creation series — fewer than the ${MIN_PAIRS} pearson() requires. This ` +
        `is "not enough data yet," not a result. Re-run after more new months accumulate.`,
    };
  }

  const realR = pearson(real.map((p) => [p.leadGrowth, p.hiringGrowth]));
  if (realR === null) {
    return { status: 'insufficient', n: real.length, reason: 'pearson() could not compute a correlation from the available pairs.' };
  }

  const rand = mulberry32(NULL_SEED);
  const nullRs: number[] = [];
  for (let i = 0; i < NULL_SHUFFLES; i++) {
    const targets = shuffled(skills, rand);
    const map: Record<string, string> = {};
    skills.forEach((s, k) => (map[s] = targets[k]));
    const nullPairs = buildPairs(leading, hiring, newHiringMonths, skills, map);
    const r = nullPairs.length >= MIN_PAIRS ? pearson(nullPairs.map((p) => [p.leadGrowth, p.hiringGrowth])) : null;
    if (r !== null) nullRs.push(r);
  }

  const sortedNulls = [...nullRs].sort((a, b) => a - b);
  const nullMedian = sortedNulls.length
    ? sortedNulls.length % 2
      ? sortedNulls[(sortedNulls.length - 1) / 2]
      : (sortedNulls[sortedNulls.length / 2 - 1] + sortedNulls[sortedNulls.length / 2]) / 2
    : NaN;
  const beat = nullRs.length ? nullRs.filter((n) => n >= realR).length / nullRs.length : NaN;

  return { status: 'ran', n: real.length, realR, beat, nullMedian, verdict: verdictFor(realR, beat) };
}
