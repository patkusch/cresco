import { test } from 'node:test';
import assert from 'node:assert/strict';

import { marketAdjust, marketCoverage } from '../server/market.ts';
import type { MarketData } from '../server/collectors/hiringlab.ts';
import type { Ledger, Snapshot } from '../server/types.ts';

const market = (monthly: Record<string, number>): MarketData => ({
  source: 'test', attribution: 'test', sector: 'software', baseline: 'Feb 2020 = 100', monthly,
});

const snap = (ts: string): Snapshot => ({
  ts,
  sources: [],
  observations: [
    { skillId: 'rust', sourceId: 'jobs', sourceClass: 'hiring', metric: 'per 1,000 posts', value: 40 },
    { skillId: 'rust', sourceId: 'hn', sourceClass: 'community', metric: 'mentions', value: 7 },
  ],
});

const ledger = (months: string[]): Ledger => ({ version: 1, seeded: false, snapshots: months.map((m) => snap(`${m}-15T00:00:00Z`)), claims: [] });

test('hiring numbers are scaled by the market level, other kinds are left alone', () => {
  const out = marketAdjust(ledger(['2024-03']), market({ '2024-03': 50 }));
  const [hiring, community] = out.snapshots[0].observations;
  assert.equal(hiring.value, 20);
  assert.equal(hiring.metric, 'per 1,000 posts × market');
  assert.equal(community.value, 7);
  assert.equal(community.metric, 'mentions');
});

test('a month with no market reading is left exactly as it was', () => {
  const input = ledger(['2024-03', '2024-04']);
  const out = marketAdjust(input, market({ '2024-03': 50 }));
  assert.deepEqual(out.snapshots[1], input.snapshots[1]);
});

test('with no market data at all the ledger comes back unchanged', () => {
  const input = ledger(['2024-03']);
  assert.equal(marketAdjust(input, null), input);
});

test('adjusting does not change the ledger it was given', () => {
  const input = ledger(['2024-03']);
  marketAdjust(input, market({ '2024-03': 50 }));
  assert.equal(input.snapshots[0].observations[0].value, 40);
});

test('adjusted values are rounded to one decimal place', () => {
  const out = marketAdjust(ledger(['2024-03']), market({ '2024-03': 74 }));
  assert.equal(out.snapshots[0].observations[0].value, 29.6);
});

test('coverage counts the ledger months that the market series reaches', () => {
  const l = ledger(['2024-01', '2024-02', '2024-03']);
  assert.deepEqual(marketCoverage(l, market({ '2024-01': 100, '2024-03': 90 })), { covered: 2, total: 3 });
  assert.deepEqual(marketCoverage(l, null), { covered: 0, total: 3 });
});
