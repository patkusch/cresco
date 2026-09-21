import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assessSeedOverwrite } from '../server/backfill-guard.ts';
import type { Ledger, Snapshot } from '../server/types.ts';
import { seededLedger, seededLedgerWithReal } from './helpers/ledgers.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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

describe('assessSeedOverwrite — `npm run seed` never quietly replaces real months', () => {
  /**
   * The bug this exists for: `npm run seed` wrote data/ledger.json with no
   * check and no backup, so running it in the real repo replaced 72 real months
   * with 8 invented weeks.
   */
  test('refuses a real ledger, says how many months and names the flag', () => {
    const v = assessSeedOverwrite(ledgerOf(72), false);
    assert.equal(v.allowed, false);
    assert.equal(v.monthsLost, 72);
    assert.match(v.message!, /holds 72 real months/);
    assert.match(v.message!, /npm run seed -- --force/);
  });

  test('refuses a real ledger even when it is shorter than the seeded one (length is not the test)', () => {
    assert.equal(assessSeedOverwrite(ledgerOf(3), false).allowed, false);
    assert.equal(assessSeedOverwrite(ledgerOf(1), false).allowed, false);
  });

  test('--force allows it and reports every real month as lost', () => {
    const v = assessSeedOverwrite(ledgerOf(72), true);
    assert.equal(v.allowed, true);
    assert.equal(v.monthsLost, 72);
    assert.equal(v.message, undefined);
  });

  test('a seeded ledger is freely replaceable: nothing real is lost', () => {
    const v = assessSeedOverwrite(ledgerOf(8, true), false);
    assert.equal(v.allowed, true);
    assert.equal(v.monthsLost, 0);
  });

  test('no ledger yet: allowed', () => {
    assert.equal(assessSeedOverwrite(null, false).allowed, true);
  });

  test('a seeded ledger holding one real snapshot is refused, and the message says 1 month, not 9', () => {
    const v = assessSeedOverwrite(seededLedgerWithReal(8, 1), false);
    assert.equal(v.allowed, false);
    assert.equal(v.monthsLost, 1);
    assert.match(v.message!, /holds 1 real month and/);
  });

  test('a seeded ledger of only sample data is allowed, with nothing lost', () => {
    const v = assessSeedOverwrite(seededLedger(8), false);
    assert.deepEqual([v.allowed, v.monthsLost], [true, 0]);
  });
});

/**
 * The real script as a subprocess against throwaway directories. The unit tests
 * above would pass even if seed.ts forgot to call the guard; these would not.
 * The fixtures directory is redirected too, so the repo's own files are never touched.
 */
describe('scripts/seed.ts — end to end', () => {
  let data: string;
  let fixtures: string;
  beforeEach(() => {
    data = mkdtempSync(join(tmpdir(), 'cresco-seed-data-'));
    fixtures = mkdtempSync(join(tmpdir(), 'cresco-seed-fixtures-'));
  });
  afterEach(() => {
    rmSync(data, { recursive: true, force: true });
    rmSync(fixtures, { recursive: true, force: true });
  });

  const ledgerPath = () => join(data, 'ledger.json');
  const put = (l: Ledger) => writeFileSync(ledgerPath(), JSON.stringify(l));
  const read = () => JSON.parse(readFileSync(ledgerPath(), 'utf8')) as Ledger;
  const backups = () => readdirSync(data).filter((f) => f.startsWith('ledger.previous'));

  function seed(...args: string[]) {
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'seed.ts'), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, CRESCO_DATA_DIR: data, CRESCO_FIXTURES_DIR: fixtures },
    });
    return { code: r.status, out: r.stdout, err: r.stderr };
  }

  test('refuses a real ledger: exit 1, ledger byte-identical, no fixtures written, no backup', () => {
    put(ledgerOf(72));
    const before = readFileSync(ledgerPath(), 'utf8');
    const r = seed();
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.err, /holds 72 real months/);
    assert.match(r.err, /npm run seed -- --force/);
    assert.equal(readFileSync(ledgerPath(), 'utf8'), before);
    assert.equal(backups().length, 0);
    assert.equal(existsSync(join(fixtures, 'adzuna.json')), false, 'a refused run writes nothing at all');
  });

  test('a seeded ledger is replaced without --force and without a backup', () => {
    put(ledgerOf(2, true));
    const r = seed();
    assert.equal(r.code, 0, r.err);
    assert.equal(read().seeded, true);
    assert.equal(read().snapshots.length, 8);
    assert.equal(backups().length, 0);
    assert.doesNotMatch(r.out, /kept at/);
  });

  test('with no ledger on disk it just writes one, and the fixtures', () => {
    const r = seed();
    assert.equal(r.code, 0, r.err);
    assert.equal(read().seeded, true);
    assert.ok(existsSync(join(fixtures, 'adzuna.json')));
    assert.ok(existsSync(join(fixtures, 'youtube.json')));
    assert.equal(backups().length, 0);
  });

  test('--force replaces a real ledger and keeps a timestamped copy of it', () => {
    put(ledgerOf(72));
    const before = readFileSync(ledgerPath(), 'utf8');
    const r = seed('--force');
    assert.equal(r.code, 0, r.err);
    assert.equal(read().seeded, true);
    const saved = backups();
    assert.equal(saved.length, 1);
    assert.match(saved[0], /^ledger\.previous-\d{8}T\d{6}Z\.json$/);
    assert.equal(readFileSync(join(data, saved[0]), 'utf8'), before, 'the copy is byte for byte the old ledger');
    assert.match(r.out, new RegExp(`kept at data/${saved[0]}`));
    assert.match(r.out, /72 real months no longer/);
  });

  test('--force twice does not destroy the first backup', () => {
    put(ledgerOf(72));
    assert.equal(seed('--force').code, 0);
    const first = backups()[0];
    // The ledger is seeded now, so a second run is a plain replace; put a different real one back.
    put(ledgerOf(5));
    assert.equal(seed('--force').code, 0);
    const saved = backups();
    assert.equal(saved.length, 2);
    assert.ok(saved.includes(first));
    const lengths = saved.map((f) => (JSON.parse(readFileSync(join(data, f), 'utf8')) as Ledger).snapshots.length).sort((a, b) => a - b);
    assert.deepEqual(lengths, [5, 72]);
  });

  /**
   * The bug: a ledger flagged `seeded` that `npm run collect` had since added
   * real snapshots to was treated as sample data and replaced, no backup.
   */
  test('a seeded ledger holding a real snapshot is refused, and byte-identical afterwards', () => {
    put(seededLedgerWithReal(8, 1));
    const before = readFileSync(ledgerPath(), 'utf8');
    const r = seed();
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.err, /holds 1 real month and/);
    assert.match(r.err, /npm run seed -- --force/);
    assert.equal(readFileSync(ledgerPath(), 'utf8'), before);
    assert.equal(backups().length, 0);
    assert.equal(existsSync(join(fixtures, 'adzuna.json')), false, 'a refused run writes nothing at all');
  });

  test('--force on it keeps a timestamped copy (not the overwritable ledger.seeded.json)', () => {
    put(seededLedgerWithReal(8, 1));
    const before = readFileSync(ledgerPath(), 'utf8');
    const r = seed('--force');
    assert.equal(r.code, 0, r.err);
    const saved = backups();
    assert.equal(saved.length, 1);
    assert.match(saved[0], /^ledger\.previous-\d{8}T\d{6}Z\.json$/);
    assert.equal(readFileSync(join(data, saved[0]), 'utf8'), before);
    assert.equal(existsSync(join(data, 'ledger.seeded.json')), false);
    assert.match(r.out, /1 real month no longer/);
  });

  test('a ledger that is sample data all the way through is still replaced freely, no backup', () => {
    put(seededLedger(8));
    const r = seed();
    assert.equal(r.code, 0, r.err);
    assert.equal(backups().length, 0);
    assert.equal(existsSync(join(data, 'ledger.seeded.json')), false);
  });

  test('a corrupt ledger stops the run rather than being overwritten', () => {
    writeFileSync(ledgerPath(), '{ not json');
    const r = seed('--force');
    assert.notEqual(r.code, 0);
    assert.equal(readFileSync(ledgerPath(), 'utf8'), '{ not json');
  });
});
