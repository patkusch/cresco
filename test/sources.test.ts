import { test } from 'node:test';
import assert from 'node:assert/strict';

import { availableSources, loadIndicators } from '../server/sources.ts';
import type { LeadingData } from '../server/collectors/leading.ts';

test('available sources are listed once each, in order, across all skills', () => {
  const data: LeadingData = {
    months: ['2024-01'],
    series: {
      rust: { stars: { '2024-01': 1 }, jobs: { '2024-01': 2 } },
      go: { stars: { '2024-01': 3 }, edgar: { '2024-01': 4 } },
    },
    resolved: [],
    missing: [],
  };
  assert.deepEqual(availableSources(data), ['edgar', 'jobs', 'stars']);
});

test('no series means no sources', () => {
  assert.deepEqual(availableSources({ months: [], series: {}, resolved: [], missing: [] }), []);
});

test('files that do not exist are skipped, leaving an empty set', () => {
  const merged = loadIndicators(['does-not-exist.json', 'nor-this.json']);
  assert.deepEqual(merged, { months: [], series: {}, resolved: [], missing: [] });
});
