import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Observation, Skill, SourceClass } from '../types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let cache: Record<string, any> = {};

export function readFixture<T = any>(name: string): T | null {
  if (cache[name] !== undefined) return cache[name];
  try {
    cache[name] = JSON.parse(readFileSync(join(ROOT, 'fixtures', `${name}.json`), 'utf8'));
  } catch {
    cache[name] = null;
  }
  return cache[name];
}

/**
 * Fixture values are always tagged `fixture: true` and carried through to the UI.
 * Nothing in Cresco is allowed to present sample data as though it were measured.
 */
export function loadFixture(sourceId: string, skills: Skill[], sourceClass: SourceClass, metric: string): Observation[] {
  const table = readFixture<Record<string, number>>(`${sourceId}`) ?? {};
  return skills.map((skill) => ({
    skillId: skill.id,
    sourceId,
    sourceClass,
    metric,
    value: table[skill.id] ?? 0,
    fixture: true,
  }));
}
