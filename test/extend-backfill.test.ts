import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extendMonths } from '../server/backfill-guard.ts';
import type { Ledger } from '../server/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** A real ledger whose months run Jan 2026 onward, `n` of them. */
const ledgerOf = (n: number): Ledger => ({
  version: 1,
  seeded: false,
  snapshots: Array.from({ length: n }, (_, i) => ({ ts: new Date(Date.UTC(2026, i, 1, 15)).toISOString(), sources: [], observations: [] })),
  claims: [],
});

describe('extendMonths: how many months --extend asks for', () => {
  test('held months plus each finished month newer than the newest held', () => {
    const r = extendMonths(ledgerOf(8), ['2026-10', '2026-09', '2026-08', '2026-07']);
    assert.deepEqual(r.added, ['2026-09', '2026-10']);
    assert.equal(r.months, 10);
  });

  test('nothing newer means nothing added', () => {
    assert.deepEqual(extendMonths(ledgerOf(8), ['2026-08', '2026-07']), { months: 8, added: [] });
  });

  test('no ledger yet: every finished month counts', () => {
    assert.deepEqual(extendMonths(null, ['2026-02', '2026-01']), { months: 2, added: ['2026-01', '2026-02'] });
  });

  test('a month listed twice is counted once', () => {
    assert.equal(extendMonths(ledgerOf(1), ['2026-02', '2026-02']).months, 2);
  });
});

describe('scripts/backfill.ts --extend, offline', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'cresco-extend-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  const run = (...args: string[]) => {
    const r = spawnSync(
      process.execPath,
      ['--import', join(ROOT, 'test', 'helpers', 'stub-hn.mjs'), join(ROOT, 'scripts', 'backfill.ts'), ...args],
      // BACKFILL_MONTHS=1 on purpose: --extend must ignore it and work the number out.
      { cwd: ROOT, encoding: 'utf8', env: { ...process.env, CRESCO_DATA_DIR: dir, BACKFILL_MONTHS: '1' } },
    );
    return { code: r.status, out: r.stdout, err: r.stderr };
  };

  test('adds the newer stub months and keeps every month held', () => {
    // Stub threads run 2025-09 → 2026-08; this ledger ends 2026-06.
    writeFileSync(join(dir, 'ledger.json'), JSON.stringify(ledgerOf(6)));
    const r = run('--extend');
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /adding 2026-07, 2026-08 → 8 months/);
    const after = JSON.parse(readFileSync(join(dir, 'ledger.json'), 'utf8')) as Ledger;
    assert.equal(after.snapshots.length, 8);
    assert.equal(after.snapshots.at(-1)!.ts.slice(0, 7), '2026-08');
  });

  test('writes nothing when the ledger is already up to date', () => {
    writeFileSync(join(dir, 'ledger.json'), JSON.stringify(ledgerOf(8)));
    const before = readFileSync(join(dir, 'ledger.json'), 'utf8');
    const r = run('--extend');
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /Nothing to extend/);
    assert.equal(readFileSync(join(dir, 'ledger.json'), 'utf8'), before);
  });
});
