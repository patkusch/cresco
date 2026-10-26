import { test } from 'node:test';
import assert from 'node:assert/strict';

import { daysAgoUnix, mapLimit } from '../server/collectors/http.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('results come back in the order of the input, whatever order the work finishes in', async () => {
  const out = await mapLimit([30, 5, 15, 1], 2, async (ms, i) => {
    await sleep(ms);
    return `${i}:${ms}`;
  });
  assert.deepEqual(out, ['0:30', '1:5', '2:15', '3:1']);
});

test('no more than the limit run at the same time', async () => {
  let running = 0;
  let peak = 0;
  await mapLimit(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
    running++;
    peak = Math.max(peak, running);
    await sleep(5);
    running--;
  });
  assert.equal(peak, 3);
});

test('a limit bigger than the list is fine, and an empty list gives an empty result', async () => {
  assert.deepEqual(await mapLimit([1, 2], 50, async (n) => n * 2), [2, 4]);
  assert.deepEqual(await mapLimit([], 4, async (n) => n), []);
});

test('every item is processed exactly once', async () => {
  const seen: number[] = [];
  await mapLimit([1, 2, 3, 4, 5], 2, async (n) => void seen.push(n));
  assert.deepEqual(seen.sort(), [1, 2, 3, 4, 5]);
});

test('daysAgoUnix is whole seconds, the right number of days back', () => {
  const now = Math.floor(Date.now() / 1000);
  const week = daysAgoUnix(7);
  assert.ok(Number.isInteger(week));
  assert.ok(Math.abs(now - 7 * 86_400 - week) <= 1);
});
