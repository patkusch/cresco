import type { Collector, Evidence, Observation, Skill } from '../types.ts';
import { getJSON, mapLimit, daysAgoUnix } from './http.ts';

interface AlgoliaHit { objectID: string; title?: string; story_title?: string; url?: string; created_at: string; points?: number; }
interface AlgoliaResp { nbHits: number; hits: AlgoliaHit[]; }

/**
 * Hacker News via the Algolia API. Free, unauthenticated, no key ever.
 * Practitioner chatter — an early indicator, and a reliable source of noise,
 * which is exactly why it is weighted below hiring evidence.
 */
export const hackernews: Collector = {
  id: 'hackernews',
  label: 'Hacker News',
  sourceClass: 'practitioner',
  metric: 'stories (90d)',
  isLive: () => true,
  async collect(skills: Skill[]): Promise<Observation[]> {
    const since = daysAgoUnix(90);
    const rows = await mapLimit<Skill, Observation | null>(skills, 4, async (skill) => {
      let total = 0;
      let failed = false;
      const evidence: Evidence[] = [];
      for (const q of skill.queries.slice(0, 2)) {
        const url =
          `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}` +
          `&tags=story&numericFilters=created_at_i>${since}&hitsPerPage=5`;
        const data = await getJSON<AlgoliaResp>(url);
        // A null on one of two queries silently halved this skill's count.
        if (!data) { failed = true; break; }
        total += data.nbHits ?? 0;
        for (const hit of (data.hits ?? []).slice(0, 2)) {
          evidence.push({
            title: hit.title ?? hit.story_title ?? q,
            url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
            source: 'Hacker News',
            sourceClass: 'practitioner',
            ts: hit.created_at,
          });
        }
      }
      if (failed) return null;
      return {
        skillId: skill.id,
        sourceId: 'hackernews',
        sourceClass: 'practitioner' as const,
        metric: 'stories (90d)',
        value: total,
        evidence: evidence.slice(0, 3),
      };
    });
    return rows.filter((r): r is Observation => r !== null);
  },
};
