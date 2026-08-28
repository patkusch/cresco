import type { Collector, Observation, Skill } from '../types.ts';
import { getJSON, mapLimit } from './http.ts';
import { loadFixture } from './fixtures.ts';

interface AdzunaResp { count: number; }

/**
 * Adzuna job-advert counts — the load-bearing demand signal when a key is present.
 * Without a key we fall back to bundled fixtures, clearly flagged as such all the
 * way through to the dashboard, because a demo that quietly invents hiring data
 * is worse than a demo that admits it has none.
 */
export const adzuna: Collector = {
  id: 'adzuna',
  label: 'Adzuna job adverts',
  sourceClass: 'hiring',
  metric: 'open job adverts',
  keyVar: 'ADZUNA_APP_ID',
  isLive: () => Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
  async collect(skills: Skill[]): Promise<Observation[]> {
    if (!adzuna.isLive()) return loadFixture('adzuna', skills, 'hiring', 'open job adverts');

    const country = process.env.ADZUNA_COUNTRY || 'gb';
    const rows = await mapLimit<Skill, Observation | null>(skills, 3, async (skill) => {
      const url =
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1` +
        `?app_id=${process.env.ADZUNA_APP_ID}&app_key=${process.env.ADZUNA_APP_KEY}` +
        `&what=${encodeURIComponent(skill.queries[0])}&results_per_page=1&content-type=application/json`;
      const data = await getJSON<AdzunaResp>(url);
      // hiring carries weight 1.0. A 429 recorded as "zero open adverts" is the
      // most damaging possible silent failure in this codebase.
      if (data === null || typeof data.count !== 'number') return null;
      return {
        skillId: skill.id,
        sourceId: 'adzuna',
        sourceClass: 'hiring' as const,
        metric: 'open job adverts',
        value: data.count,
      };
    });
    return rows.filter((r): r is Observation => r !== null);
  },
};
