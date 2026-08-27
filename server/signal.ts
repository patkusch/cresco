import type { Evidence, Ledger, Observation, SkillSignal, Snapshot, SourceClass, Verdict } from './types.ts';
import { SKILLS } from './taxonomy.ts';

/**
 * Source weighting is the entire signal-to-noise story.
 *
 * A skill named in a paid job advert is someone committing money to it.
 * A skill trending on social is someone committing a sentence to it.
 * Weighting them equally is how "learn this now!" lists get written, and it
 * is why they are wrong. Content volume is weighted lowest of all: YouTube
 * supply follows hype, it does not predict hiring.
 */
export const CLASS_WEIGHTS: Record<SourceClass, number> = {
  hiring: 1.0,
  practitioner: 0.7,
  community: 0.45,
  content: 0.35,
  vendor: 0.2,
};

/**
 * Signal-to-noise asks exactly one question: what share of this skill's evidence
 * is someone *paying* for?
 *
 * Practitioner chatter is better evidence than social chatter, and is weighted
 * accordingly above — but it is still talk, and counting it as substance is what
 * let a skill with 95 job adverts and a wall of blog posts read as real demand.
 * Only money counts here.
 */
const SUBSTANTIVE: SourceClass[] = ['hiring'];

/**
 * A source only enters the index once it has this much history of its own.
 *
 * Otherwise adding a new collector rewrites the present without touching the
 * past: the newest snapshot gains a term every earlier one lacks, and the jump
 * shows up as momentum that nothing in the world actually caused. New sources
 * still contribute evidence and learning paths immediately — they just do not
 * get a vote on the score until they can be compared with themselves.
 */
export const MIN_SNAPSHOTS_FOR_INDEX = 3;

export function indexableSources(snapshots: Snapshot[]): Set<string> {
  const seen = new Map<string, number>();
  for (const s of snapshots) {
    for (const id of new Set(s.observations.map((o) => o.sourceId))) {
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
  }
  return new Set([...seen].filter(([, n]) => n >= MIN_SNAPSHOTS_FOR_INDEX).map(([id]) => id));
}

/**
 * Max-scale each source so 4,000 job adverts and 25 Bluesky posts can be compared
 * at all — but against a scale computed over the WHOLE ledger, never the current
 * snapshot.
 *
 * Scaling per-snapshot silently destroys the thing we are trying to measure: if
 * every skill grows, the snapshot max grows with them and the whole board reads
 * as flat. A fixed reference scale keeps growth over time visible, which is the
 * entire point of keeping a ledger rather than a reading.
 */
export function referenceScale(snapshots: Snapshot[]): Map<string, number> {
  const max = new Map<string, number>();
  for (const s of snapshots) {
    for (const o of s.observations) {
      max.set(o.sourceId, Math.max(max.get(o.sourceId) ?? 0, o.value));
    }
  }
  return max;
}

interface Scored {
  demandIndex: number;
  substance: number;
  chatter: number;
  signalToNoise: number;
  byClass: Record<SourceClass, number>;
  liveSources: number;
  hiringIsFixture: boolean;
}

function scoreSnapshot(
  snapshot: Snapshot,
  skillId: string,
  scale: Map<string, number>,
  indexable: Set<string>,
  allowFixtures: boolean,
): Scored {
  const mine = snapshot.observations.filter(
    (o) => o.skillId === skillId && indexable.has(o.sourceId) && (allowFixtures || !o.fixture),
  );

  const byClass = { hiring: 0, practitioner: 0, community: 0, content: 0, vendor: 0 } as Record<SourceClass, number>;
  const counts = { hiring: 0, practitioner: 0, community: 0, content: 0, vendor: 0 } as Record<SourceClass, number>;

  let liveSources = 0;
  let hiringIsFixture = false;

  for (const o of mine) {
    const ref = scale.get(o.sourceId) ?? 0;
    const v = ref > 0 ? Math.min(1, o.value / ref) : 0;
    byClass[o.sourceClass] += v;
    counts[o.sourceClass] += 1;
    if (!o.fixture) liveSources += 1;
    if (o.sourceClass === 'hiring' && o.fixture) hiringIsFixture = true;
  }
  for (const c of Object.keys(byClass) as SourceClass[]) {
    if (counts[c] > 0) byClass[c] /= counts[c];
  }

  let weighted = 0;
  let weightSum = 0;
  let substance = 0;
  let chatter = 0;
  for (const c of Object.keys(byClass) as SourceClass[]) {
    if (counts[c] === 0) continue;
    const w = CLASS_WEIGHTS[c];
    weighted += byClass[c] * w;
    weightSum += w;
    if (SUBSTANTIVE.includes(c)) substance += byClass[c] * w;
    else chatter += byClass[c] * w;
  }

  const denom = substance + chatter;
  return {
    demandIndex: weightSum > 0 ? Math.round((weighted / weightSum) * 100) : 0,
    substance: Math.round(substance * 100) / 100,
    chatter: Math.round(chatter * 100) / 100,
    signalToNoise: denom > 0 ? Math.round((substance / denom) * 100) / 100 : 0,
    byClass,
    liveSources,
    hiringIsFixture,
  };
}

function classify(history: number[], momentum: number, demandIndex: number, snr: number): Verdict {
  if (history.length < 3) return 'baseline';
  // One job advert swinging to two is a 100% rise and means nothing. Below this
  // floor there is not enough evidence to say anything honest.
  if (demandIndex < 3) return 'baseline';
  if (momentum >= 18 && snr < 0.3) return 'hype';
  if (momentum >= 12) return 'rising';
  if (momentum <= -12) return 'cooling';
  if (demandIndex >= 45 && snr >= 0.3) return 'table-stakes';
  return 'baseline';
}

export function momentumOf(history: number[]): number {
  if (history.length < 3) return 0;
  const recent = history.slice(-2);
  const baseline = history.slice(Math.max(0, history.length - 6), history.length - 2);
  if (!baseline.length) return 0;
  const r = recent.reduce((a, b) => a + b, 0) / recent.length;
  const b = baseline.reduce((a, b) => a + b, 0) / baseline.length;
  return Math.round(((r - b) / Math.max(b, 1)) * 100);
}

export function confidenceOf(liveSources: number, historyLen: number, hiringIsFixture: boolean): number {
  let c = 0.2 + 0.1 * liveSources + 0.04 * Math.min(historyLen, 8);
  if (hiringIsFixture) c -= 0.2; // the load-bearing signal is sample data — say so in the number
  return Math.max(0.05, Math.min(0.95, Math.round(c * 100) / 100));
}

export function computeSignals(ledger: Ledger, paths: Record<string, any[]> = {}): SkillSignal[] {
  const snapshots = ledger.snapshots;
  if (!snapshots.length) return [];

  const scale = referenceScale(snapshots);
  const indexable = indexableSources(snapshots);
  // A demo ledger is sample data throughout and labels itself as such. A real one
  // never lets sample data score: a collector falling back to fixtures for want of
  // an API key must not quietly contribute invented numbers to a real measurement.
  const allowFixtures = ledger.seeded;

  return SKILLS.map((skill): SkillSignal => {
    const scoredHistory = snapshots.map((s) => ({ ts: s.ts, ...scoreSnapshot(s, skill.id, scale, indexable, allowFixtures) }));
    const latest = scoredHistory[scoredHistory.length - 1];
    const series = scoredHistory.map((h) => h.demandIndex);
    const momentum = momentumOf(series);
    const verdict = classify(series, momentum, latest.demandIndex, latest.signalToNoise);

    const evidence: Evidence[] = [];
    for (const o of snapshots[snapshots.length - 1].observations) {
      if (o.skillId === skill.id && o.evidence) evidence.push(...o.evidence);
    }

    return {
      skill,
      demandIndex: latest.demandIndex,
      momentum,
      signalToNoise: latest.signalToNoise,
      verdict,
      substance: latest.substance,
      chatter: latest.chatter,
      history: scoredHistory.map((h) => ({ ts: h.ts, demandIndex: h.demandIndex })),
      byClass: latest.byClass,
      evidence: evidence.slice(0, 5),
      path: (paths[skill.id] ?? []) as any,
    };
  }).sort((a, b) => b.demandIndex - a.demandIndex);
}

export function scoredSnapshotMeta(ledger: Ledger, skillId: string) {
  const latest = ledger.snapshots[ledger.snapshots.length - 1];
  return latest
    ? scoreSnapshot(latest, skillId, referenceScale(ledger.snapshots), indexableSources(ledger.snapshots), ledger.seeded)
    : null;
}
