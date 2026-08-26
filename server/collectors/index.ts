import type { Collector } from '../types.ts';
import { hackernews } from './hackernews.ts';
import { whoshiring } from './whoshiring.ts';
import { bluesky } from './bluesky.ts';
import { reddit } from './reddit.ts';
import { adzuna } from './adzuna.ts';
import { youtube } from './youtube.ts';

export const COLLECTORS: Collector[] = [whoshiring, adzuna, hackernews, reddit, bluesky, youtube];

export { hackernews, whoshiring, bluesky, reddit, adzuna, youtube };
export { fetchLearningPath } from './youtube.ts';
