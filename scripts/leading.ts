import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectLeading } from '../server/collectors/leading.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MONTHS = Number(process.env.LEADING_MONTHS ?? 36);

const data = await collectLeading(MONTHS);

mkdirSync(join(ROOT, 'data'), { recursive: true });
writeFileSync(join(ROOT, 'data', 'leading.json'), JSON.stringify(data, null, 2));

console.log(`resolved ${data.resolved.length} proxies across ${Object.keys(data.series).length} skills, ${MONTHS} months\n`);
for (const r of data.resolved) console.log(`  ✓ ${r.skillId.padEnd(18)} ${r.source.padEnd(10)} ${r.ref.padEnd(30)} ${r.points} months`);
if (data.missing.length) {
  console.log('\n  unresolved — no series returned, so these skills keep only their lagging signal:');
  for (const m of data.missing) console.log(`  ✗ ${m.skillId.padEnd(18)} ${m.source.padEnd(10)} ${m.ref}`);
}
console.log('\nwritten to data/leading.json');
