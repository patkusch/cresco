import type { Collector, Observation, Skill } from '../types.ts';
import { getJSON } from './http.ts';
import { skillsMentionedIn } from '../taxonomy.ts';

interface AlgoliaResp { hits: { objectID: string; title: string; created_at: string }[]; }
interface HNItem { children?: HNItem[]; text?: string | null; }

/**
 * The monthly "Ask HN: Who is hiring?" threads, counted properly.
 *
 * This is the sharpest free hiring signal on the open web and almost nobody
 * mines it: every comment is one company describing one real open role, in
 * plain text, dated, with no recruiter SEO padding. No key required.
 */
export const whoshiring: Collector = {
  id: 'whoshiring',
  label: 'HN Who is Hiring',
  sourceClass: 'hiring',
  metric: 'job posts mentioning skill',
  isLive: () => true,
  async collect(skills: Skill[]): Promise<Observation[]> {
    const search = await getJSON<AlgoliaResp>(
      'https://hn.algolia.com/api/v1/search?query=' +
        encodeURIComponent('Ask HN: Who is hiring?') +
        '&tags=story&hitsPerPage=3',
    );
    const counts = new Map<string, number>();
    let posts = 0;

    for (const story of search?.hits ?? []) {
      const thread = await getJSON<HNItem>(`https://hn.algolia.com/api/v1/items/${story.objectID}`);
      for (const comment of thread?.children ?? []) {
        const text = comment.text;
        if (!text) continue;
        posts++;
        for (const id of new Set(skillsMentionedIn(text))) {
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      }
    }

    // No thread reachable (offline, rate limited): report nothing rather than zeros,
    // because "zero jobs mention Kubernetes" is a lie and a flat line is not.
    if (posts === 0) return [];

    return skills.map((skill: Skill): Observation => ({
      skillId: skill.id,
      sourceId: 'whoshiring',
      sourceClass: 'hiring',
      metric: 'job posts mentioning skill',
      value: counts.get(skill.id) ?? 0,
    }));
  },
};
