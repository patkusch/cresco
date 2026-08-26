import { COLLECTORS, fetchLearningPath } from './collectors/index.ts';
import { SKILLS } from './taxonomy.ts';
import { computeSignals } from './signal.ts';
import { appendSnapshot, loadLedger, loadPaths, mintClaims, savePaths, saveLedger, dueClaims, accuracy } from './ledger.ts';
import type { Observation, Snapshot } from './types.ts';

export interface RunReport {
  ts: string;
  sources: { id: string; label: string; live: boolean; observations: number }[];
  newClaims: number;
  changed: boolean;
  note: string;
}

/**
 * One collection run.
 *
 * A run that finds nothing materially new says so and is a success. Unattended
 * research agents that must justify their slot every week invent novelty; this
 * one is allowed to report "no material change" and stop.
 */
export async function runCollection(opts: { refreshPaths?: boolean } = {}): Promise<RunReport> {
  const ts = new Date().toISOString();
  const observations: Observation[] = [];
  const sourceMeta: Snapshot['sources'] = [];
  const report: RunReport['sources'] = [];

  for (const collector of COLLECTORS) {
    let obs: Observation[] = [];
    try {
      obs = await collector.collect(SKILLS);
    } catch {
      obs = [];
    }
    const live = collector.isLive() && obs.some((o) => !o.fixture);
    observations.push(...obs);
    sourceMeta.push({
      id: collector.id,
      sourceClass: collector.sourceClass,
      live,
      note: live ? undefined : collector.keyVar ? `no ${collector.keyVar} — fixture` : 'unreachable this run',
    });
    report.push({ id: collector.id, label: collector.label, live, observations: obs.length });
  }

  let ledger = loadLedger();
  const before = computeSignals(ledger, loadPaths());
  ledger = appendSnapshot(ledger, { ts, sources: sourceMeta, observations });

  let paths = loadPaths();
  if (opts.refreshPaths) {
    const signals = computeSignals(ledger, paths);
    // Only refresh paths for what is actually worth learning — YouTube quota is finite.
    const worth = signals.filter((s) => s.verdict === 'rising' || s.verdict === 'table-stakes').slice(0, 12);
    for (const s of worth) {
      paths[s.skill.id] = await fetchLearningPath(s.skill);
    }
    for (const skill of SKILLS) {
      if (!paths[skill.id]) paths[skill.id] = await fetchLearningPath(skill);
    }
    savePaths(paths);
  }

  const after = computeSignals(ledger, paths);
  const fresh = mintClaims(ledger, after);
  ledger.claims = [...ledger.claims, ...fresh];
  saveLedger(ledger);

  const moved = after.filter((s) => {
    const prev = before.find((b) => b.skill.id === s.skill.id);
    return prev && (prev.verdict !== s.verdict || Math.abs(prev.demandIndex - s.demandIndex) >= 5);
  });

  const changed = fresh.length > 0 || moved.length > 0;
  return {
    ts,
    sources: report,
    newClaims: fresh.length,
    changed,
    note: changed
      ? `${moved.length} skill${moved.length === 1 ? '' : 's'} moved, ${fresh.length} new claim${fresh.length === 1 ? '' : 's'}.`
      : 'No material change. Nothing worth your attention this run.',
  };
}

export function buildState() {
  const ledger = loadLedger();
  const paths = loadPaths();
  const signals = computeSignals(ledger, paths);
  const latest = ledger.snapshots[ledger.snapshots.length - 1];

  return {
    generatedAt: new Date().toISOString(),
    seeded: ledger.seeded,
    lastRun: latest?.ts ?? null,
    snapshotCount: ledger.snapshots.length,
    sources: (latest?.sources ?? []).map((s) => {
      const c = COLLECTORS.find((c) => c.id === s.id);
      return { ...s, label: c?.label ?? s.id, metric: c?.metric ?? '' };
    }),
    signals,
    claims: ledger.claims.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    due: dueClaims(ledger).length,
    accuracy: accuracy(ledger),
  };
}

export type DashboardState = ReturnType<typeof buildState>;
