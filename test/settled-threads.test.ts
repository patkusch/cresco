import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { settledThreads, THREAD_SETTLE_DAYS } from '../server/backfill-guard.ts';

const at = (iso: string) => ({ id: iso, created_at_i: Math.floor(Date.parse(iso) / 1000) });
const now = new Date('2026-11-04T12:00:00Z');

describe('settledThreads: a hiring thread only counts once it has finished filling', () => {
  test('a thread posted two days ago is still open', () => {
    const { settled, open } = settledThreads([at('2026-11-02T16:01:37Z'), at('2026-10-01T15:02:07Z')], now);
    assert.deepEqual(open.map((s) => s.id), ['2026-11-02T16:01:37Z']);
    assert.deepEqual(settled.map((s) => s.id), ['2026-10-01T15:02:07Z']);
  });

  test('a thread exactly the settle age old counts', () => {
    const edge = new Date(now.getTime() - THREAD_SETTLE_DAYS * 86_400_000).toISOString();
    assert.equal(settledThreads([at(edge)], now).settled.length, 1);
  });

  test('one second younger than the settle age does not', () => {
    const young = new Date(now.getTime() - THREAD_SETTLE_DAYS * 86_400_000 + 1000).toISOString();
    assert.equal(settledThreads([at(young)], now).open.length, 1);
  });

  test('keeps the input order of what it returns', () => {
    const input = [at('2026-10-01T15:00:00Z'), at('2026-09-01T15:00:00Z'), at('2026-08-01T15:00:00Z')];
    assert.deepEqual(settledThreads(input, now).settled, input);
  });
});
