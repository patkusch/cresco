import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PROXIES } from '../server/collectors/proxies.ts';
import { SKILLS } from '../server/taxonomy.ts';

test('every proxy belongs to a skill that exists', () => {
  const ids = new Set(SKILLS.map((s) => s.id));
  for (const id of Object.keys(PROXIES)) assert.ok(ids.has(id), `${id} is not in the taxonomy`);
});

test('every proxy names at least one thing to measure', () => {
  for (const [id, p] of Object.entries(PROXIES)) {
    const n = (p.npm?.length ?? 0) + (p.wikipedia?.length ?? 0) + (p.pypi?.length ?? 0);
    assert.ok(n > 0, `${id} has an empty proxy`);
  }
});

test('names are non-empty strings, and Wikipedia titles use underscores, not spaces', () => {
  for (const [id, p] of Object.entries(PROXIES)) {
    for (const name of [...(p.npm ?? []), ...(p.wikipedia ?? []), ...(p.pypi ?? [])]) {
      assert.equal(typeof name, 'string', id);
      assert.ok(name.trim().length > 0, id);
    }
    for (const title of p.wikipedia ?? []) assert.ok(!/\s/.test(title), `${id}: "${title}" has a space`);
  }
});

test('no skill lists the same package twice', () => {
  for (const [id, p] of Object.entries(PROXIES)) {
    for (const list of [p.npm, p.wikipedia, p.pypi]) {
      if (list) assert.equal(new Set(list).size, list.length, id);
    }
  }
});
