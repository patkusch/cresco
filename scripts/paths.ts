import 'dotenv/config';
import { fetchLearningPath } from '../server/collectors/index.ts';
import { SKILLS } from '../server/taxonomy.ts';
import { loadLedger, loadPaths, savePaths } from '../server/ledger.ts';
import { computeSignals } from '../server/signal.ts';

/**
 * Rebuild the free-learning paths only, leaving the ledger untouched.
 *
 * Separate from `collect` because YouTube quota is finite and the paths for a
 * table-stakes skill do not change weekly, while a collection run should be
 * cheap enough to schedule.
 */
async function main() {
  const ledger = loadLedger();
  const signals = computeSignals(ledger, {});
  const worth = signals.filter((s) => s.verdict !== 'baseline').slice(0, 15);
  const paths = loadPaths();

  console.log(`building paths for ${worth.length} skills with a live verdict\n`);
  for (const s of worth) {
    const path = await fetchLearningPath(s.skill);
    paths[s.skill.id] = path;
    const live = path.some((p) => !p.fixture);
    console.log(`  ${live ? 'live   ' : 'fixture'}  ${s.skill.label.padEnd(32)} ${path.length} resources`);
  }
  for (const skill of SKILLS) if (!paths[skill.id]) paths[skill.id] = await fetchLearningPath(skill);

  savePaths(paths);
  console.log('\nsaved');
}
main();
