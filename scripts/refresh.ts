import { spawnSync } from 'node:child_process';
import { REFRESH_STEPS, runSteps } from '../server/refresh.ts';

/**
 * `npm run refresh`: the whole monthly update in one command. Adds new
 * finished hiring months, re-grades every call, redraws the chart and runs
 * the pre-registered retest. Stops at the first step that fails, except the
 * retest, which exits 1 while it waits for data.
 */
const results = runSteps(REFRESH_STEPS, (s) => {
  console.log(`\n── npm run ${s.script}${s.args ? ' -- ' + s.args.join(' ') : ''}  (${s.why})`);
  const r = spawnSync('npm', ['run', '--silent', s.script, ...(s.args ? ['--', ...s.args] : [])], { stdio: 'inherit' });
  return r.status ?? 1;
});

console.log('\n── refresh summary');
for (const r of results) {
  const step = REFRESH_STEPS.find((s) => s.script === r.script)!;
  const state = r.skipped ? 'skipped' : r.code === 0 ? 'ok' : step.mayFail ? `exit ${r.code} (allowed)` : `FAILED (exit ${r.code})`;
  console.log(`  ${r.script.padEnd(16)} ${state}`);
}
const failed = results.some((r) => r.code !== 0 && !REFRESH_STEPS.find((s) => s.script === r.script)!.mayFail);
if (!failed) console.log('\nCheck the diff in data/ and docs/, then update the README numbers and commit.');
process.exit(failed ? 1 : 0);
