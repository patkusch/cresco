import type { Claim, Ledger, Snapshot } from '../../server/types.ts';

/**
 * Snapshots shaped like the ones the scripts really write, so the guards are
 * tested on the thing they actually read: which observations are flagged fixture.
 */

const obs = (fixture: boolean) => ({
  skillId: 'python',
  sourceId: fixture ? 'adzuna' : 'whoshiring',
  sourceClass: 'hiring' as const,
  metric: 'x',
  value: 10,
  ...(fixture ? { fixture: true } : {}),
});

/** One week of `npm run seed` output: every number flagged fixture, every source not live. */
export const seededWeek = (i: number): Snapshot => ({
  ts: new Date(Date.UTC(2026, 6, 1 + 7 * i, 12)).toISOString(),
  sources: [{ id: 'adzuna', sourceClass: 'hiring', live: false, note: 'seeded' }],
  observations: [obs(true), obs(true)],
});

/**
 * One month of real data, as `npm run backfill` or `npm run collect` writes it.
 * `withFixtures` adds the keyless fallback numbers a collect run carries next to
 * its real ones (an Adzuna table with no key), which are flagged fixture.
 */
export const realMonth = (i: number, withFixtures = false): Snapshot => ({
  ts: new Date(Date.UTC(2026, i, 1, 15)).toISOString(),
  sources: [{ id: 'whoshiring', sourceClass: 'hiring', live: true }],
  observations: [obs(false), ...(withFixtures ? [obs(true)] : [])],
});

/** A call minted while sample data was scoring; a real ledger must not inherit it. */
export const SAMPLE_CLAIM_ID = 'python-rising-sample';
const sampleClaim = (): Claim => ({
  id: SAMPLE_CLAIM_ID,
  skillId: 'python',
  verdict: 'rising',
  statement: 'made from sample data',
  confidence: 0,
  demandIndex: 50,
  signalToNoise: 0.5,
  createdAt: '2026-08-01T00:00:00.000Z',
  checkBackAt: '2026-11-01T00:00:00.000Z',
  evidence: [],
});

export const ledgerFrom = (snapshots: Snapshot[], seeded: boolean): Ledger => ({ version: 1, seeded, snapshots, claims: [] });

/** A ledger flagged seeded that holds only sample data. */
export const seededLedger = (weeks = 8): Ledger => ({
  ...ledgerFrom(Array.from({ length: weeks }, (_, i) => seededWeek(i)), true),
  claims: [sampleClaim()],
});

/**
 * What `npm run collect` used to leave behind: a seeded ledger that had since
 * gained `realMonths` real snapshots on the end.
 */
export const seededLedgerWithReal = (weeks = 8, realMonths = 1): Ledger => ({
  ...ledgerFrom(
    [...Array.from({ length: weeks }, (_, i) => seededWeek(i)), ...Array.from({ length: realMonths }, (_, i) => realMonth(8 + i, true))],
    true,
  ),
  claims: [sampleClaim()],
});
