/**
 * Source classes exist so that a vendor blog post and a paid job advert
 * are never allowed to count as the same kind of evidence.
 */
export type SourceClass = 'hiring' | 'practitioner' | 'community' | 'content' | 'vendor';

export type Verdict =
  | 'rising'        // real demand, climbing
  | 'hype'          // lots of noise, no hiring behind it
  | 'table-stakes'  // high demand, flat — assumed rather than advertised
  | 'cooling'       // demand receding
  | 'baseline';     // not enough history to call it yet

export interface Skill {
  id: string;
  label: string;
  category: string;
  /** Alternative names, so one skill isn't split across three spellings. */
  aliases: string[];
  /** What we actually send to each source. */
  queries: string[];
}

export interface Evidence {
  title: string;
  url: string;
  source: string;
  sourceClass: SourceClass;
  ts: string;
  excerpt?: string;
}

export interface Observation {
  skillId: string;
  sourceId: string;
  sourceClass: SourceClass;
  /** What was counted: job adverts, posts, mentions, videos. */
  metric: string;
  value: number;
  /** True when the number came from bundled fixtures rather than a live call. */
  fixture?: boolean;
  evidence?: Evidence[];
}

export interface Snapshot {
  ts: string;
  /** Which collectors actually ran, and which were skipped for want of a key. */
  sources: { id: string; sourceClass: SourceClass; live: boolean; note?: string }[];
  observations: Observation[];
}

/**
 * A claim is a dated, falsifiable statement with a check-back date.
 * Nothing scores itself yet — v2 does — but every claim is minted with
 * the date on which it becomes gradeable, so the history is already there.
 */
export interface Claim {
  id: string;
  skillId: string;
  verdict: Verdict;
  statement: string;
  confidence: number;
  demandIndex: number;
  signalToNoise: number;
  createdAt: string;
  checkBackAt: string;
  evidence: Evidence[];
  outcome?: 'correct' | 'wrong' | 'partial';
  scoredAt?: string;
  scoringNote?: string;
}

export interface Ledger {
  version: number;
  seeded: boolean;
  snapshots: Snapshot[];
  claims: Claim[];
}

export interface LearningResource {
  title: string;
  url: string;
  channel: string;
  publishedAt: string;
  durationMin: number;
  views: number;
  stage: 'orientation' | 'core' | 'practice';
  score: number;
  fixture?: boolean;
}

export interface SkillSignal {
  skill: Skill;
  demandIndex: number;      // 0-100 composite
  momentum: number;         // % change vs baseline window
  signalToNoise: number;    // 0-1, share of weight coming from substantive sources
  verdict: Verdict;
  substance: number;
  chatter: number;
  history: { ts: string; demandIndex: number }[];
  byClass: Record<SourceClass, number>;
  evidence: Evidence[];
  path: LearningResource[];
}

export interface Collector {
  id: string;
  label: string;
  sourceClass: SourceClass;
  metric: string;
  /** Env var that upgrades this collector from fixture to live, if any. */
  keyVar?: string;
  isLive(): boolean;
  collect(skills: Skill[]): Promise<Observation[]>;
}
