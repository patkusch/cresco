import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  REGISTRATION_CUTOFF,
  CANDIDATE_SOURCE,
  PRESPECIFIED_LAG,
  MIN_PAIRS,
  checkEligibility,
  hiringMonthsOf,
  rescaledGrowth,
  buildPairs,
  runRescaledRetest,
  verdictFor,
} from '../server/rescaled-retest.ts';
import { growth } from '../server/leadlag.ts';
import type { Ledger, Snapshot } from '../server/types.ts';
import type { LeadingData } from '../server/collectors/leading.ts';

/** A snapshot with one whoshiring observation for one skill. */
function snap(ts: string, skillId: string, value: number): Snapshot {
  return {
    ts: `${ts}-01T00:00:00.000Z`,
    sources: [{ id: 'whoshiring', sourceClass: 'hiring', live: true }],
    observations: [{ skillId, sourceId: 'whoshiring', sourceClass: 'hiring', metric: 'share', value }],
  };
}

function ledgerOf(snapshots: Snapshot[], seeded = false): Ledger {
  return { version: 1, seeded, snapshots, claims: [] };
}

describe('rescaled-retest gate — the pre-registration must refuse until real new data exists', () => {
  test('refuses a ledger that never gets past the registration cutoff', () => {
    const ledger = ledgerOf([snap('2026-06', 'rust', 10), snap('2026-07', 'rust', 11), snap('2026-08', 'rust', 12)]);
    const result = checkEligibility(ledger);
    assert.equal(result.eligible, false);
    assert.match(result.reason, /Not triggered yet/);
    assert.deepEqual(result.newHiringMonths, []);
  });

  test('refuses an empty ledger', () => {
    const result = checkEligibility(ledgerOf([]));
    assert.equal(result.eligible, false);
    assert.match(result.reason, /no snapshots/);
  });

  test('refuses a seeded/synthetic ledger even if its months look new', () => {
    const ledger = ledgerOf([snap('2026-09', 'rust', 10)], true);
    const result = checkEligibility(ledger);
    assert.equal(result.eligible, false);
    assert.match(result.reason, /seeded/);
  });

  test('runs once a real snapshot exists for a month after the cutoff', () => {
    const ledger = ledgerOf([snap('2026-08', 'rust', 12), snap('2026-09', 'rust', 13)]);
    const result = checkEligibility(ledger);
    assert.equal(result.eligible, true);
    assert.deepEqual(result.newHiringMonths, ['2026-09']);
  });

  test('a month exactly at the cutoff does not trigger it — only strictly after', () => {
    const ledger = ledgerOf([snap('2026-08', 'rust', 12)]);
    assert.equal(checkEligibility(ledger).eligible, false);
  });

  test('several new months are all reported', () => {
    const ledger = ledgerOf([snap('2026-09', 'rust', 1), snap('2026-10', 'rust', 2), snap('2026-11', 'rust', 3)]);
    const result = checkEligibility(ledger);
    assert.equal(result.eligible, true);
    assert.deepEqual(result.newHiringMonths, ['2026-09', '2026-10', '2026-11']);
  });

  test('hiringMonthsOf is sorted and deduplicated', () => {
    const ledger = ledgerOf([snap('2026-08', 'rust', 1), snap('2026-06', 'go', 2), snap('2026-08', 'go', 3)]);
    assert.deepEqual(hiringMonthsOf(ledger), ['2026-06', '2026-08']);
  });

  test('the cutoff and candidate match what docs/PREREGISTERED.md names', () => {
    assert.equal(REGISTRATION_CUTOFF, '2026-08');
    assert.equal(CANDIDATE_SOURCE, 'github');
    assert.equal(PRESPECIFIED_LAG, 3);
  });
});

describe('rescaledGrowth — keeps the low-share months the standard growth step drops', () => {
  test('a share below 1 is dropped by growth() but kept by rescaledGrowth()', () => {
    const series = { '2026-03': 0.4, '2026-06': 0.6 };
    assert.equal(growth(series, '2026-06'), null, 'the existing growth() treats under-1 as unsafe to divide');
    assert.ok(Math.abs(rescaledGrowth(series, '2026-06')! - 0.5) < 1e-9, '(0.6 - 0.4) / 0.4');
  });

  test('still refuses to divide by an actual zero', () => {
    assert.equal(rescaledGrowth({ '2026-03': 0, '2026-06': 5 }, '2026-06'), null);
  });

  test('missing months stay null, same as growth()', () => {
    assert.equal(rescaledGrowth({ '2026-06': 5 }, '2026-06'), null, 'no 3-months-earlier value to divide against');
  });

  test('agrees with growth() whenever the base is already >= 1', () => {
    const series = { '2026-03': 10, '2026-06': 15 };
    assert.equal(rescaledGrowth(series, '2026-06'), growth(series, '2026-06'));
  });
});

describe('runRescaledRetest — only ever computed from the months the caller marks as new', () => {
  const SKILLS = Array.from({ length: 10 }, (_, i) => `skill-${i}`);

  function fixture(): { leading: LeadingData; ledger: Ledger } {
    const leading: LeadingData = { months: [], series: {}, resolved: [], missing: [] };
    const snapshots: Snapshot[] = [];
    SKILLS.forEach((id, i) => {
      // GitHub lead series: value at the lag-3 month (2026-06) and the month 3 before that (2026-03),
      // deliberately under the old growth() floor of 1 to prove the rescale is what makes this runnable.
      leading.series[id] = { github: { '2026-03': 0.2 + i * 0.05, '2026-06': 0.3 + i * 0.09 } };
      // Hiring: baseline at 2026-06 and the new month 2026-09, loosely tracking the lead series.
      snapshots.push(snap('2026-06', id, 20 + i));
      snapshots.push(snap('2026-09', id, 20 + i * 2));
    });
    return { leading, ledger: ledgerOf(snapshots) };
  }

  test('buildPairs only uses the given new months, and pairs the pre-specified lag', () => {
    const { leading, ledger } = fixture();
    const pairs = buildPairs(leading, { 'skill-0': { '2026-06': 20, '2026-09': 25 } }, ['2026-09'], ['skill-0']);
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0].month, '2026-09');
    // leadGrowth is rescaledGrowth of the github series 3 months before 2026-09, i.e. at 2026-06.
    assert.equal(pairs[0].leadGrowth, rescaledGrowth(leading.series['skill-0'].github, '2026-06'));
  });

  test('reports "insufficient" rather than a fabricated correlation when pairs are too few', () => {
    const { leading, ledger } = fixture();
    const eligibility = checkEligibility(ledger);
    assert.equal(eligibility.eligible, true);
    // Only one skill's worth of overlap — well under MIN_PAIRS.
    const thin: LeadingData = { months: [], series: { 'skill-0': leading.series['skill-0'] }, resolved: [], missing: [] };
    const result = runRescaledRetest(thin, ledger, eligibility.newHiringMonths);
    assert.equal(result.status, 'insufficient');
    assert.ok(result.n < MIN_PAIRS);
  });

  test('runs and returns a verdict once there are enough pairs, using only the eligible new months', () => {
    const { leading, ledger } = fixture();
    const eligibility = checkEligibility(ledger);
    assert.deepEqual(eligibility.newHiringMonths, ['2026-09']);
    const result = runRescaledRetest(leading, ledger, eligibility.newHiringMonths);
    assert.equal(result.status, 'ran');
    if (result.status === 'ran') {
      assert.equal(result.n, SKILLS.length);
      assert.ok(Number.isFinite(result.realR));
      assert.ok(result.beat >= 0 && result.beat <= 1);
      assert.ok(['SURVIVES', 'WEAK', 'DOES NOT SURVIVE'].includes(result.verdict));
    }
  });

  test('never pulls in a month the caller did not mark as new — asking for [] finds nothing', () => {
    const { leading, ledger } = fixture();
    const result = runRescaledRetest(leading, ledger, []);
    assert.equal(result.status, 'insufficient');
    assert.equal(result.n, 0);
  });
});

describe('verdictFor mirrors the standing thresholds in scripts/holdout.ts', () => {
  test('survives only under the 5%-luck floor with a real correlation', () => {
    assert.equal(verdictFor(0.2, 0.03), 'SURVIVES');
    assert.equal(verdictFor(0.2, 0.06), 'WEAK');
  });
  test('weak sits between the two floors', () => {
    assert.equal(verdictFor(0.12, 0.15), 'WEAK');
  });
  test('everything else does not survive', () => {
    assert.equal(verdictFor(0.05, 0.3), 'DOES NOT SURVIVE');
    assert.equal(verdictFor(-0.1, 0.5), 'DOES NOT SURVIVE');
  });
});
