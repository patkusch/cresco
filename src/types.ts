export type SourceClass = 'hiring' | 'practitioner' | 'community' | 'content' | 'vendor';
export type Verdict = 'rising' | 'hype' | 'table-stakes' | 'cooling' | 'baseline';

export interface Evidence { title: string; url: string; source: string; sourceClass: SourceClass; ts: string; excerpt?: string }
export interface LearningResource {
  title: string; url: string; channel: string; publishedAt: string;
  durationMin: number; views: number; stage: 'orientation' | 'core' | 'practice'; score: number; fixture?: boolean;
}
export interface Skill { id: string; label: string; category: string; aliases: string[]; queries: string[] }

export interface SkillSignal {
  skill: Skill;
  demandIndex: number;
  momentum: number;
  signalToNoise: number;
  verdict: Verdict;
  substance: number;
  chatter: number;
  history: { ts: string; demandIndex: number }[];
  byClass: Record<SourceClass, number>;
  evidence: Evidence[];
  path: LearningResource[];
}

export interface Claim {
  id: string; skillId: string; verdict: Verdict; statement: string;
  demandIndex: number; signalToNoise: number; createdAt: string; checkBackAt: string;
  evidence: Evidence[]; outcome?: 'correct' | 'wrong' | 'partial';
}

export interface DashboardState {
  generatedAt: string;
  seeded: boolean;
  lastRun: string | null;
  snapshotCount: number;
  sources: { id: string; label: string; sourceClass: SourceClass; live: boolean; note?: string; metric: string }[];
  signals: SkillSignal[];
  claims: Claim[];
  due: number;
  accuracy: { scored: number; correct: number; rate: number | null };
}
