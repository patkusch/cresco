import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadLedger, appendSnapshot, mintClaims, dueClaims, accuracy } from '../server/ledger.ts';
import type { Claim, Ledger, SkillSignal, Snapshot, Verdict } from '../server/types.ts';

/**
 * These never touch `data/ledger.json`. Every case that needs a file on disk
 * gets a throwaway one in a temp directory, and nothing here calls `saveLedger`
 * — which writes to the real path unconditionally.
 */

let dir: string;
before(() => {
  dir = mkdtempSync(join(tmpdir(), 'cresco-ledger-'));
});
after(() => {
  rmSync(dir, { recursive: true, force: true });
});

const write = (name: string, contents: string) => {
  const p = join(dir, name);
  writeFileSync(p, contents);
  return p;
};

function signal(id: string, verdict: Verdict, demandIndex = 50): SkillSignal {
  return {
    skill: { id, label: id, category: 'test', aliases: [], queries: [] },
    demandIndex,
    momentum: 30,
    signalToNoise: 0.5,
    verdict,
    substance: 0.5,
    chatter: 0.5,
    history: [],
    byClass: { hiring: 0, practitioner: 0, community: 0, content: 0, vendor: 0 },
    evidence: [],
    path: [],
  };
}

const emptyLedger = (): Ledger => ({ version: 1, seeded: false, snapshots: [], claims: [] });

describe('loadLedger — a missing file and a corrupt file are different events', () => {
  /**
   * The original code caught the parse error and returned an empty ledger. The
   * pipeline then appended one snapshot to that empty ledger and saved it,
   * destroying years of history behind a dashboard that still looked fine.
   */
  test('a corrupt ledger throws rather than silently emptying itself', () => {
    const p = write('corrupt.json', '{"version": 1, "snapshots": [ truncated');
    assert.throws(() => loadLedger(p), /could not be parsed/);
  });

  test('the error names the file and its size, so the damage is diagnosable', () => {
    const raw = '{"version": 1, oh no';
    const p = write('corrupt-2.json', raw);
    assert.throws(() => loadLedger(p), (err: Error) => {
      assert.match(err.message, /corrupt-2\.json/);
      assert.match(err.message, new RegExp(`${raw.length} bytes`));
      assert.match(err.message, /Refusing to continue/);
      return true;
    });
  });

  test('an empty file is corrupt, not absent', () => {
    // Zero bytes is the classic result of an interrupted write. It is not the
    // same as never having had a ledger, and must not be treated as such.
    assert.throws(() => loadLedger(write('empty.json', '')), /could not be parsed/);
  });

  test('a missing file returns an empty ledger', () => {
    const l = loadLedger(join(dir, 'does-not-exist.json'));
    assert.deepEqual(l, { version: 1, seeded: false, snapshots: [], claims: [] });
  });

  test('a missing file returns a fresh object each time', () => {
    // Returning a shared constant would let one caller's mutations leak into
    // the next caller's "empty" ledger.
    const a = loadLedger(join(dir, 'nope-a.json'));
    a.snapshots.push({ ts: '2026-01-01', sources: [], observations: [] });
    assert.equal(loadLedger(join(dir, 'nope-b.json')).snapshots.length, 0);
  });

  test('a valid ledger round-trips', () => {
    const l: Ledger = { version: 1, seeded: true, snapshots: [], claims: [] };
    assert.deepEqual(loadLedger(write('good.json', JSON.stringify(l))), l);
  });
});

describe('appendSnapshot', () => {
  const snapshot: Snapshot = { ts: '2026-05-01', sources: [], observations: [] };

  test('does not mutate the ledger it was given', () => {
    const before = emptyLedger();
    appendSnapshot(before, snapshot);
    assert.equal(before.snapshots.length, 0);
  });

  test('preserves existing history', () => {
    const l = appendSnapshot(appendSnapshot(emptyLedger(), snapshot), { ...snapshot, ts: '2026-06-01' });
    assert.deepEqual(l.snapshots.map((s) => s.ts), ['2026-05-01', '2026-06-01']);
  });

  test('carries claims and the seeded flag through unchanged', () => {
    const l: Ledger = { ...emptyLedger(), seeded: true };
    const out = appendSnapshot(l, snapshot);
    assert.equal(out.seeded, true);
    assert.equal(out.version, 1);
  });
});

describe('mintClaims', () => {
  const now = new Date('2026-06-01T00:00:00.000Z');

  test('never mints a claim for a verdict with no call in it', () => {
    assert.deepEqual(mintClaims(emptyLedger(), [signal('a', 'baseline')], now), []);
  });

  test('every minted claim carries a check-back date in the future', () => {
    const claims = mintClaims(emptyLedger(), VERDICT_SIGNALS, now);
    assert.ok(claims.length > 0);
    for (const c of claims) {
      assert.ok(new Date(c.checkBackAt) > now, `${c.id} is gradeable before it was made`);
      assert.equal(c.createdAt, now.toISOString());
    }
  });

  test('a claim is falsifiable on the day it is minted — index and snr are recorded', () => {
    // Without the baseline numbers there is nothing to grade against later.
    const [c] = mintClaims(emptyLedger(), [signal('a', 'rising', 42)], now);
    assert.equal(c.demandIndex, 42);
    assert.equal(typeof c.signalToNoise, 'number');
    assert.equal(c.outcome, undefined, 'a fresh claim must not arrive pre-graded');
  });

  test('does not re-mint while an identical claim is still open', () => {
    // Re-minting every run would flood the ledger and let one call be counted
    // many times in the published hit rate.
    const first = mintClaims(emptyLedger(), [signal('a', 'rising')], now);
    const ledger: Ledger = { ...emptyLedger(), claims: first };
    assert.deepEqual(mintClaims(ledger, [signal('a', 'rising')], now), []);
  });

  test('does mint again once the previous claim has been graded', () => {
    const graded: Claim[] = mintClaims(emptyLedger(), [signal('a', 'rising')], now).map((c) => ({
      ...c,
      outcome: 'correct' as const,
    }));
    const ledger: Ledger = { ...emptyLedger(), claims: graded };
    assert.equal(mintClaims(ledger, [signal('a', 'rising')], now).length, 1);
  });

  test('a different verdict on the same skill is a separate claim', () => {
    const open = mintClaims(emptyLedger(), [signal('a', 'rising')], now);
    const ledger: Ledger = { ...emptyLedger(), claims: open };
    assert.equal(mintClaims(ledger, [signal('a', 'cooling')], now).length, 1);
  });

  test('cooling and table-stakes get a longer horizon than rising and hype', () => {
    const byVerdict = Object.fromEntries(
      mintClaims(emptyLedger(), VERDICT_SIGNALS, now).map((c) => [c.verdict, new Date(c.checkBackAt).getTime()]),
    );
    assert.ok(byVerdict.cooling > byVerdict.rising, 'cooling should be given longer to play out');
    assert.ok(byVerdict['table-stakes'] > byVerdict.hype);
  });
});

const VERDICT_SIGNALS = [
  signal('a', 'rising'),
  signal('b', 'cooling'),
  signal('c', 'table-stakes'),
  signal('d', 'hype'),
];

describe('dueClaims', () => {
  const base = mintClaims(emptyLedger(), [signal('a', 'rising')], new Date('2026-01-01T00:00:00.000Z'));

  test('is empty before the check-back date', () => {
    const l: Ledger = { ...emptyLedger(), claims: base };
    assert.deepEqual(dueClaims(l, new Date('2026-02-01T00:00:00.000Z')), []);
  });

  test('returns the claim once the date has passed', () => {
    const l: Ledger = { ...emptyLedger(), claims: base };
    assert.equal(dueClaims(l, new Date('2027-01-01T00:00:00.000Z')).length, 1);
  });

  test('never returns a claim that has already been graded', () => {
    const l: Ledger = { ...emptyLedger(), claims: base.map((c) => ({ ...c, outcome: 'wrong' as const })) };
    assert.deepEqual(dueClaims(l, new Date('2027-01-01T00:00:00.000Z')), []);
  });
});

describe('accuracy', () => {
  const graded = (outcome: Claim['outcome']): Claim => ({
    ...mintClaims(emptyLedger(), [signal('a', 'rising')], new Date('2026-01-01T00:00:00.000Z'))[0],
    outcome,
  });

  test('reports null rather than 0% when nothing has been graded', () => {
    // A system that has graded nothing has no hit rate. Publishing 0% would be
    // a claim it has not earned, in either direction.
    assert.deepEqual(accuracy(emptyLedger()), { scored: 0, correct: 0, rate: null });
  });

  test('open claims never dilute the rate', () => {
    const l: Ledger = { ...emptyLedger(), claims: [graded('correct'), { ...graded('correct'), outcome: undefined }] };
    assert.deepEqual(accuracy(l), { scored: 1, correct: 1, rate: 100 });
  });

  test('partial counts as scored but not correct', () => {
    const l: Ledger = { ...emptyLedger(), claims: [graded('correct'), graded('partial')] };
    assert.deepEqual(accuracy(l), { scored: 2, correct: 1, rate: 50 });
  });
});
