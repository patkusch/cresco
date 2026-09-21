import 'dotenv/config';
import { CollectRefused, runCollection } from '../server/pipeline.ts';

/**
 * One unattended run. Wire to cron/launchd and it accumulates while you are away:
 *   0 7 * * 1  cd /path/to/cresco && npm run collect
 *
 * It refuses to add real numbers to a ledger flagged seeded (sample data), so the
 * two are never scored together. `--force` drops the sample data and starts a real
 * ledger from this run (see server/backfill-guard.ts).
 * `CRESCO_DATA_DIR` points the script at another data directory (used by tests).
 */
let report;
try {
  report = await runCollection({
    refreshPaths: process.argv.includes('--paths'),
    force: process.argv.includes('--force'),
  });
} catch (err) {
  if (!(err instanceof CollectRefused)) throw err;
  console.error(err.message);
  console.error('Nothing written — the existing ledger is untouched.');
  process.exit(1);
}

console.log(`\ncresco run ${report.ts}`);
for (const s of report.sources) {
  console.log(`  ${s.live ? 'live   ' : 'fixture'}  ${s.label.padEnd(22)} ${s.observations} observations`);
}
if (report.startedReal) {
  const { droppedSnapshots, backedUpTo } = report.startedReal;
  console.log(`\n  --force: dropped ${droppedSnapshots} sample-only snapshot${droppedSnapshots === 1 ? '' : 's'}; data/ledger.json is now a real ledger.`);
  if (backedUpTo) console.log(`  previous ledger kept at data/${backedUpTo}`);
}
console.log(`\n  ${report.note}\n`);
