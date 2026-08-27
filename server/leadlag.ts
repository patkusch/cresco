import type { Ledger } from './types.ts';
import type { LeadingData } from './collectors/leading.ts';

/** Shared machinery for the lead-lag question, so the analysis and its validation cannot drift apart. */

export const WINDOW = 3;
export const MAX_LAG = 9;

export const addMonths = (m: string, n: number) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7);
};

export function hiringByMonth(ledger: Ledger): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const snap of ledger.snapshots) {
    const m = snap.ts.slice(0, 7);
    for (const o of snap.observations) {
      if (o.sourceId !== 'whoshiring') continue;
      (out[o.skillId] ??= {})[m] = o.value;
    }
  }
  return out;
}

/** Growth over WINDOW months. Null when the base is too small to divide by safely. */
export function growth(series: Record<string, number>, m: string): number | null {
  const now = series[m];
  const before = series[addMonths(m, -WINDOW)];
  if (now === undefined || before === undefined || before < 1) return null;
  return (now - before) / before;
}

export function pearson(pairs: [number, number][], minN = 8): number | null {
  if (pairs.length < minN) return null;
  const n = pairs.length;
  const mx = pairs.reduce((a, p) => a + p[0], 0) / n;
  const my = pairs.reduce((a, p) => a + p[1], 0) / n;
  let cov = 0, sx = 0, sy = 0;
  for (const [x, y] of pairs) { cov += (x - mx) * (y - my); sx += (x - mx) ** 2; sy += (y - my) ** 2; }
  return sx && sy ? cov / Math.sqrt(sx * sy) : null;
}

export interface PairOpts {
  /** Restrict to these skills — the fit/hold-out split. */
  skills: string[];
  /** Pair each skill's leading series against ANOTHER skill's hiring, to build a null. */
  shuffleMap?: Record<string, string>;
}

export function pairsAtLag(
  leading: LeadingData,
  hiring: Record<string, Record<string, number>>,
  months: string[],
  source: string,
  lag: number,
  opts: PairOpts,
): [number, number][] {
  const pairs: [number, number][] = [];
  for (const skillId of opts.skills) {
    const lead = leading.series[skillId]?.[source];
    const targetSkill = opts.shuffleMap?.[skillId] ?? skillId;
    const hire = hiring[targetSkill];
    if (!lead || !hire) continue;
    for (const m of months) {
      const g1 = growth(lead, m);
      const g2 = growth(hire, addMonths(m, lag));
      if (g1 === null || g2 === null) continue;
      pairs.push([g1, g2]);
    }
  }
  return pairs;
}

/** Deterministic PRNG so a validation run is reproducible. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(list: T[], rand: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
