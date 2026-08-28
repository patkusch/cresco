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
  metric: 'per 1,000 job posts',
  isLive: () => true,
  async collect(skills: Skill[]): Promise<Observation[]> {
    // search_by_date, not search, plus a title filter — the same two fixes the
    // backfill needed. Relevance ranking returns the most-discussed threads, which
    // skews years old; and without the filter a "wants to be hired" or "freelancer"
    // thread gets counted as hiring demand.
    const search = await getJSON<AlgoliaResp>(
      'https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=60',
    );
    const threads = (search?.hits ?? [])
      .filter((h) => /who is hiring/i.test(h.title) && !/wants to be hired|freelancer/i.test(h.title))
      .slice(0, 3);
    const counts = new Map<string, number>();
    let posts = 0;
    let read = 0;

    for (const story of threads) {
      const thread = await getJSON<HNItem>(`https://hn.algolia.com/api/v1/items/${story.objectID}`);
      if (!thread?.children?.length) continue;
      read++;
      for (const comment of thread.children) {
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
    // One throttled thread out of three silently computed the share over fewer
    // threads than intended, with nothing marking it.
    if (posts === 0 || read < threads.length) return [];

    return skills.map((skill: Skill): Observation => ({
      skillId: skill.id,
      sourceId: 'whoshiring',
      sourceClass: 'hiring',
      metric: 'per 1,000 job posts',
      // Share, not volume — thread size swings by 40% month to month.
      value: Math.round(((counts.get(skill.id) ?? 0) / posts) * 1000 * 10) / 10,
    }));
  },
};
