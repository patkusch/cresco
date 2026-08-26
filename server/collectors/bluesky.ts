import type { Collector, Evidence, Observation, Skill } from '../types.ts';
import { getJSON, mapLimit } from './http.ts';

interface Post { uri: string; author: { handle: string }; record: { text?: string; createdAt?: string }; }
interface SearchResp { posts: Post[]; }

/**
 * Bluesky's public AT Protocol endpoints — free, no auth, no scraping.
 * This is the social signal that is actually legal and actually open;
 * X is paid-tier now and LinkedIn has no public API worth the risk.
 */
export const bluesky: Collector = {
  id: 'bluesky',
  label: 'Bluesky',
  sourceClass: 'community',
  metric: 'recent posts',
  isLive: () => true,
  async collect(skills: Skill[]): Promise<Observation[]> {
    return mapLimit(skills, 3, async (skill) => {
      const q = skill.queries[0];
      const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&limit=25`;
      const data = await getJSON<SearchResp>(url);
      const posts = data?.posts ?? [];
      const evidence: Evidence[] = posts.slice(0, 2).map((p) => ({
        title: (p.record.text ?? '').slice(0, 140) || q,
        url: `https://bsky.app/profile/${p.author.handle}`,
        source: 'Bluesky',
        sourceClass: 'community' as const,
        ts: p.record.createdAt ?? new Date().toISOString(),
      }));
      return {
        skillId: skill.id,
        sourceId: 'bluesky',
        sourceClass: 'community' as const,
        metric: 'recent posts',
        value: posts.length,
        evidence,
      };
    });
  },
};
