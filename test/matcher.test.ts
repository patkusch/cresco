import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { skillsMentionedIn, SKILLS } from '../server/taxonomy.ts';

/**
 * Regression tests for skill matching.
 *
 * This is the bug class that has bitten this project more than any other: a
 * matcher that quietly counts the wrong thing produces a confident, plausible,
 * completely fabricated trend. "RAG" once matched 464 conference talks that were
 * really about *storage* and *fragments*; "Ready to go now" counted as demand for
 * Go. Both would have shown up as clean rising curves.
 *
 * Every case here is a real defect that shipped, not a hypothetical. Ported from
 * `scripts/test-matcher.ts` so the runner reports them individually.
 */

const CASES: [text: string, skillId: string, shouldMatch: boolean][] = [
  // `\b` does not work next to + or #, so these need lookaround boundaries
  ['We need a C++ engineer', 'cpp', true],
  ['Stack: C/C++, Rust', 'cpp', true],
  ['A c-suite exec role', 'cpp', false],
  ['Backend in C# and .NET', 'csharp', true],
  ['We use ASP.NET Core', 'csharp', true],

  // Slashes separate stack items; treating them as part of the token loses the match
  ['Go/Golang backend', 'go', true],
  ['We use React/Vue', 'react', true],

  // Substring collisions — the 464-vs-6 failure
  ['Storage and fragment handling', 'rag', false],
  ['We use RAG pipelines', 'rag', true],

  // Technology names that are also ordinary English words: capitalised only
  ['Ready to go now', 'go', false],
  ['we react to incidents quickly', 'react', false],
  ['spark innovation across teams', 'spark', false],
  ['a swift response to customers', 'swift', false],
  ['our azure blue branding', 'azure', false],
  ['flutter of activity', 'cross-platform-mobile', false],
  ['We use React and Vue', 'react', true],
  ['ETL with Spark and Airflow', 'spark', true],
  ['iOS in Swift and SwiftUI', 'swift', true],
  ['deployed on Azure', 'azure', true],
  ['built with Flutter', 'cross-platform-mobile', true],

  // Alias collisions found by audit once the taxonomy reached 64 skills
  ['a lambda function in Python', 'aws', false],
  ['we deploy on AWS Lambda', 'aws', true],
  ['Strong IAM and least privilege on AWS', 'zero-trust', false],
  ['we run a Zero Trust network', 'zero-trust', true],
  ['writing ts and py scripts', 'typescript', false],
  ['a TypeScript monorepo', 'typescript', true],

  // HTML from Hacker News comments must not create or destroy matches
  ['<p>We run <i>Kubernetes</i> in prod</p>', 'kubernetes', true],
];

describe('skillsMentionedIn', () => {
  for (const [text, skillId, want] of CASES) {
    const verb = want ? 'matches' : 'does not match';
    test(`${skillId} ${verb} ${JSON.stringify(text)}`, () => {
      assert.equal(
        skillsMentionedIn(text).includes(skillId),
        want,
        `expected ${skillId} ${want ? 'to match' : 'not to match'} ${JSON.stringify(text)}`,
      );
    });
  }

  test('returns no duplicate skill ids for repeated mentions', () => {
    const got = skillsMentionedIn('React and React and more React, plus React');
    assert.equal(new Set(got).size, got.length, `duplicates in ${JSON.stringify(got)}`);
  });

  test('empty and whitespace input match nothing', () => {
    assert.deepEqual(skillsMentionedIn(''), []);
    assert.deepEqual(skillsMentionedIn('   \n\t '), []);
  });
});

/**
 * Structural invariants of the taxonomy itself.
 *
 * A duplicate id or a shared alias silently merges two skills — the counts add
 * together and nothing anywhere reports an error. These are the checks that
 * caught the lambda/AWS and IAM/zero-trust collisions.
 */
describe('taxonomy structure', () => {
  test('skill ids are unique', () => {
    const ids = SKILLS.map((s) => s.id);
    const dupes = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
    assert.deepEqual(dupes, [], `duplicate skill ids: ${dupes.join(', ')}`);
  });

  test('no alias or label is claimed by two skills', () => {
    const owner = new Map<string, string>();
    const collisions: string[] = [];
    for (const s of SKILLS) {
      for (const a of [s.label, ...s.aliases].map((x) => x.toLowerCase())) {
        const prev = owner.get(a);
        if (prev && prev !== s.id) collisions.push(`"${a}" claimed by both ${prev} and ${s.id}`);
        owner.set(a, s.id);
      }
    }
    assert.deepEqual(collisions, [], collisions.join('; '));
  });

  test('every skill has at least one query', () => {
    const empty = SKILLS.filter((s) => !s.queries.length).map((s) => s.id);
    assert.deepEqual(empty, [], `skills with no queries: ${empty.join(', ')}`);
  });

  test('every skill matches its own label', () => {
    // If a skill cannot match the very string it is named after, its alias
    // patterns are wrong and it will read as zero demand forever.
    const broken = SKILLS.filter((s) => !skillsMentionedIn(s.label).includes(s.id)).map((s) => s.id);
    assert.deepEqual(broken, [], `skills that do not match their own label: ${broken.join(', ')}`);
  });
});
