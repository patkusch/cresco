import 'dotenv/config';
import { writeFileSync, readFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKILLS, skillsMentionedIn } from '../server/taxonomy.ts';
import { getJSON, mapLimit } from '../server/collectors/http.ts';
import { computeSignals } from '../server/signal.ts';
import { mintClaims } from '../server/ledger.ts';
import type { Ledger, Observation, Snapshot } from '../server/types.ts';

/**
 * Builds a ledger of REAL history instead of synthetic trajectories.
 *
 * Most sources only answer "what is true now", which is why this project ships
 * with seeded data — you cannot ask Adzuna what it said in March. Hacker News is
 * the exception: the monthly "Ask HN: Who is hiring?" threads are a genuine,
 * dated, public hiring archive, and Algolia will serve story counts for any past
 * window. That is enough to reconstruct months of real signal on day one rather
 * than waiting a quarter to have anything to say.
 *
 * Sources without history (Adzuna, YouTube, Bluesky, Reddit) join later, through
 * ordinary collection runs. They stay out of the index until they have three
 * snapshots of their own — see MIN_SNAPSHOTS_FOR_INDEX in signal.ts.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MONTHS = Number(process.env.BACKFILL_MONTHS ?? 8);

interface AlgoliaStory { objectID: string; title: string; created_at: string; created_at_i: number }
interface HNItem { children?: HNItem[]; text?: string | null }

async function whoIsHiringThreads(): Promise<AlgoliaStory[]> {
  // search_by_date, NOT search: the default endpoint ranks by relevance, which
  // happily returns the most-discussed threads from 2018 and reads as real data.
  // hitsPerPage=500, not 60. The account posts three threads a month (hiring,
  // wants-to-be-hired, freelancer), so a 60-hit page silently caps the archive at
  // ~24 months — it does not error, it just quietly answers a smaller question.
  // At 500 the archive reaches back to 2011-09.
  const res = await getJSON<{ hits: AlgoliaStory[] }>(
    'https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=500',
    { timeoutMs: 30_000 },
  );
  return (res?.hits ?? [])
    .filter((h) => /who is hiring/i.test(h.title) && !/wants to be hired|freelancer/i.test(h.title))
    .sort((a, b) => b.created_at_i - a.created_at_i)
    .slice(0, MONTHS);
}

/** Count how many job posts in one monthly thread name each skill. */
async function countThread(story: AlgoliaStory): Promise<{ counts: Map<string, number>; posts: number }> {
  let thread: HNItem | null = null;
  for (let attempt = 0; attempt < 4 && !thread?.children?.length; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
    thread = await getJSON<HNItem>(`https://hn.algolia.com/api/v1/items/${story.objectID}`, { timeoutMs: 60_000 });
  }
  const counts = new Map<string, number>();
  let posts = 0;
  for (const comment of thread?.children ?? []) {
    if (!comment.text) continue;
    posts++;
    for (const id of new Set(skillsMentionedIn(comment.text))) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return { counts, posts };
}

/** Real HN story volume inside one month window. */
async function hnWindow(from: number, to: number): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  // Concurrency 2, not 5. Algolia throttles cumulatively across a long run, and
  // getJSON turns a 429 into null — so an over-eager backfill silently records
  // "no hiring data" for whatever it happens to reach last. Same failure mode as
  // the Wikimedia one; both are throttling wearing the costume of absent data.
  await mapLimit(SKILLS, 2, async (skill) => {
    // A throttled response is not zero stories. Counting it as zero is invisible
    // downstream: after share normalisation the month still sums to 1,000 and the
    // missing skill simply donates its share to every other one.
    let total = 0;
    let failed = false;
    for (const q of skill.queries.slice(0, 2)) {
      const data = await getJSON<{ nbHits: number }>(
        `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story` +
          `&numericFilters=created_at_i>${from},created_at_i<${to}&hitsPerPage=1`,
      );
      if (data === null) { failed = true; break; }
      total += data.nbHits ?? 0;
    }
    out.set(skill.id, failed ? null : total);
  });
  return out;
}

const threads = await whoIsHiringThreads();
if (!threads.length) {
  console.error('Could not reach the Hacker News archive. Nothing written — the existing ledger is untouched.');
  process.exit(1);
}
console.log(`found ${threads.length} monthly "Who is hiring?" threads: ${threads[0].created_at.slice(0, 7)} → ${threads.at(-1)!.created_at.slice(0, 7)}\n`);

const snapshots: Snapshot[] = [];

for (const story of threads) {
  const month = story.created_at.slice(0, 7);
  process.stdout.write(`  ${month}  reading thread… `);
  const { counts, posts } = await countThread(story);

  if (posts === 0) {
    console.log('unreachable — skipped (a month we could not read is a hole, not a month of zero hiring)');
    continue;
  }

  const to = story.created_at_i;
  const from = to - 30 * 86_400;
  process.stdout.write(`${posts} job posts · hn window… `);
  const hn = await hnWindow(from, to);
  // Same correction for practitioner volume: platform activity drifts, interest is a share.
  const hnValues = [...hn.values()].filter((v): v is number => v !== null);
  const hnFailures = [...hn.values()].filter((v) => v === null).length;
  const hnTotal = hnValues.reduce((a, b) => a + b, 0);

  const observations: Observation[] = [];
  for (const skill of SKILLS) {
    // Share, never volume. The monthly threads vary from 240 to 413 posts, so
    // raw mention counts mostly measure how busy the thread was — which made
    // every skill on the board "cool" in a quiet month.
    observations.push({
      skillId: skill.id,
      sourceId: 'whoshiring',
      sourceClass: 'hiring',
      metric: 'per 1,000 job posts',
      value: Math.round(((counts.get(skill.id) ?? 0) / posts) * 1000 * 10) / 10,
    });
    // Emit nothing rather than a zero when this skill's window failed, or when the
    // whole month's window did. The same rule the thread reader uses above.
    const raw = hn.get(skill.id);
    if (raw !== null && raw !== undefined && hnTotal > 0) {
      observations.push({
        skillId: skill.id,
        sourceId: 'hackernews',
        sourceClass: 'practitioner',
        metric: 'share of stories (30d)',
        value: Math.round((raw / hnTotal) * 1000 * 10) / 10,
      });
    }
  }

  await new Promise((r) => setTimeout(r, 600));

  snapshots.push({
    ts: story.created_at,
    sources: [
      { id: 'whoshiring', sourceClass: 'hiring', live: true },
      { id: 'hackernews', sourceClass: 'practitioner', live: true },
    ],
    observations,
  });
  console.log(hnFailures ? `done (${hnFailures} skills dropped — throttled)` : 'done');
}

snapshots.sort((a, b) => a.ts.localeCompare(b.ts));

const ledger: Ledger = { version: 1, seeded: false, snapshots, claims: [] };
ledger.claims = mintClaims(ledger, computeSignals(ledger, {}));

mkdirSync(join(ROOT, 'data'), { recursive: true });
const target = join(ROOT, 'data', 'ledger.json');
if (existsSync(target)) {
  const prior = JSON.parse(readFileSync(target, 'utf8')) as Ledger;
  // Only the synthetic ledger is worth keeping as a fallback; don't overwrite it
  // with the output of an earlier backfill.
  const backup = prior.seeded ? 'ledger.seeded.json' : 'ledger.previous.json';
  copyFileSync(target, join(ROOT, 'data', backup));
}
writeFileSync(target, JSON.stringify(ledger, null, 2));

console.log(`\nwrote ${snapshots.length} REAL monthly snapshots · ${ledger.claims.length} calls minted`);
console.log('previous ledger kept at data/ledger.seeded.json');
