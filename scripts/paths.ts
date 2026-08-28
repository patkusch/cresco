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
  // Established first: a path exists to close a gap in what is already expected of
  // you. A free course on a receding skill is bad advice however good the course is,
  // so those are built last and only if quota allows.
  const established = signals.filter((s) => s.verdict === 'table-stakes');
  const rest = signals.filter((s) => s.verdict === 'rising' || s.verdict === 'hype');
  const worth = [...established, ...rest].slice(0, Number(process.env.PATH_LIMIT ?? 20));
  const paths = loadPaths();

  console.log(`building paths for ${worth.length} skills (${established.length} established first)\n`);
  for (const s of worth) {
    const path = await fetchLearningPath(s.skill);
    paths[s.skill.id] = path;
    const live = path.some((p) => !p.fixture);
    console.log(`  ${live ? 'live   ' : 'fixture'}  ${s.skill.label.padEnd(32)} ${path.length} resources`);
  }
  // Everything else gets a fixture path (a real YouTube search link), so no skill
  // in the UI is a dead end — but live quota is spent where it earns something.
  for (const skill of SKILLS) if (!paths[skill.id]) paths[skill.id] = await fetchLearningPath(skill);

  savePaths(paths);
  console.log('\nsaved');
}
main();
