import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publishesHoldoutTable } from '../server/leadlag.ts';

test('a full, unscaled run is the published table', () => {
  assert.equal(publishesHoldoutTable({}), true);
  assert.equal(publishesHoldoutTable({ scale: '1' }), true);
});

test('--only narrows the question, so it never overwrites the table', () => {
  assert.equal(publishesHoldoutTable({ only: 'github' }), false);
});

test('--scale changes the question too', () => {
  assert.equal(publishesHoldoutTable({ scale: '100' }), false);
});
