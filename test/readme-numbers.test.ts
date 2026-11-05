import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The README's numbers were copied by hand from terminal output, and they went
 * stale twice: a score table from 72 months sat next to a 74-month ledger. These
 * tests read the files the scripts write and fail when the README disagrees.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8').replace(/\*\*/g, '');
const json = (f: string) => JSON.parse(readFileSync(join(ROOT, 'data', f), 'utf8'));

/** Cells of the first table row whose first cell is exactly `label`. */
function row(label: string): string[] {
  const line = readme.split('\n').find((l) => l.startsWith(`| ${label} |`));
  assert.ok(line, `README has no table row for "${label}"`);
  return line.split('|').slice(1, -1).map((c) => c.trim());
}

describe('README score table matches data/backtest.json', () => {
  const b = json('backtest.json');
  const LABELS: Record<string, string> = { Established: 'table-stakes', Hype: 'hype', Receding: 'cooling', Rising: 'rising' };

  for (const [label, verdict] of Object.entries(LABELS)) {
    test(`${label} row`, () => {
      const v = b.byVerdict[verdict];
      assert.deepEqual(row(label).slice(1), [`${v.rate}%`, `${v.correct} / ${v.wrong} / ${v.partial}`]);
    });
  }

  test('Overall row', () => {
    assert.deepEqual(row('Overall').slice(1), [`${b.rate}%`, `${b.correct} / ${b.wrong} / ${b.partial}`]);
  });

  test('headline counts', () => {
    assert.match(readme, new RegExp(`Current score — ${b.graded} graded calls over ${b.months} months, ${b.skills} skills`));
  });
});
