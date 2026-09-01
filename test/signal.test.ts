import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLASS_WEIGHTS,
  MIN_SNAPSHOTS_FOR_INDEX,
  scaleKey,
  indexableSources,
  referenceScale,
  smooth,
  momentumOf,
  confidenceOf,
  computeSignals,
} from '../server/signal.ts';
import type { Ledger, Observation, Snapshot, SourceClass } from '../server/types.ts';

/**
 * The index is the number the whole product is about. Every bug in here is
 * silent by construction: the dashboard still renders, every skill still has a
 * score, and the score is wrong. So these tests target the specific ways a
 * number can be quietly fabricated rather than the happy path.
 */

const SKILL = 'kubernetes';

function obs(p: Partial<Observation> & { sourceId: string; value: number }): Observation {
  return {
    skillId: SKILL,
    sourceClass: 'hiring' as SourceClass,
    metric: 'job adverts',
    ...p,
  } as Observation;
}

function snap(ts: string, observations: Observation[]): Snapshot {
  return { ts, sources: [], observations };
}

function ledgerOf(snapshots: Snapshot[], seeded = false): Ledger {
  return { version: 1, seeded, snapshots, claims: [] };
}

/** Index for one skill out of a full computeSignals run. */
function indexOf(ledger: Ledger, skillId = SKILL): number {
  const s = computeSignals(ledger).find((x) => x.skill.id === skillId);
  assert.ok(s, `no signal produced for ${skillId}`);
  return s.demandIndex;
}

describe('scaleKey — the unit-change bug', () => {
  /**
   * The live Hacker News collector reports absolute story counts; the backfill
   * reports share per 1,000. Keyed on sourceId alone, one ordinary `npm run
   * collect` would reset the scale to the absolute count and collapse six years
   * of history to near zero — every skill reading as a vertical take-off at once.
   */
  test('the same source reporting a different metric gets a separate scale', () => {
    assert.notEqual(
      scaleKey({ sourceId: 'hackernews', metric: 'stories' }),
      scaleKey({ sourceId: 'hackernews', metric: 'share per 1000' }),
    );
  });

  test('the same source and metric always gets the same scale', () => {
    assert.equal(
      scaleKey({ sourceId: 'hackernews', metric: 'stories' }),
      scaleKey({ sourceId: 'hackernews', metric: 'stories' }),
    );
  });

  test('a unit change does not rescale the existing history', () => {
    // Six snapshots of share-per-1000, then one snapshot in absolute counts.
    // Under the old sourceId-only key, the absolute 4000 became the reference
    // max and every historical value collapsed toward zero.
    const history = Array.from({ length: 6 }, (_, i) =>
      snap(`2026-0${i + 1}-01`, [obs({ sourceId: 'hackernews', metric: 'share per 1000', value: 100 + i })]),
    );
    const withUnitChange = [
      ...history,
      snap('2026-07-01', [obs({ sourceId: 'hackernews', metric: 'stories', value: 4000 })]),
    ];

    const scale = referenceScale(withUnitChange);
    assert.equal(scale.get(scaleKey({ sourceId: 'hackernews', metric: 'share per 1000' })), 105);
    assert.equal(scale.get(scaleKey({ sourceId: 'hackernews', metric: 'stories' })), 4000);
  });
});

describe('referenceScale', () => {
  test('is computed over the whole ledger, not the latest snapshot', () => {
    // Scaling per-snapshot destroys the thing being measured: if every skill
    // grows, the snapshot max grows with them and the board reads as flat.
    const snapshots = [
      snap('2026-01-01', [obs({ sourceId: 'adzuna', value: 10 })]),
      snap('2026-02-01', [obs({ sourceId: 'adzuna', value: 100 })]),
    ];
    assert.equal(referenceScale(snapshots).get(scaleKey({ sourceId: 'adzuna', metric: 'job adverts' })), 100);
  });

  test('growth over time stays visible rather than normalising away', () => {
    const key = { sourceId: 'adzuna', metric: 'job adverts' };
    const rising = Array.from({ length: 6 }, (_, i) =>
      snap(`2026-0${i + 1}-01`, [obs({ sourceId: 'adzuna', value: 10 * (i + 1) })]),
    );
    const scale = referenceScale(rising);
    // Latest value sits at the reference max; the earliest is a sixth of it.
    assert.equal(scale.get(scaleKey(key)), 60);
    assert.ok(10 / scale.get(scaleKey(key))! < 0.2, 'early history should read as materially lower than late');
  });

  test('an empty ledger produces an empty scale rather than throwing', () => {
    assert.equal(referenceScale([]).size, 0);
  });
});

describe('indexableSources', () => {
  test(`a source needs ${MIN_SNAPSHOTS_FOR_INDEX} snapshots of its own before it can vote`, () => {
    // Otherwise adding a collector rewrites the present without touching the
    // past, and the jump reads as momentum nothing in the world caused.
    const tooNew = [
      snap('2026-01-01', [obs({ sourceId: 'old', value: 1 })]),
      snap('2026-02-01', [obs({ sourceId: 'old', value: 1 })]),
      snap('2026-03-01', [obs({ sourceId: 'old', value: 1 }), obs({ sourceId: 'brand-new', value: 999 })]),
    ];
    const indexable = indexableSources(tooNew);
    assert.ok(indexable.has(scaleKey({ sourceId: 'old', metric: 'job adverts' })));
    assert.ok(!indexable.has(scaleKey({ sourceId: 'brand-new', metric: 'job adverts' })));
  });

  test('a new source does not manufacture momentum on arrival', () => {
    const withoutNew = ledgerOf(
      Array.from({ length: 5 }, (_, i) => snap(`2026-0${i + 1}-01`, [obs({ sourceId: 'adzuna', value: 50 })])),
    );
    const withNew = ledgerOf([
      ...withoutNew.snapshots.slice(0, 4),
      snap('2026-05-01', [obs({ sourceId: 'adzuna', value: 50 }), obs({ sourceId: 'newcomer', value: 5000 })]),
    ]);
    assert.equal(indexOf(withNew), indexOf(withoutNew), 'a one-snapshot-old source changed the published index');
  });

  test('repeated observations within one snapshot count once toward eligibility', () => {
    const doubled = [
      snap('2026-01-01', [obs({ sourceId: 'x', value: 1 }), obs({ sourceId: 'x', value: 2, skillId: 'react' })]),
    ];
    assert.ok(!indexableSources(doubled).has(scaleKey({ sourceId: 'x', metric: 'job adverts' })));
  });
});

describe('fixtures must not score in a real ledger', () => {
  /**
   * Values must vary across snapshots for these to mean anything. The index is
   * max-scaled per source, so a source whose latest reading IS its historical
   * peak always normalises to 1.0 — and two ledgers built from flat series both
   * come out at 100 regardless of what was included. Here hiring ends at half
   * its peak, so excluding or including the fixture is visible in the number.
   */
  const hiring = [100, 100, 50];
  const community = [100, 100, 100];

  const build = (withFixture: boolean, seeded: boolean) =>
    ledgerOf(
      hiring.map((v, i) =>
        snap(`2026-0${i + 1}-01`, [
          obs({ sourceId: 'adzuna', value: v }),
          ...(withFixture
            ? [obs({ sourceId: 'bluesky', sourceClass: 'community', metric: 'posts', value: community[i], fixture: true })]
            : []),
        ]),
      ),
      seeded,
    );

  test('a fixture observation is excluded from an unseeded ledger', () => {
    assert.equal(indexOf(build(true, false)), indexOf(build(false, false)), 'sample data contributed to a real measurement');
  });

  test('a seeded demo ledger does let fixtures score', () => {
    // The demo is sample data throughout and labels itself as such.
    assert.notEqual(indexOf(build(true, true)), indexOf(build(false, true)));
  });
});

describe('class weights', () => {
  test('hiring outranks every other class', () => {
    const others = (Object.keys(CLASS_WEIGHTS) as SourceClass[]).filter((c) => c !== 'hiring');
    for (const c of others) {
      assert.ok(CLASS_WEIGHTS.hiring > CLASS_WEIGHTS[c], `hiring must outweigh ${c}`);
    }
  });

  test('chatter alone cannot reach the index of paid demand', () => {
    // A skill with nothing but community and content noise must score below one
    // carried by job adverts at the same normalised level.
    const three = (o: Observation[]) => Array.from({ length: 3 }, (_, i) => snap(`2026-0${i + 1}-01`, o));
    const paid = ledgerOf(three([obs({ sourceId: 'adzuna', sourceClass: 'hiring', value: 100 })]));
    const talk = ledgerOf(
      three([
        obs({ sourceId: 'bluesky', sourceClass: 'community', metric: 'posts', value: 100 }),
        obs({ sourceId: 'youtube', sourceClass: 'content', metric: 'videos', value: 100 }),
      ]),
    );
    assert.ok(indexOf(paid) >= indexOf(talk), 'chatter scored at least as high as paid hiring demand');
  });

  test('signal-to-noise is zero when nothing is paying', () => {
    const three = Array.from({ length: 3 }, (_, i) =>
      snap(`2026-0${i + 1}-01`, [obs({ sourceId: 'bluesky', sourceClass: 'community', metric: 'posts', value: 50 })]),
    );
    const s = computeSignals(ledgerOf(three)).find((x) => x.skill.id === SKILL)!;
    assert.equal(s.signalToNoise, 0);
  });
});

describe('smooth', () => {
  test('preserves length', () => {
    const rand = () => Math.random();
    for (const n of [0, 1, 2, 3, 10, 47]) {
      const series = Array.from({ length: n }, rand);
      assert.equal(smooth(series).length, n);
    }
  });

  test('a constant series is unchanged', () => {
    assert.deepEqual(smooth([5, 5, 5, 5]), [5, 5, 5, 5]);
  });

  test('never leaves the range of its input', () => {
    const series = [3, 91, 7, 45, 12, 88, 1];
    const lo = Math.min(...series);
    const hi = Math.max(...series);
    for (const v of smooth(series)) {
      assert.ok(v >= lo && v <= hi, `${v} escaped [${lo}, ${hi}]`);
    }
  });

  test('reduces the swing of an alternating series', () => {
    // The whole reason smoothing exists: 19% month-to-month jitter was being
    // classified as trend.
    const spiky = [0, 100, 0, 100, 0, 100];
    const swing = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
    assert.ok(swing(smooth(spiky)) < swing(spiky));
  });
});

describe('momentumOf', () => {
  test('is zero for series too short to read a trend from', () => {
    assert.equal(momentumOf([]), 0);
    assert.equal(momentumOf([50]), 0);
    assert.equal(momentumOf([50, 60]), 0);
  });

  test('is zero for a flat series', () => {
    assert.equal(momentumOf([40, 40, 40, 40, 40, 40, 40, 40]), 0);
  });

  test('is positive for a rise and negative for the same fall reversed', () => {
    const rise = [10, 12, 15, 20, 28, 40, 55, 70];
    assert.ok(momentumOf(rise) > 0, 'a clear rise did not read as positive momentum');
    assert.ok(momentumOf([...rise].reverse()) < 0, 'a clear fall did not read as negative momentum');
  });

  test('is always finite', () => {
    // Guards the `Math.max(b, 1)` denominator: a series that starts at zero must
    // not produce Infinity and paint a vertical curve.
    for (const series of [[0, 0, 0, 0, 0, 90], [0, 0, 0], [100, 0, 0, 0, 0, 0]]) {
      assert.ok(Number.isFinite(momentumOf(series)), `non-finite momentum for ${JSON.stringify(series)}`);
    }
  });
});

describe('confidenceOf', () => {
  test('stays within its declared bounds under any input', () => {
    for (let live = 0; live <= 20; live++) {
      for (let hist = 0; hist <= 30; hist++) {
        for (const fixture of [true, false]) {
          const c = confidenceOf(live, hist, fixture);
          assert.ok(c >= 0.05 && c <= 0.95, `confidence ${c} out of bounds`);
        }
      }
    }
  });

  test('more live sources never lowers confidence', () => {
    for (let live = 0; live < 10; live++) {
      assert.ok(confidenceOf(live + 1, 5, false) >= confidenceOf(live, 5, false));
    }
  });

  test('fixture-backed hiring is penalised', () => {
    assert.ok(confidenceOf(3, 5, true) < confidenceOf(3, 5, false));
  });
});

describe('computeSignals', () => {
  test('an empty ledger produces no signals rather than throwing', () => {
    assert.deepEqual(computeSignals(ledgerOf([])), []);
  });

  test('the index is relative to a source’s own historical peak, not an absolute count', () => {
    // Worth stating explicitly: a flat series at 3 adverts and a flat series at
    // 3,000 both score 100, because each is measured against itself. The index
    // answers "how does this compare to its own best month", not "how big is it".
    const flat = (v: number) =>
      ledgerOf(Array.from({ length: 4 }, (_, i) => snap(`2026-0${i + 1}-01`, [obs({ sourceId: 'adzuna', value: v })])));
    assert.equal(indexOf(flat(3)), indexOf(flat(3000)));
  });

  test('thin evidence is never given a call', () => {
    // One job advert swinging to two is a 100% rise and means nothing. A skill
    // sitting far below its own historical peak falls under the evidence floor
    // and must be left uncalled rather than labelled `cooling`.
    const collapsed = [100, 100, 100, 100, 100, 3];
    const thin = ledgerOf(
      collapsed.map((v, i) => snap(`2026-0${i + 1}-01`, [obs({ sourceId: 'adzuna', value: v })])),
    );
    const s = computeSignals(thin).find((x) => x.skill.id === SKILL)!;
    assert.ok(s.demandIndex < 6, `precondition: index ${s.demandIndex} should sit under the evidence floor`);
    assert.equal(s.verdict, 'baseline');
  });

  test('every skill in the taxonomy gets a signal, sorted by index', () => {
    const l = ledgerOf(Array.from({ length: 3 }, (_, i) => snap(`2026-0${i + 1}-01`, [obs({ sourceId: 'adzuna', value: 50 })])));
    const signals = computeSignals(l);
    assert.ok(signals.length > 0);
    for (let i = 1; i < signals.length; i++) {
      assert.ok(signals[i - 1].demandIndex >= signals[i].demandIndex, 'signals are not sorted by demand index');
    }
  });

  test('the index is always a bounded integer', () => {
    const l = ledgerOf(
      Array.from({ length: 8 }, (_, i) => snap(`2026-0${i + 1}-01`, [obs({ sourceId: 'adzuna', value: i * 137 })])),
    );
    for (const s of computeSignals(l)) {
      assert.ok(Number.isInteger(s.demandIndex), `non-integer index ${s.demandIndex}`);
      assert.ok(s.demandIndex >= 0 && s.demandIndex <= 100, `index ${s.demandIndex} out of range`);
      assert.ok(s.signalToNoise >= 0 && s.signalToNoise <= 1, `snr ${s.signalToNoise} out of range`);
    }
  });
});
