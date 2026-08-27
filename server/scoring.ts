import type { Claim, SkillSignal } from './types.ts';

/**
 * Grading a call against what actually happened.
 *
 * These thresholds are deliberately strict and symmetric: every rule that can
 * return `correct` can also return `wrong` from the opposite movement. A scoring
 * rule that cannot fail is not a scoring rule, it is decoration — and a system
 * that publishes its own hit rate has an obvious incentive to grade itself
 * generously, so the rules are written down here rather than being implied by
 * whatever the code happens to do.
 *
 * `partial` means the call was directionally defensible but weak: the skill went
 * flat when we said it would climb, say. It counts as scored and it does NOT
 * count as correct.
 */

/** How much the index must move for the movement to count as real rather than noise. */
const MOVE = 0.05;
/** How much the hiring share must climb for a hype call to be judged converted. */
const CONVERTED = 0.1;

export interface Scoring {
  outcome: 'correct' | 'wrong' | 'partial';
  note: string;
}

const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round(((a - b) / b) * 100));

export function scoreClaim(claim: Claim, then: SkillSignal): Scoring {
  const was = claim.demandIndex;
  const now = then.demandIndex;
  const change = pct(now, was);
  const snrChange = Math.round((then.signalToNoise - claim.signalToNoise) * 100) / 100;
  const moved = `index ${was} → ${now} (${change > 0 ? '+' : ''}${change}%)`;

  switch (claim.verdict) {
    case 'rising':
      if (now >= was * (1 + MOVE)) return { outcome: 'correct', note: `kept climbing — ${moved}` };
      if (now <= was * (1 - MOVE)) return { outcome: 'wrong', note: `fell instead — ${moved}` };
      return { outcome: 'partial', note: `went flat rather than climbing — ${moved}` };

    case 'cooling':
      if (now <= was * (1 - MOVE)) return { outcome: 'correct', note: `kept receding — ${moved}` };
      if (now >= was * (1 + MOVE)) return { outcome: 'wrong', note: `recovered — ${moved}` };
      return { outcome: 'partial', note: `levelled off rather than falling — ${moved}` };

    case 'table-stakes':
      // The claim is "high and steady", so it fails in both directions: a collapse
      // means it was not table stakes, and a surge means it was actually rising.
      if (now < was * 0.75) return { outcome: 'wrong', note: `collapsed, so it was not assumed demand — ${moved}` };
      if (now > was * 1.25) return { outcome: 'wrong', note: `surged, so this was a rise we missed — ${moved}` };
      if (now >= was * 0.9) return { outcome: 'correct', note: `held steady — ${moved}` };
      return { outcome: 'partial', note: `slipped but did not collapse — ${moved}` };

    case 'hype':
      // The claim is "talk is running ahead of anyone paying, expect it to fade
      // rather than convert". It is wrong precisely when hiring DOES follow.
      if (snrChange >= CONVERTED && now >= was * (1 - MOVE)) {
        return { outcome: 'wrong', note: `converted into real hiring — signal share ${claim.signalToNoise} → ${then.signalToNoise}` };
      }
      if (now <= was * (1 - MOVE)) return { outcome: 'correct', note: `faded as called — ${moved}` };
      if (snrChange <= 0) return { outcome: 'correct', note: `stayed loud but hiring never followed — signal share ${claim.signalToNoise} → ${then.signalToNoise}` };
      return { outcome: 'partial', note: `held up without clearly converting — ${moved}` };

    default:
      return { outcome: 'partial', note: 'no call to grade' };
  }
}

export function accuracyByVerdict(claims: Claim[]) {
  const out: Record<string, { scored: number; correct: number; wrong: number; partial: number; rate: number | null }> = {};
  for (const c of claims) {
    if (!c.outcome) continue;
    const row = (out[c.verdict] ??= { scored: 0, correct: 0, wrong: 0, partial: 0, rate: null });
    row.scored++;
    row[c.outcome]++;
  }
  for (const row of Object.values(out)) row.rate = row.scored ? Math.round((row.correct / row.scored) * 100) : null;
  return out;
}
