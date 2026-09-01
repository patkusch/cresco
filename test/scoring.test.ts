import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { scoreClaim, accuracyByVerdict } from '../server/scoring.ts';
import type { Claim, SkillSignal, Verdict } from '../server/types.ts';

/**
 * Properties the grader must satisfy, not examples of it working.
 *
 * Cresco's entire claim on a reader's attention is that it grades its own
 * predictions and publishes the score. That makes the grader the one module where
 * a bug is indistinguishable from dishonesty: a rule that can only ever return
 * `correct` inflates the published hit rate, and nothing in the output looks
 * wrong. `scoring.ts` says so itself — "a scoring rule that cannot fail is not a
 * scoring rule, it is decoration."
 *
 * So these tests assert the falsifiability directly rather than trusting the
 * comment, and they explore the input space with a seeded generator instead of
 * hand-picked cases that could all sit on the same side of a threshold.
 */

/** Deterministic PRNG — property tests that fail differently each run are useless. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const VERDICTS: Verdict[] = ['rising', 'cooling', 'table-stakes', 'hype'];

function claim(verdict: Verdict, demandIndex: number, signalToNoise = 0.5): Claim {
  return {
    id: `${verdict}-${demandIndex}`,
    skillId: 'test-skill',
    verdict,
    statement: 'test',
    confidence: 0,
    demandIndex,
    signalToNoise,
    createdAt: '2026-01-01T00:00:00.000Z',
    checkBackAt: '2026-04-01T00:00:00.000Z',
    evidence: [],
  };
}

function then(demandIndex: number, signalToNoise = 0.5): SkillSignal {
  return {
    skill: { id: 'test-skill', label: 'Test', category: 'test', aliases: [], queries: [] },
    demandIndex,
    momentum: 0,
    signalToNoise,
    verdict: 'baseline',
    substance: 0,
    chatter: 0,
    history: [],
    byClass: { hiring: 0, practitioner: 0, community: 0, content: 0, vendor: 0 },
    evidence: [],
    path: [],
  };
}

describe('scoreClaim — falsifiability', () => {
  // The headline property. If any verdict cannot produce `wrong`, the published
  // hit rate for that verdict is meaningless.
  for (const verdict of VERDICTS) {
    test(`${verdict} can be graded wrong`, () => {
      const outcomes = new Set<string>();
      const rand = rng(42);
      for (let i = 0; i < 4000; i++) {
        const was = 1 + Math.floor(rand() * 100);
        const now = Math.floor(rand() * 200);
        const snrWas = Math.round(rand() * 100) / 100;
        const snrNow = Math.round(rand() * 100) / 100;
        outcomes.add(scoreClaim(claim(verdict, was, snrWas), then(now, snrNow)).outcome);
      }
      assert.ok(
        outcomes.has('wrong'),
        `${verdict} never returned "wrong" across 4000 random outcomes — it cannot fail, so its hit rate is decoration`,
      );
    });

    test(`${verdict} can be graded correct`, () => {
      const outcomes = new Set<string>();
      const rand = rng(7);
      for (let i = 0; i < 4000; i++) {
        const was = 1 + Math.floor(rand() * 100);
        const now = Math.floor(rand() * 200);
        outcomes.add(
          scoreClaim(claim(verdict, was, Math.round(rand() * 100) / 100), then(now, Math.round(rand() * 100) / 100))
            .outcome,
        );
      }
      assert.ok(outcomes.has('correct'), `${verdict} never returned "correct" — the rule is unsatisfiable`);
    });
  }

  test('every outcome is one of the three declared values, and the note is never empty', () => {
    const rand = rng(99);
    for (let i = 0; i < 5000; i++) {
      const verdict = VERDICTS[Math.floor(rand() * VERDICTS.length)];
      const r = scoreClaim(
        claim(verdict, 1 + Math.floor(rand() * 100), Math.round(rand() * 100) / 100),
        then(Math.floor(rand() * 200), Math.round(rand() * 100) / 100),
      );
      assert.ok(['correct', 'wrong', 'partial'].includes(r.outcome), `bad outcome ${r.outcome}`);
      assert.ok(r.note.length > 0, 'a grade with no stated reason is not auditable');
    }
  });

  test('an unknown verdict is never scored correct', () => {
    // `baseline` means "no call was made". Grading it correct would credit the
    // system for predictions it declined to make.
    const r = scoreClaim(claim('baseline' as Verdict, 50), then(999));
    assert.notEqual(r.outcome, 'correct');
  });
});

describe('scoreClaim — direction', () => {
  test('rising is correct when the index climbs past the noise floor', () => {
    assert.equal(scoreClaim(claim('rising', 100), then(106)).outcome, 'correct');
  });

  test('rising is wrong when the index falls', () => {
    assert.equal(scoreClaim(claim('rising', 100), then(94)).outcome, 'wrong');
  });

  test('rising is partial when the index goes flat', () => {
    assert.equal(scoreClaim(claim('rising', 100), then(100)).outcome, 'partial');
  });

  test('cooling is the exact mirror of rising', () => {
    // Same movements, opposite verdicts, opposite grades. If these ever diverge,
    // one direction is being graded more generously than the other.
    const rand = rng(2026);
    for (let i = 0; i < 2000; i++) {
      const was = 10 + Math.floor(rand() * 90);
      const now = Math.floor(rand() * 200);
      const up = scoreClaim(claim('rising', was), then(now)).outcome;
      const down = scoreClaim(claim('cooling', was), then(now)).outcome;
      const mirror = { correct: 'wrong', wrong: 'correct', partial: 'partial' } as const;
      assert.equal(down, mirror[up], `rising=${up} but cooling=${down} for ${was} → ${now}`);
    }
  });

  test('table-stakes fails in both directions', () => {
    assert.equal(scoreClaim(claim('table-stakes', 100), then(70)).outcome, 'wrong');
    assert.equal(scoreClaim(claim('table-stakes', 100), then(130)).outcome, 'wrong');
    assert.equal(scoreClaim(claim('table-stakes', 100), then(95)).outcome, 'correct');
  });

  test('hype is wrong exactly when hiring follows', () => {
    // The claim is "talk is running ahead of anyone paying". It is falsified by
    // the signal share climbing while the index holds up.
    assert.equal(scoreClaim(claim('hype', 100, 0.2), then(100, 0.4)).outcome, 'wrong');
    // Faded as called.
    assert.equal(scoreClaim(claim('hype', 100, 0.2), then(80, 0.2)).outcome, 'correct');
    // Still loud, still nobody hiring.
    assert.equal(scoreClaim(claim('hype', 100, 0.2), then(120, 0.1)).outcome, 'correct');
  });

  test('a claim minted at index 0 does not crash or divide by zero', () => {
    for (const v of VERDICTS) {
      const r = scoreClaim(claim(v, 0), then(0));
      assert.ok(Number.isFinite(0), 'sanity');
      assert.ok(['correct', 'wrong', 'partial'].includes(r.outcome));
      assert.ok(!r.note.includes('NaN'), `NaN leaked into a published grade note: ${r.note}`);
      assert.ok(!r.note.includes('Infinity'), `Infinity leaked into a published grade note: ${r.note}`);
    }
  });
});

describe('accuracyByVerdict', () => {
  const graded = (verdict: Verdict, outcome: Claim['outcome']): Claim => ({ ...claim(verdict, 50), outcome });

  test('partial counts as scored but never as correct', () => {
    const out = accuracyByVerdict([
      graded('rising', 'correct'),
      graded('rising', 'partial'),
      graded('rising', 'wrong'),
    ]);
    assert.equal(out.rising.scored, 3);
    assert.equal(out.rising.correct, 1);
    assert.equal(out.rising.partial, 1);
    assert.equal(out.rising.wrong, 1);
    assert.equal(out.rising.rate, 33);
  });

  test('ungraded claims are excluded entirely', () => {
    // An open claim must not be counted as a scored one — that would let the
    // hit rate be diluted or inflated by predictions nothing has checked yet.
    const out = accuracyByVerdict([claim('rising', 50), graded('rising', 'correct')]);
    assert.equal(out.rising.scored, 1);
    assert.equal(out.rising.rate, 100);
  });

  test('an empty claim set produces no rows rather than a fake 0%', () => {
    assert.deepEqual(accuracyByVerdict([]), {});
  });

  test('rate is never above 100 or below 0', () => {
    const rand = rng(5);
    const outcomes: Claim['outcome'][] = ['correct', 'wrong', 'partial'];
    const claims = Array.from({ length: 500 }, () =>
      graded(VERDICTS[Math.floor(rand() * VERDICTS.length)], outcomes[Math.floor(rand() * 3)]),
    );
    for (const row of Object.values(accuracyByVerdict(claims))) {
      assert.ok(row.rate !== null && row.rate >= 0 && row.rate <= 100, `rate out of range: ${row.rate}`);
      assert.equal(row.scored, row.correct + row.wrong + row.partial, 'outcome counts do not sum to scored');
    }
  });
});
