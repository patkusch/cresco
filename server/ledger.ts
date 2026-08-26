import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Claim, Ledger, LearningResource, SkillSignal, Snapshot } from './types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const LEDGER_PATH = join(DATA, 'ledger.json');
const PATHS_PATH = join(DATA, 'paths.json');

const EMPTY: Ledger = { version: 1, seeded: false, snapshots: [], claims: [] };

export function loadLedger(): Ledger {
  if (!existsSync(LEDGER_PATH)) return { ...EMPTY };
  try {
    return JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) as Ledger;
  } catch {
    return { ...EMPTY };
  }
}

export function saveLedger(ledger: Ledger): void {
  mkdirSync(DATA, { recursive: true });
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

export function loadPaths(): Record<string, LearningResource[]> {
  if (!existsSync(PATHS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(PATHS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export function savePaths(paths: Record<string, LearningResource[]>): void {
  mkdirSync(DATA, { recursive: true });
  writeFileSync(PATHS_PATH, JSON.stringify(paths, null, 2));
}

export function appendSnapshot(ledger: Ledger, snapshot: Snapshot): Ledger {
  return { ...ledger, snapshots: [...ledger.snapshots, snapshot] };
}

const DAY = 86_400_000;

function statementFor(s: SkillSignal): string {
  switch (s.verdict) {
    case 'rising':
      return `${s.skill.label} demand is genuinely climbing (${s.momentum > 0 ? '+' : ''}${s.momentum}%), and the rise is carried by hiring evidence rather than chatter.`;
    case 'hype':
      return `${s.skill.label} is spiking on ${Math.round((1 - s.signalToNoise) * 100)}% noise — talk is running ahead of anyone paying for it. Expect this to fade rather than convert.`;
    case 'cooling':
      return `${s.skill.label} demand is receding (${s.momentum}%). Not worth starting from scratch this quarter.`;
    case 'table-stakes':
      return `${s.skill.label} is assumed rather than advertised — high steady demand, little noise. Gaps here cost you quietly.`;
    default:
      return `${s.skill.label} has no call yet — not enough history to say anything honest.`;
  }
}

/**
 * Mint a dated, falsifiable claim per skill worth calling.
 *
 * Nothing scores these yet. The point is that the check-back date exists from
 * day one, so when the scoring loop lands it has real history to grade rather
 * than starting from zero. A prediction with no date attached is an opinion.
 */
export function mintClaims(ledger: Ledger, signals: SkillSignal[], now = new Date()): Claim[] {
  const horizon: Record<string, number> = { rising: 90, hype: 90, cooling: 180, 'table-stakes': 180, baseline: 0 };
  const fresh: Claim[] = [];

  for (const s of signals) {
    if (s.verdict === 'baseline') continue;
    // One open claim per skill+verdict; re-minting every run would flood the ledger.
    const open = ledger.claims.find((c) => c.skillId === s.skill.id && c.verdict === s.verdict && !c.outcome);
    if (open) continue;

    fresh.push({
      id: `${s.skill.id}-${s.verdict}-${now.toISOString().slice(0, 10)}`,
      skillId: s.skill.id,
      verdict: s.verdict,
      statement: statementFor(s),
      confidence: 0,
      demandIndex: s.demandIndex,
      signalToNoise: s.signalToNoise,
      createdAt: now.toISOString(),
      checkBackAt: new Date(now.getTime() + horizon[s.verdict] * DAY).toISOString(),
      evidence: s.evidence.slice(0, 3),
    });
  }
  return fresh;
}

/** Claims whose check-back date has passed and which nothing has graded yet. */
export function dueClaims(ledger: Ledger, now = new Date()): Claim[] {
  return ledger.claims.filter((c) => !c.outcome && new Date(c.checkBackAt) <= now);
}

export function accuracy(ledger: Ledger): { scored: number; correct: number; rate: number | null } {
  const scored = ledger.claims.filter((c) => c.outcome);
  const correct = scored.filter((c) => c.outcome === 'correct').length;
  return { scored: scored.length, correct, rate: scored.length ? Math.round((correct / scored.length) * 100) : null };
}
