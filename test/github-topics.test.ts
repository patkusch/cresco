import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseSearch, shareOf, assertVaries, GITHUB_TOPICS } from '../server/collectors/github-topics.ts';
import { SKILLS } from '../server/taxonomy.ts';

describe('GitHub topic collector guards', () => {
  test('an incomplete search is refused, not read as a small number', () => {
    // This is what a timed-out search looks like: a 200 with whatever it had counted.
    assert.equal(parseSearch({ status: 200, body: { total_count: 0, incomplete_results: true } }), null);
    assert.equal(parseSearch({ status: 200, body: { total_count: 17, incomplete_results: true } }), null);
    assert.equal(parseSearch({ status: 200, body: { total_count: 17, incomplete_results: false } }), 17);
    assert.equal(parseSearch({ status: 200, body: { total_count: 0, incomplete_results: false } }), 0);
  });

  test('a failed or rate-limited request is null, never zero', () => {
    assert.equal(parseSearch({ status: 403, body: { total_count: 0 } }), null);
    assert.equal(parseSearch({ status: 429, body: null }), null);
    assert.equal(parseSearch({ status: 0, body: null }), null);
    assert.equal(parseSearch({ status: 200, body: { total_count: 'many' } }), null);
  });

  test('share is per 10,000 repos created in the same month, and skips months with no denominator', () => {
    const share = shareOf({ '2025-05': 839, '2025-06': 900, '2025-07': 5 }, { '2025-05': 4_976_103, '2025-06': 4_500_000 });
    assert.equal(share['2025-05'], 1.69);
    assert.equal(share['2025-06'], 2);
    assert.ok(!('2025-07' in share));
  });

  test('a series that never moves is a failure, not a flat trend', () => {
    assert.throws(() => assertVaries('x', { a: 3, b: 3, c: 3 }), /constant at 3/);
    assert.doesNotThrow(() => assertVaries('x', { a: 3, b: 4, c: 3 }));
    assert.doesNotThrow(() => assertVaries('x', { a: 3, b: 3 }), 'too short to judge');
  });

  test('every mapped topic belongs to a skill in the taxonomy, and no two skills share one', () => {
    const ids = new Set(SKILLS.map((s) => s.id));
    for (const skillId of Object.keys(GITHUB_TOPICS)) assert.ok(ids.has(skillId), `${skillId} is not a skill`);
    const topics = Object.values(GITHUB_TOPICS);
    assert.equal(new Set(topics).size, topics.length, 'a topic mapped twice would double-count one series');
    for (const t of topics) assert.match(t, /^[a-z0-9-]+$/, `topic ${t} is not a valid GitHub topic`);
  });
});
