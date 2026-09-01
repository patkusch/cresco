/**
 * Emit the dashboard as a static site.
 *
 * The frontend makes exactly one request — `GET api/state.json` — and the payload
 * behind it is a pure function of data already committed to this repository. So
 * there is nothing for a server to do at request time, and the whole dashboard
 * can be a folder of files.
 *
 * `npm run collect` still needs a real machine and API keys. What ships here is
 * the *result* of the last collection, which is the only thing a reader needs.
 *
 * Run after `vite build`. Expects the client bundle in `dist/client`.
 */

import { mkdirSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildState } from '../server/pipeline.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist/client');

if (!existsSync(join(OUT, 'index.html'))) {
  throw new Error(`No client bundle at ${OUT}. Run \`vite build\` first.`);
}

const state = buildState();

// A seeded ledger is sample data. Publishing it as the live dashboard would put
// invented numbers behind a public URL with nothing marking them as invented.
if (state.seeded) {
  throw new Error('Refusing to publish a seeded ledger — the committed data is fixtures, not measurements.');
}
if (!state.signals.length) {
  throw new Error('Refusing to publish an empty dashboard — buildState() produced no signals.');
}

mkdirSync(join(OUT, 'api'), { recursive: true });
writeFileSync(join(OUT, 'api/state.json'), JSON.stringify(state));

// GitHub Pages has no SPA fallback: a deep link 404s unless a 404.html exists.
// Serving the same document means client-side routing still resolves.
copyFileSync(join(OUT, 'index.html'), join(OUT, '404.html'));

// Tells Pages not to run the output through Jekyll, which would drop any path
// beginning with an underscore.
writeFileSync(join(OUT, '.nojekyll'), '');

const kb = (n: number) => `${Math.round(n / 1024)} kB`;
console.log(
  `static build ready · ${state.signals.length} skills · ${state.snapshotCount} snapshots · ` +
    `${state.claims.length} claims · state.json ${kb(JSON.stringify(state).length)}`,
);
