import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadHoldout } from '../server/pipeline.ts';

const withDir = (fn: (dir: string) => void) => {
  const dir = mkdtempSync(join(tmpdir(), 'cresco-holdout-'));
  try { fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('no saved holdout run means no card, not an error', () => withDir((d) => {
  assert.equal(loadHoldout(d), null);
}));

test('a broken file hides the card instead of breaking the dashboard', () => withDir((d) => {
  writeFileSync(join(d, 'holdout.json'), '{ not json');
  assert.equal(loadHoldout(d), null);
}));

test('reads what npm run holdout wrote', () => withDir((d) => {
  const table = { months: 74, from: '2020-09', to: '2026-10', sources: { npm: { skills: 12, lag: 9, holdoutR: -0.001, positiveSplits: 0.5, nullR: -0.025, nullsBeating: 0.335, verdict: 'DOES NOT SURVIVE' } } };
  writeFileSync(join(d, 'holdout.json'), JSON.stringify(table));
  assert.deepEqual(loadHoldout(d), table);
}));

test('the shipped data/holdout.json loads', () => {
  assert.ok((loadHoldout()?.months ?? 0) > 0);
});
