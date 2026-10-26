import { test } from 'node:test';
import assert from 'node:assert/strict';

import { assertVaries } from '../server/collectors/edgar.ts';

test('a series that never changes is treated as a failure, not as flat data', () => {
  assert.throws(
    () => assertVaries('rust', { '2024-01': 500, '2024-02': 500, '2024-03': 500 }),
    /constant at 500 across 3 months.*all-time-count failure/s,
  );
});

test('the error names the skill so you know which series to check', () => {
  assert.throws(() => assertVaries('kubernetes', { a: 1, b: 1, c: 1, d: 1 }), /"kubernetes"/);
});

test('a series that moves at all is accepted', () => {
  assert.doesNotThrow(() => assertVaries('rust', { '2024-01': 500, '2024-02': 501, '2024-03': 500 }));
});

test('fewer than three months is too short to judge, so it is let through', () => {
  assert.doesNotThrow(() => assertVaries('rust', { '2024-01': 5 }));
  assert.doesNotThrow(() => assertVaries('rust', { '2024-01': 5, '2024-02': 5 }));
  assert.doesNotThrow(() => assertVaries('rust', {}));
});
