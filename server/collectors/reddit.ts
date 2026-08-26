import type { Collector, Observation, Skill } from '../types.ts';
import { getJSON, mapLimit } from './http.ts';

interface RedditResp { data?: { children: { data: { title: string; permalink: string; created_utc: number } }[] } }

/**
 * Reddit's public JSON endpoints. Best-effort and deliberately un-credentialed:
 * rate limits are real, and a failed call reports nothing rather than a zero.
 */
export const reddit: Collector = {
  id: 'reddit',
  label: 'Reddit',
  sourceClass: 'community',
  metric: 'posts (month)',
  isLive: () => true,
  async collect(skills: Skill[]): Promise<Observation[]> {
    const results = await mapLimit<Skill, Observation | null>(skills, 2, async (skill) => {
      const q = skill.queries[0];
      const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&t=month&limit=25`;
      const data = await getJSON<RedditResp>(url);
      if (!data?.data) return null;
      const children = data.data.children ?? [];
      return {
        skillId: skill.id,
        sourceId: 'reddit',
        sourceClass: 'community' as const,
        metric: 'posts (month)',
        value: children.length,
        evidence: children.slice(0, 2).map((c) => ({
          title: c.data.title,
          url: `https://reddit.com${c.data.permalink}`,
          source: 'Reddit',
          sourceClass: 'community' as const,
          ts: new Date(c.data.created_utc * 1000).toISOString(),
        })),
      };
    });
    return results.filter((r): r is Observation => r !== null);
  },
};
