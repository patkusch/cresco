/**
 * The monthly refresh, as data: which npm scripts run, in what order, and
 * which ones may fail without stopping the rest. Kept apart from
 * scripts/refresh.ts so the order and the stop rule are testable offline.
 */
export interface RefreshStep {
  script: string;
  args?: string[];
  /** Why this step exists, printed before it runs. */
  why: string;
  /** A failure here is reported but does not stop the refresh. */
  mayFail?: boolean;
}

export const REFRESH_STEPS: RefreshStep[] = [
  { script: 'backfill', args: ['--extend'], why: 'add each finished hiring month newer than the ledger' },
  { script: 'backtest', why: 're-grade every call against the months now held' },
  { script: 'chart', why: 'redraw docs/leadlag.svg from the new history' },
  // Exits 1 while it is waiting for new data. That is its honest state, not an error.
  { script: 'rescaled-retest', why: 'run the pre-registered GitHub retest if new months allow it', mayFail: true },
];

export interface StepOutcome { script: string; code: number; skipped?: boolean }

/** Run steps in order; stop at the first failure that is not allowed to fail. */
export function runSteps(steps: RefreshStep[], exec: (s: RefreshStep) => number): StepOutcome[] {
  const out: StepOutcome[] = [];
  let stopped = false;
  for (const s of steps) {
    if (stopped) { out.push({ script: s.script, code: -1, skipped: true }); continue; }
    const code = exec(s);
    out.push({ script: s.script, code });
    if (code !== 0 && !s.mayFail) stopped = true;
  }
  return out;
}
