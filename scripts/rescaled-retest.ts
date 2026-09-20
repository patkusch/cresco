import 'dotenv/config';
import { loadLedger } from '../server/ledger.ts';
import { loadIndicators } from '../server/sources.ts';
import {
  REGISTRATION_CUTOFF,
  CANDIDATE_SOURCE,
  PRESPECIFIED_LAG,
  NULL_SHUFFLES,
  NULL_SEED,
  checkEligibility,
  runRescaledRetest,
} from '../server/rescaled-retest.ts';

/**
 * `npm run rescaled-retest`
 *
 * Runs the pre-registered retest documented in docs/PREREGISTERED.md — a
 * rescaled-growth re-analysis of GitHub topic-creation, gated so it can only
 * ever run against a real new month of hiring data collected after
 * 2026-08 by the backfill (`BACKFILL_MONTHS=<months held + 1> npm run backfill`;
 * the message it prints when not triggered gives the exact number). It refuses on the
 * existing Sep 2019 – Aug 2026 window, on purpose: that window was already
 * used to reject GitHub topic-creation, and testing this method against it
 * would be the same after-the-fact rescaling the pre-registration exists to
 * rule out.
 */

console.log(
  `Pre-registered retest — candidate: ${CANDIDATE_SOURCE} (topic-creation), rescaled growth, ` +
    `lag ${PRESPECIFIED_LAG} months, cutoff ${REGISTRATION_CUTOFF}.\nMethod: docs/PREREGISTERED.md\n`,
);

const ledger = loadLedger();
const eligibility = checkEligibility(ledger);

if (!eligibility.eligible) {
  console.error(eligibility.reason);
  console.error('\nThis is the correct, honest state until a real new month of hiring data exists. Not a result.');
  process.exit(1);
}

console.log(eligibility.reason, '\n');

const leading = loadIndicators();
const result = runRescaledRetest(leading, ledger, eligibility.newHiringMonths);

if (result.status === 'insufficient') {
  console.error(result.reason);
  process.exit(1);
}

console.log(`  observations (skill × new month):  ${result.n}`);
console.log(`  real r:                            ${result.realR >= 0 ? '+' : ''}${result.realR.toFixed(3)}`);
console.log(`  null median (${NULL_SHUFFLES} shuffles, seed ${NULL_SEED}): ${result.nullMedian >= 0 ? '+' : ''}${result.nullMedian.toFixed(3)}`);
console.log(`  share of nulls beating the real:   ${(result.beat * 100).toFixed(1)}%`);
console.log(`  → ${result.verdict}`);
