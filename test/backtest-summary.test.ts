import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backtestSummary } from '../server/backtest-summary.ts';
import type { Claim, Ledger } from '../server/types.ts';

const ledger: Ledger = {
  version: 1,
  seeded: false,
  snapshots: ['2026-01-01T15:00:00Z', '2026-02-01T15:00:00Z', '2026-03-01T15:00:00Z'].map((ts) => ({ ts, sources: [], observations: [] })),
  claims: [],
};
const claim = (outcome?: Claim['outcome']) => ({ verdict: 'rising', outcome } as Claim);

test('counts graded and open calls and the hit rate', () => {
  const s = backtestSummary(ledger, [claim('correct'), claim('wrong'), claim('partial'), claim('correct'), claim()]);
  assert.equal(s.months, 3);
  assert.equal(s.from, '2026-01');
  assert.equal(s.to, '2026-03');
  assert.deepEqual([s.graded, s.open, s.correct, s.wrong, s.partial], [4, 1, 2, 1, 1]);
  assert.equal(s.rate, 50);
});

test('no graded calls gives a null rate, not 0%', () => {
  assert.equal(backtestSummary(ledger, [claim()]).rate, null);
});

test('carries no timestamp, so an unchanged replay writes an identical file', () => {
  const a = JSON.stringify(backtestSummary(ledger, [claim('correct')]));
  const b = JSON.stringify(backtestSummary(ledger, [claim('correct')]));
  assert.equal(a, b);
  assert.doesNotMatch(a, /generatedAt|"now"/);
});
