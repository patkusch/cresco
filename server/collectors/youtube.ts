import type { Collector, LearningResource, Observation, Skill } from '../types.ts';
import { getJSON, mapLimit } from './http.ts';
import { loadFixture } from './fixtures.ts';

interface SearchItem { id: { videoId: string }; snippet: { title: string; channelTitle: string; publishedAt: string } }
interface SearchResp { items?: SearchItem[]; pageInfo?: { totalResults?: number } }
interface VideoItem { id: string; contentDetails?: { duration?: string }; statistics?: { viewCount?: string } }
interface VideosResp { items?: VideoItem[] }

const key = () => process.env.YOUTUBE_API_KEY || '';
export const youtubeIsLive = () => Boolean(key());

/** PT1H23M45S -> minutes */
function parseDuration(iso: string | undefined): number {
  if (!iso) return 0;
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso);
  if (!m) return 0;
  return (+(m[1] ?? 0)) * 60 + (+(m[2] ?? 0)) + Math.round((+(m[3] ?? 0)) / 60);
}

/**
 * YouTube as a *demand* signal is weak — content volume follows hype, it does not
 * predict hiring — so it is weighted low. YouTube as a *supply* signal is the whole
 * point of the product: once a skill is spiking, this is where you learn it for free.
 */
export const youtube: Collector = {
  id: 'youtube',
  label: 'YouTube',
  sourceClass: 'content',
  metric: 'videos (6mo)',
  keyVar: 'YOUTUBE_API_KEY',
  isLive: youtubeIsLive,
  async collect(skills: Skill[]): Promise<Observation[]> {
    if (!youtubeIsLive()) return loadFixture('youtube', skills, 'content', 'videos (6mo)');
    const publishedAfter = new Date(Date.now() - 182 * 86_400_000).toISOString();
    const rows = await mapLimit<Skill, Observation | null>(skills, 2, async (skill) => {
      const url =
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1` +
        `&q=${encodeURIComponent(skill.queries[0])}&publishedAfter=${publishedAfter}&key=${key()}`;
      const data = await getJSON<SearchResp>(url);
      // A 403 from quota exhaustion is not "no videos exist about Kubernetes".
      if (data === null || typeof data.pageInfo?.totalResults !== 'number') return null;
      return {
        skillId: skill.id,
        sourceId: 'youtube',
        sourceClass: 'content' as const,
        metric: 'videos (6mo)',
        value: data.pageInfo.totalResults,
      };
    });
    return rows.filter((r): r is Observation => r !== null);
  },
};

const STAGE_BY_LENGTH = (mins: number): LearningResource['stage'] =>
  mins >= 90 ? 'core' : mins >= 25 ? 'practice' : 'orientation';

/**
 * Build a free learning path for one skill: an orientation piece, a long-form
 * core course, and something project-shaped. Ranked on recency, reach and
 * length-fit — and forced to span distinct channels, because three videos from
 * the same creator is one opinion, not a path.
 */
export async function fetchLearningPath(skill: Skill): Promise<LearningResource[]> {
  if (!youtubeIsLive()) return fixturePath(skill);

  const search = await getJSON<SearchResp>(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=20&order=relevance` +
      `&q=${encodeURIComponent(skill.queries[0] + ' tutorial course')}&key=${key()}`,
  );
  const items = search?.items ?? [];
  if (!items.length) return fixturePath(skill);

  const ids = items.map((i) => i.id.videoId).filter(Boolean).join(',');
  const details = await getJSON<VideosResp>(
    `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${ids}&key=${key()}`,
  );
  const byId = new Map((details?.items ?? []).map((v) => [v.id, v]));

  const now = Date.now();
  const scored: LearningResource[] = items.map((item) => {
    const v = byId.get(item.id.videoId);
    const durationMin = parseDuration(v?.contentDetails?.duration);
    const views = Number(v?.statistics?.viewCount ?? 0);
    const ageDays = (now - new Date(item.snippet.publishedAt).getTime()) / 86_400_000;
    const recency = Math.max(0, 1 - ageDays / 730);          // two-year horizon
    const reach = Math.min(1, Math.log10(views + 10) / 6);   // ~1M views saturates
    const depth = Math.min(1, durationMin / 120);            // long-form rewarded
    return {
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      channel: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      durationMin,
      views,
      stage: STAGE_BY_LENGTH(durationMin),
      score: Math.round((0.4 * recency + 0.3 * reach + 0.3 * depth) * 100) / 100,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const seenChannels = new Set<string>();
  const path: LearningResource[] = [];
  for (const stage of ['orientation', 'core', 'practice'] as const) {
    const pick = scored.find((r) => r.stage === stage && !seenChannels.has(r.channel));
    if (pick) {
      seenChannels.add(pick.channel);
      path.push(pick);
    }
  }
  // Top up if a stage had nothing.
  for (const r of scored) {
    if (path.length >= 3) break;
    if (!path.includes(r) && !seenChannels.has(r.channel)) {
      seenChannels.add(r.channel);
      path.push(r);
    }
  }
  return path;
}

/**
 * With no API key we do NOT invent videos. Fabricated titles and video IDs would
 * look real and be worthless. Instead each slot links to the real YouTube search
 * that would have produced it, and is flagged as a placeholder in the UI.
 */
function fixturePath(skill: Skill): LearningResource[] {
  const stages: { stage: LearningResource['stage']; suffix: string; mins: number }[] = [
    { stage: 'orientation', suffix: 'explained', mins: 15 },
    { stage: 'core', suffix: 'full course', mins: 120 },
    { stage: 'practice', suffix: 'build a project', mins: 45 },
  ];
  return stages.map(({ stage, suffix, mins }) => ({
    title: `${skill.label} — ${suffix}`,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${skill.queries[0]} ${suffix}`)}`,
    channel: 'YouTube search',
    publishedAt: new Date().toISOString(),
    durationMin: mins,
    views: 0,
    stage,
    score: 0,
    fixture: true,
  }));
}
