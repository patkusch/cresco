import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKILLS } from '../server/taxonomy.ts';
import type { Ledger, Observation, Snapshot } from '../server/types.ts';
import { computeSignals } from '../server/signal.ts';
import { mintClaims } from '../server/ledger.ts';

/**
 * Generates a SYNTHETIC eight-week history so the dashboard has something to
 * show before you have run it for eight weeks. Every snapshot it writes is
 * flagged `seeded: true` and the UI says so on the face of it — this is sample
 * data with plausible shapes, not a measurement, and Cresco never pretends
 * otherwise.
 *
 * Run `npm run collect` and real snapshots start appending on top.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEEKS = 8;

/** [starting level, weekly multiplier] per evidence family. */
interface Profile { hiring: [number, number]; chatter: [number, number]; content: [number, number]; }

const PROFILES: Record<string, Profile> = {
  // Real demand climbing, hiring leading the chatter
  'ai-agents':        { hiring: [980, 1.09],  chatter: [140, 1.05], content: [900, 1.06] },
  'llm-apps':         { hiring: [1500, 1.06], chatter: [120, 1.02], content: [1100, 1.03] },
  'evals':            { hiring: [310, 1.11],  chatter: [28, 1.03],  content: [120, 1.04] },
  'ai-safety':        { hiring: [420, 1.07],  chatter: [66, 1.04],  content: [210, 1.03] },
  'platform-eng':     { hiring: [860, 1.05],  chatter: [40, 1.01],  content: [180, 1.01] },
  'iceberg':          { hiring: [290, 1.08],  chatter: [34, 1.04],  content: [95, 1.05] },
  'supply-chain-sec': { hiring: [340, 1.06],  chatter: [30, 1.02],  content: [80, 1.02] },
  'ebpf':             { hiring: [150, 1.07],  chatter: [18, 1.01],  content: [45, 1.01] },
  'rust':             { hiring: [720, 1.04],  chatter: [95, 1.02],  content: [420, 1.02] },

  // Loud, and nobody is paying for it yet
  'mcp':              { hiring: [95, 1.03],   chatter: [180, 1.22], content: [640, 1.19] },
  'wasm':             { hiring: [130, 0.99],  chatter: [110, 1.14], content: [380, 1.12] },
  'post-quantum':     { hiring: [70, 1.02],   chatter: [88, 1.16],  content: [150, 1.13] },
  'duckdb':           { hiring: [110, 1.04],  chatter: [72, 1.13],  content: [220, 1.11] },

  // Assumed rather than advertised
  'python':           { hiring: [4200, 1.00], chatter: [150, 1.00], content: [1900, 1.00] },
  'typescript':       { hiring: [2600, 1.01], chatter: [110, 1.00], content: [1400, 1.00] },
  'kubernetes':       { hiring: [2100, 1.00], chatter: [85, 0.99],  content: [900, 0.99] },
  'go':               { hiring: [1300, 1.01], chatter: [70, 1.00],  content: [520, 1.00] },
  'dbt':              { hiring: [620, 1.00],  chatter: [26, 0.99],  content: [140, 0.99] },
  'streaming':        { hiring: [980, 1.00],  chatter: [44, 0.99],  content: [300, 0.99] },
  'zero-trust':       { hiring: [740, 1.01],  chatter: [32, 1.00],  content: [160, 1.00] },
  'terraform':        { hiring: [1400, 0.99], chatter: [48, 0.98],  content: [380, 0.98] },

  // Receding
  'rag':              { hiring: [880, 0.94],  chatter: [130, 0.90], content: [980, 0.92] },
  'finetuning':       { hiring: [420, 0.93],  chatter: [76, 0.91],  content: [540, 0.93] },
  'rsc':              { hiring: [260, 0.95],  chatter: [58, 0.92],  content: [340, 0.94] },
  'edge':             { hiring: [380, 0.96],  chatter: [52, 0.94],  content: [290, 0.95] },
};

/** Deterministic jitter, so the seeded ledger is reproducible run to run. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260826);
const jitter = (v: number, spread = 0.06) => Math.max(0, Math.round(v * (1 - spread + rand() * spread * 2)));

const WEEK_MS = 7 * 86_400_000;
const now = Date.now();
const snapshots: Snapshot[] = [];

for (let w = 0; w < WEEKS; w++) {
  const ts = new Date(now - (WEEKS - 1 - w) * WEEK_MS).toISOString();
  const observations: Observation[] = [];

  for (const skill of SKILLS) {
    const p = PROFILES[skill.id];
    if (!p) continue;
    const hiring = jitter(p.hiring[0] * Math.pow(p.hiring[1], w));
    const chatter = jitter(p.chatter[0] * Math.pow(p.chatter[1], w));
    const content = jitter(p.content[0] * Math.pow(p.content[1], w));

    observations.push(
      { skillId: skill.id, sourceId: 'adzuna',     sourceClass: 'hiring',       metric: 'open job adverts',            value: hiring,                        fixture: true },
      { skillId: skill.id, sourceId: 'whoshiring', sourceClass: 'hiring',       metric: 'job posts mentioning skill',  value: Math.round(hiring / 110),      fixture: true },
      { skillId: skill.id, sourceId: 'hackernews', sourceClass: 'practitioner', metric: 'stories (90d)',               value: Math.round(chatter * 0.55),    fixture: true },
      { skillId: skill.id, sourceId: 'reddit',     sourceClass: 'community',    metric: 'posts (month)',               value: Math.min(25, Math.round(chatter / 6)), fixture: true },
      { skillId: skill.id, sourceId: 'bluesky',    sourceClass: 'community',    metric: 'recent posts',                value: Math.min(25, Math.round(chatter / 9)), fixture: true },
      { skillId: skill.id, sourceId: 'youtube',    sourceClass: 'content',      metric: 'videos (6mo)',                value: content,                       fixture: true },
    );
  }

  snapshots.push({
    ts,
    sources: [
      { id: 'whoshiring', sourceClass: 'hiring',       live: false, note: 'seeded' },
      { id: 'adzuna',     sourceClass: 'hiring',       live: false, note: 'seeded' },
      { id: 'hackernews', sourceClass: 'practitioner', live: false, note: 'seeded' },
      { id: 'reddit',     sourceClass: 'community',    live: false, note: 'seeded' },
      { id: 'bluesky',    sourceClass: 'community',    live: false, note: 'seeded' },
      { id: 'youtube',    sourceClass: 'content',      live: false, note: 'seeded' },
    ],
    observations,
  });
}

const ledger: Ledger = { version: 1, seeded: true, snapshots, claims: [] };

// Mint the opening set of calls. Every one carries a check-back date, so the
// scoring loop has real history to grade the moment it lands.
ledger.claims = mintClaims(ledger, computeSignals(ledger, {}));

mkdirSync(join(ROOT, 'data'), { recursive: true });
writeFileSync(join(ROOT, 'data', 'ledger.json'), JSON.stringify(ledger, null, 2));

// Fixtures for the keyless path: the final seeded week becomes the fallback table,
// so a no-key `npm run collect` degrades to something plausible instead of zeros.
const last = snapshots[snapshots.length - 1];
const table = (sourceId: string) =>
  Object.fromEntries(last.observations.filter((o) => o.sourceId === sourceId).map((o) => [o.skillId, o.value]));
mkdirSync(join(ROOT, 'fixtures'), { recursive: true });
writeFileSync(join(ROOT, 'fixtures', 'adzuna.json'), JSON.stringify(table('adzuna'), null, 2));
writeFileSync(join(ROOT, 'fixtures', 'youtube.json'), JSON.stringify(table('youtube'), null, 2));

console.log(`seeded ${snapshots.length} weekly snapshots · ${last.observations.length} observations · ${ledger.claims.length} opening calls minted`);
