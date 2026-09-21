import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Ledger } from '../server/types.ts';
import { ledgerFrom, realMonth, SAMPLE_CLAIM_ID, seededLedger, seededLedgerWithReal } from './helpers/ledgers.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The bug: `npm run collect` appends REAL snapshots to whatever ledger exists,
 * including one flagged `seeded`. That produced a ledger that scored invented
 * numbers next to real ones (a seeded ledger lets fixtures score), and the seed
 * and backfill guards then treated it as freely replaceable, so the real data
 * went with no backup.
 *
 * These run the real script as a subprocess in a throwaway data directory, with
 * the network stubbed: helpers/stub-hn.mjs answers as Hacker News would,
 * helpers/stub-offline.mjs answers nothing.
 */
describe('scripts/collect.ts — never mixes real data into a seeded ledger', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'cresco-collect-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  const ledgerPath = () => join(dir, 'ledger.json');
  const put = (l: Ledger) => writeFileSync(ledgerPath(), JSON.stringify(l));
  const read = () => JSON.parse(readFileSync(ledgerPath(), 'utf8')) as Ledger;
  const backups = () => readdirSync(dir).filter((f) => f.startsWith('ledger.previous'));
  const hasReal = (s: Ledger['snapshots'][number]) => s.observations.some((o) => !o.fixture);

  function collect(stub: 'stub-hn.mjs' | 'stub-offline.mjs', ...args: string[]) {
    const r = spawnSync(
      process.execPath,
      ['--import', join(ROOT, 'test', 'helpers', stub), join(ROOT, 'scripts', 'collect.ts'), ...args],
      { cwd: ROOT, encoding: 'utf8', env: { ...process.env, CRESCO_DATA_DIR: dir } },
    );
    return { code: r.status, out: r.stdout, err: r.stderr };
  }

  test('a real run against a seeded ledger is refused: exit 1, ledger byte-identical, no backup', () => {
    put(seededLedger());
    const before = readFileSync(ledgerPath(), 'utf8');
    const r = collect('stub-hn.mjs');
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.err, /flagged seeded/);
    assert.match(r.err, /npm run backfill/);
    assert.match(r.err, /npm run collect -- --force/);
    assert.equal(readFileSync(ledgerPath(), 'utf8'), before);
    assert.equal(backups().length, 0);
  });

  test('--force drops the sample weeks and starts a real ledger from this run', () => {
    put(seededLedger());
    const r = collect('stub-hn.mjs', '--force');
    assert.equal(r.code, 0, r.err);
    const l = read();
    assert.equal(l.seeded, false);
    assert.equal(l.snapshots.length, 1, 'only the real snapshot is left');
    assert.ok(hasReal(l.snapshots[0]));
    // Sample data cannot come back through the fixture tables either: what is
    // still flagged fixture stays out of the score in a real ledger.
    assert.ok(!l.claims.some((c) => c.id === SAMPLE_CLAIM_ID), 'a call that sample data made is not inherited');
    assert.equal(backups().length, 0, 'a seeded ledger only holds sample data, so nothing needs saving');
    assert.match(r.out, /dropped 8 sample/);
  });

  test('a seeded ledger that already holds a real snapshot is refused too, and says so', () => {
    put(seededLedgerWithReal(8, 2));
    const before = readFileSync(ledgerPath(), 'utf8');
    const r = collect('stub-hn.mjs');
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.err, /already holds 2 real snapshots/);
    assert.equal(readFileSync(ledgerPath(), 'utf8'), before);
  });

  test('--force on that mixed ledger keeps the real snapshots, drops the sample ones, and backs up first', () => {
    put(seededLedgerWithReal(8, 2));
    const before = readFileSync(ledgerPath(), 'utf8');
    const r = collect('stub-hn.mjs', '--force');
    assert.equal(r.code, 0, r.err);
    const l = read();
    assert.equal(l.seeded, false);
    assert.equal(l.snapshots.length, 3, '2 real snapshots it already had + this run');
    assert.ok(l.snapshots.every(hasReal), 'no sample-only snapshot survives');
    assert.ok(!l.claims.some((c) => c.id === SAMPLE_CLAIM_ID));
    const saved = backups();
    assert.equal(saved.length, 1);
    assert.match(saved[0], /^ledger\.previous-\d{8}T\d{6}Z\.json$/);
    assert.equal(readFileSync(join(dir, saved[0]), 'utf8'), before, 'the copy is byte for byte the old ledger');
    assert.match(r.out, new RegExp(`kept at data/${saved[0]}`));
  });

  test('an offline run has nothing real to add, so a seeded ledger stays as it is and grows by one sample snapshot', () => {
    put(seededLedger());
    const r = collect('stub-offline.mjs');
    assert.equal(r.code, 0, r.err);
    const l = read();
    assert.equal(l.seeded, true);
    assert.equal(l.snapshots.length, 9);
    assert.ok(!l.snapshots.some(hasReal));
  });

  test('a real ledger is untouched by all this: a real run appends without --force', () => {
    put(ledgerFrom([realMonth(6), realMonth(7)], false));
    const r = collect('stub-hn.mjs');
    assert.equal(r.code, 0, r.err);
    assert.equal(read().seeded, false);
    assert.equal(read().snapshots.length, 3);
    assert.equal(backups().length, 0);
  });

  test('with no ledger on disk it writes a real one', () => {
    const r = collect('stub-hn.mjs');
    assert.equal(r.code, 0, r.err);
    assert.equal(read().seeded, false);
    assert.equal(read().snapshots.length, 1);
  });
});
