import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONFERENCE_CATEGORIES,
  bucketByMonth,
  shareOf,
  assertVaries,
} from '../server/collectors/conference-programmes.ts';
import { SKILLS } from '../server/taxonomy.ts';

describe('conference-programmes collector guards', () => {
  test('entries are bucketed by the month of startDate, and clipped to range', () => {
    const entries = [
      { name: 'RustConf', startDate: '2024-05-14' },
      { name: 'RustConf', startDate: '2024-05-30' },
      { name: 'Rust Nation', startDate: '2024-02-01' },
      { name: 'Too early', startDate: '2019-01-01' },
      { name: 'No date' },
      { name: 'Bad date', startDate: 42 },
    ];
    const bucketed = bucketByMonth(entries as never, '2024-01', '2024-12');
    assert.deepEqual(bucketed, { '2024-05': 2, '2024-02': 1 });
  });

  test('share is per 1,000 conferences recorded that month, and skips months with no denominator', () => {
    const share = shareOf({ '2025-05': 3, '2025-06': 1 }, { '2025-05': 50, '2025-06': 20 });
    assert.equal(share['2025-05'], 60);
    assert.equal(share['2025-06'], 50);
    assert.ok(!('2025-07' in share));
  });

  test('a series that never moves is a failure, not a flat trend', () => {
    assert.throws(() => assertVaries('x', { a: 3, b: 3, c: 3 }), /constant at 3/);
    assert.doesNotThrow(() => assertVaries('x', { a: 3, b: 4, c: 3 }));
    assert.doesNotThrow(() => assertVaries('x', { a: 3, b: 3 }), 'too short to judge');
  });

  test('every mapped category belongs to a skill in the taxonomy, and no two skills share one', () => {
    const ids = new Set(SKILLS.map((s) => s.id));
    for (const skillId of Object.keys(CONFERENCE_CATEGORIES)) assert.ok(ids.has(skillId), `${skillId} is not a skill`);
    const categories = Object.values(CONFERENCE_CATEGORIES);
    assert.equal(new Set(categories).size, categories.length, 'a category mapped twice would double-count one series');
    for (const c of categories) assert.match(c, /^[a-z0-9-]+$/, `category ${c} is not a valid file stem`);
  });

  test('the ambiguous categories this dataset offers are deliberately left unmapped', () => {
    // "security" conflates appsec/cloud-security/detection-eng/zero-trust/supply-chain-sec;
    // "devops" and "data" are too broad for any one cresco skill. Mapping any of them would
    // repeat the exact mistake GITHUB_TOPICS avoided with short, ambiguous topic names.
    const mapped = new Set(Object.values(CONFERENCE_CATEGORIES));
    for (const ambiguous of ['security', 'devops', 'data', 'testing', 'api', 'iot', 'identity']) {
      assert.ok(!mapped.has(ambiguous), `${ambiguous} should stay unmapped — it is ambiguous, not a clean skill match`);
    }
  });
});
