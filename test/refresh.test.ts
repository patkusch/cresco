import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { REFRESH_STEPS, runSteps } from '../server/refresh.ts';

describe('npm run refresh: order and stop rule', () => {
  test('adds months before grading, and grades before the retest', () => {
    const order = REFRESH_STEPS.map((s) => s.script);
    assert.ok(order.indexOf('backfill') < order.indexOf('backtest'));
    assert.ok(order.indexOf('backtest') < order.indexOf('rescaled-retest'));
  });

  test('re-tests every indicator after the new months are in', () => {
    const order = REFRESH_STEPS.map((s) => s.script);
    assert.ok(order.indexOf('backfill') < order.indexOf('holdout'));
  });

  test('backfill always runs with --extend, never a hand-typed month count', () => {
    assert.deepEqual(REFRESH_STEPS.find((s) => s.script === 'backfill')!.args, ['--extend']);
  });

  test('only the retest may fail: it exits 1 while it waits for data', () => {
    assert.deepEqual(REFRESH_STEPS.filter((s) => s.mayFail).map((s) => s.script), ['rescaled-retest']);
  });

  test('a failed backfill stops the run, so nothing is graded on a half-written ledger', () => {
    const r = runSteps(REFRESH_STEPS, (s) => (s.script === 'backfill' ? 1 : 0));
    assert.deepEqual(r.map((x) => [x.script, x.skipped ?? false]), [
      ['backfill', false], ['backtest', true], ['holdout', true], ['chart', true], ['rescaled-retest', true],
    ]);
  });

  test('a waiting retest does not turn the run into a failure', () => {
    const r = runSteps(REFRESH_STEPS, (s) => (s.script === 'rescaled-retest' ? 1 : 0));
    assert.ok(r.every((x) => !x.skipped));
  });
});
