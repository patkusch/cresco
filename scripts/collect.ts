import 'dotenv/config';
import { runCollection } from '../server/pipeline.ts';

/**
 * One unattended run. Wire to cron/launchd and it accumulates while you are away:
 *   0 7 * * 1  cd /path/to/cresco && npm run collect
 */
const report = await runCollection({ refreshPaths: process.argv.includes('--paths') });

console.log(`\ncresco run ${report.ts}`);
for (const s of report.sources) {
  console.log(`  ${s.live ? 'live   ' : 'fixture'}  ${s.label.padEnd(22)} ${s.observations} observations`);
}
console.log(`\n  ${report.note}\n`);
