import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assessOverwrite, backUpLedger } from '../server/backfill-guard.ts';
import type { Ledger, Snapshot } from '../server/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** A month with nothing in it; the guard only counts and copies, it never reads observations. */
const month = (i: number): Snapshot => ({
  ts: new Date(Date.UTC(2026, i, 1, 15)).toISOString(),
  sources: [],
  observations: [],
});
const ledgerOf = (months: number, seeded = false): Ledger => ({
  version: 1,
  seeded,
  snapshots: Array.from({ length: months }, (_, i) => month(i)),
  claims: [],
});

describe('assessOverwrite — the ledger on disk is never shortened by accident', () => {
  /**
   * The bug this exists for: the documented `npm run backfill` defaults to 8
   * months, the committed ledger holds 72, and the run replaced one with the other.
   */
  test('refuses a shorter run and says how many months would be lost and which flag overrides', () => {
    const v = assessOverwrite(ledgerOf(72), 8, false);
    assert.equal(v.allowed, false);
    assert.equal(v.monthsLost, 64);
    assert.equal(v.existingMonths, 72);
    assert.match(v.message!, /holds 72 real months/);
    assert.match(v.message!, /produce 8, losing 64/);
    assert.match(v.message!, /--force/);
    assert.match(v.message!, /BACKFILL_MONTHS=72/);
  });

  test('a one-month shortfall is refused too (an unreadable month is a hole)', () => {
    const v = assessOverwrite(ledgerOf(72), 71, false);
    assert.equal(v.allowed, false);
    assert.equal(v.monthsLost, 1);
  });

  test('--force allows it, and still reports what is lost', () => {
    const v = assessOverwrite(ledgerOf(72), 8, true);
    assert.equal(v.allowed, true);
    assert.equal(v.monthsLost, 64);
    assert.equal(v.message, undefined);
  });

  test('a run exactly as long, or longer, is allowed without --force', () => {
    for (const n of [72, 73, 100]) {
      const v = assessOverwrite(ledgerOf(72), n, false);
      assert.equal(v.allowed, true, `${n} months`);
      assert.equal(v.monthsLost, 0);
    }
  });

  test('no ledger yet: allowed', () => {
    assert.equal(assessOverwrite(null, 8, false).allowed, true);
  });

  test('a seeded (synthetic) ledger can be replaced by anything: nothing real is lost', () => {
    assert.equal(assessOverwrite(ledgerOf(72, true), 8, false).allowed, true);
  });
});

describe('backUpLedger — an existing backup is never overwritten', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'cresco-backup-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  const put = (l: Ledger) => writeFileSync(join(dir, 'ledger.json'), JSON.stringify(l));
  const backups = () => readdirSync(dir).filter((f) => f.startsWith('ledger.previous')).sort();

  test('a real ledger goes to a timestamped file, byte for byte', () => {
    const real = ledgerOf(5);
    put(real);
    const name = backUpLedger(dir, real, new Date('2026-09-19T10:15:30.123Z'));
    assert.equal(name, 'ledger.previous-20260919T101530Z.json');
    assert.equal(readFileSync(join(dir, name), 'utf8'), readFileSync(join(dir, 'ledger.json'), 'utf8'));
  });

  test('two backups at different times both survive', () => {
    const first = ledgerOf(5);
    put(first);
    backUpLedger(dir, first, new Date('2026-09-19T10:00:00Z'));
    const second = ledgerOf(3);
    put(second);
    backUpLedger(dir, second, new Date('2026-09-19T10:05:00Z'));
    const files = backups();
    assert.equal(files.length, 2);
    const sizes = files.map((f) => (JSON.parse(readFileSync(join(dir, f), 'utf8')) as Ledger).snapshots.length);
    assert.deepEqual(sizes, [5, 3]);
  });

  test('two backups in the same second get distinct names instead of one clobbering the other', () => {
    const at = new Date('2026-09-19T10:00:00Z');
    const first = ledgerOf(5);
    put(first);
    const a = backUpLedger(dir, first, at);
    const second = ledgerOf(3);
    put(second);
    const b = backUpLedger(dir, second, at);
    assert.notEqual(a, b);
    assert.equal(backups().length, 2);
    assert.equal((JSON.parse(readFileSync(join(dir, a), 'utf8')) as Ledger).snapshots.length, 5);
  });

  test('a seeded ledger keeps going to ledger.seeded.json, not the previous-* series', () => {
    const seeded = ledgerOf(5, true);
    put(seeded);
    assert.equal(backUpLedger(dir, seeded), 'ledger.seeded.json');
    assert.equal(backups().length, 0);
  });
});

/**
 * The real script, run as a subprocess against a throwaway data directory with
 * the Algolia endpoints stubbed out. This is the part that proves the guard is
 * actually wired in: the unit tests above would pass even if the script forgot
 * to call them.
 */
describe('scripts/backfill.ts — end to end, offline', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'cresco-backfill-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  const ledgerPath = () => join(dir, 'ledger.json');
  const seedLedger = (months: number) => writeFileSync(ledgerPath(), JSON.stringify(ledgerOf(months)));
  const read = () => JSON.parse(readFileSync(ledgerPath(), 'utf8')) as Ledger;
  const backups = () => readdirSync(dir).filter((f) => f.startsWith('ledger.previous'));

  function backfill(months: number, ...args: string[]) {
    const r = spawnSync(
      process.execPath,
      ['--import', join(ROOT, 'test', 'helpers', 'stub-hn.mjs'), join(ROOT, 'scripts', 'backfill.ts'), ...args],
      { cwd: ROOT, encoding: 'utf8', env: { ...process.env, CRESCO_DATA_DIR: dir, BACKFILL_MONTHS: String(months) } },
    );
    return { code: r.status, out: r.stdout, err: r.stderr };
  }

  test('a shorter run is refused: exit 1, the message names the loss and the flag, nothing is touched', () => {
    seedLedger(5);
    const before = readFileSync(ledgerPath(), 'utf8');
    const r = backfill(3);
    assert.equal(r.code, 1, r.err);
    assert.match(r.err, /would produce 3, losing 2/);
    assert.match(r.err, /npm run backfill -- --force/);
    assert.equal(readFileSync(ledgerPath(), 'utf8'), before, 'ledger must be byte-identical');
    assert.equal(backups().length, 0);
  });

  test('--force replaces it and keeps a timestamped copy of what was there', () => {
    seedLedger(5);
    const r = backfill(3, '--force');
    assert.equal(r.code, 0, r.err);
    assert.equal(read().snapshots.length, 3);
    const saved = backups();
    assert.equal(saved.length, 1);
    assert.match(saved[0], /^ledger\.previous-\d{8}T\d{6}Z\.json$/);
    assert.equal((JSON.parse(readFileSync(join(dir, saved[0]), 'utf8')) as Ledger).snapshots.length, 5);
    assert.match(r.out, new RegExp(`kept at data/${saved[0]}`));
    assert.match(r.out, /2 months no longer in data\/ledger\.json/);
  });

  test('a second forced run does not destroy the first backup', () => {
    seedLedger(5);
    assert.equal(backfill(3, '--force').code, 0);
    // Different second, so the two names differ even without the collision counter.
    const first = backups()[0];
    assert.equal(backfill(2, '--force').code, 0);
    const saved = backups();
    assert.equal(saved.length, 2);
    assert.ok(saved.includes(first));
    const lengths = saved.map((f) => (JSON.parse(readFileSync(join(dir, f), 'utf8')) as Ledger).snapshots.length).sort();
    assert.deepEqual(lengths, [3, 5], 'both the 5-month and the 3-month copies survive');
  });

  test('a run at least as long as the ledger is allowed without --force', () => {
    seedLedger(3);
    const r = backfill(3);
    assert.equal(r.code, 0, r.err);
    assert.equal(read().snapshots.length, 3);
    assert.equal(read().seeded, false);
    assert.equal(backups().length, 1, 'the ledger it replaced is still backed up');
    assert.doesNotMatch(r.out, /no longer in/);
  });

  test('with no ledger on disk it just writes one, and there is nothing to back up', () => {
    const r = backfill(3);
    assert.equal(r.code, 0, r.err);
    assert.equal(read().snapshots.length, 3);
    assert.equal(backups().length, 0);
  });
});
