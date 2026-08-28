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
 * Run with `npm test` before trusting any number that came out of a backfill.
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

  // HTML from Hacker News comments must not create or destroy matches
  ['<p>We run <i>Kubernetes</i> in prod</p>', 'kubernetes', true],
];

let failed = 0;
for (const [text, skillId, want] of CASES) {
  const got = skillsMentionedIn(text).includes(skillId);
  if (got !== want) {
    failed++;
    console.error(`  FAIL  ${skillId.padEnd(22)} want ${String(want).padEnd(5)} got ${got}   "${text}"`);
  }
}

// Structural checks: a duplicate id or a shared alias silently merges two skills.
const ids = SKILLS.map((s) => s.id);
const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
if (dupes.length) { failed++; console.error(`  FAIL  duplicate skill ids: ${dupes.join(', ')}`); }

const owner = new Map<string, string>();
for (const s of SKILLS) {
  for (const a of [s.label, ...s.aliases].map((x) => x.toLowerCase())) {
    if (owner.has(a) && owner.get(a) !== s.id) {
      failed++;
      console.error(`  FAIL  alias "${a}" claimed by both ${owner.get(a)} and ${s.id}`);
    }
    owner.set(a, s.id);
  }
}

if (failed) {
  console.error(`\n${failed} failing · ${SKILLS.length} skills`);
  process.exit(1);
}
console.log(`all ${CASES.length} matcher cases pass · ${SKILLS.length} skills, no id or alias collisions`);
