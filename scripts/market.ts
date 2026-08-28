import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchMarketIndex } from '../server/collectors/hiringlab.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = await fetchMarketIndex();
if (!data) { console.error('Could not fetch the Hiring Lab index — nothing written.'); process.exit(1); }

mkdirSync(join(ROOT, 'data'), { recursive: true });
writeFileSync(join(ROOT, 'data', 'market.json'), JSON.stringify(data, null, 2));

const months = Object.keys(data.monthly).sort();
const vals = months.map((m) => data.monthly[m]);
const peak = months[vals.indexOf(Math.max(...vals))];
console.log(`${months.length} months · ${months[0]} → ${months.at(-1)}`);
console.log(`peak ${data.monthly[peak]} (${peak}) · latest ${data.monthly[months.at(-1)!]} · ${data.baseline}`);
