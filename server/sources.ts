import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LeadingData } from './collectors/leading.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Every candidate leading indicator, merged into one set.
 *
 * Collected in separate files because they are fetched by separate scripts on
 * separate cadences, but analysed together — a new indicator must go through the
 * same hold-out and the same shuffled null as the ones already rejected, or
 * "we tested it" means nothing.
 */
export function loadIndicators(files = ['leading.json', 'edgar.json']): LeadingData {
  const merged: LeadingData = { months: [], series: {}, resolved: [], missing: [] };

  for (const file of files) {
    const path = join(ROOT, 'data', file);
    if (!existsSync(path)) continue;
    let d: LeadingData;
    try {
      d = JSON.parse(readFileSync(path, 'utf8')) as LeadingData;
    } catch {
      continue;
    }
    merged.months = [...new Set([...merged.months, ...(d.months ?? [])])].sort();
    merged.resolved.push(...(d.resolved ?? []));
    merged.missing.push(...(d.missing ?? []));
    for (const [skillId, bySource] of Object.entries(d.series ?? {})) {
      merged.series[skillId] = { ...(merged.series[skillId] ?? {}), ...bySource };
    }
  }
  return merged;
}

/** Which indicator sources actually have data, across all skills. */
export function availableSources(data: LeadingData): string[] {
  const out = new Set<string>();
  for (const bySource of Object.values(data.series)) for (const k of Object.keys(bySource)) out.add(k);
  return [...out].sort();
}
