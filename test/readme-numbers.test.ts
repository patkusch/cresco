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

describe('README indicator table matches data/holdout.json', () => {
  const h = json('holdout.json').sources;
  // README row label (bold stripped) → holdout source id.
  const ROWS: Record<string, string> = {
    'Conference programmes — talks per topic at major conferences': 'conference',
    'GitHub repos created per topic': 'github',
    'SEC EDGAR filings naming a technology': 'edgar',
    'Wikipedia pageviews': 'wikipedia',
    'npm downloads': 'npm',
  };
  const signed = (x: number) => (x < 0 ? `−${Math.abs(x).toFixed(3)}` : `+${x.toFixed(3)}`);

  for (const [label, id] of Object.entries(ROWS)) {
    test(`${id} row`, () => {
      const [, r, beat] = row(label);
      assert.equal(r, signed(h[id].holdoutR));
      assert.equal(beat, `${(h[id].nullsBeating * 100).toFixed(1)}%`);
    });
  }

  test('says how many months it was run on', () => {
    assert.match(readme, new RegExp(`re-run on \\d{4}-\\d{2}-\\d{2} on ${json('holdout.json').months} months`));
  });
});
