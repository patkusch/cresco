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
  metric: 'recent posts (capped at 100)',
  isLive: () => true,
  async collect(skills: Skill[]): Promise<Observation[]> {
    const rows = await mapLimit<Skill, Observation | null>(skills, 3, async (skill) => {
      const q = skill.queries[0];
      const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&limit=100`;
      const data = await getJSON<SearchResp>(url);
      // Two failures were stacked here. A null became "0 posts"; and at limit=25
      // the value saturated, so every genuinely active skill read exactly 25 and
      // the number could only ever move down. That is the hitsPerPage=60 failure
      // wearing a different costume — the cap is now named in the metric so a
      // saturated series is at least legible rather than silently flat.
      if (data === null) return null;
      const posts = data.posts ?? [];
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
        metric: 'recent posts (capped at 100)',
        value: posts.length,
        evidence,
      };
    });
    return rows.filter((r): r is Observation => r !== null);
  },
};
