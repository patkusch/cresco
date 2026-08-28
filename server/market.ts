import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Ledger, Snapshot } from './types.ts';
import type { MarketData } from './collectors/hiringlab.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MARKET_PATH = join(ROOT, 'data', 'market.json');

export function loadMarket(): MarketData | null {
  if (!existsSync(MARKET_PATH)) return null;
  try {
    return JSON.parse(readFileSync(MARKET_PATH, 'utf8')) as MarketData;
  } catch {
    return null;
  }
}

/**
 * Convert share-of-postings into an estimate of absolute demand.
 *
 * Counting share per 1,000 job posts fixed thread-size noise but introduced a
 * blind spot: it cannot see the market itself moving. Indeed's Software
 * Development index went 229 at the 2022 peak to 74 now, so a skill that held
 * its share through that lost two thirds of its actual demand while the ledger
 * recorded it as flat.
 *
 * Multiplying the hiring share by the market level restores that. Whether it
 * makes the *verdicts* better is a separate question and not assumed — run
 * `npm run compare` to see both scored against the same grader.
 */
export function marketAdjust(ledger: Ledger, market: MarketData | null = loadMarket()): Ledger {
  if (!market) return ledger;

  const snapshots: Snapshot[] = ledger.snapshots.map((snap) => {
    const month = snap.ts.slice(0, 7);
    const level = market.monthly[month];
    // No market reading for that month: leave the snapshot alone rather than
    // inventing a factor. A missing denominator is not a denominator of 1.
    if (level === undefined) return snap;
    const factor = level / 100;
    return {
      ...snap,
      observations: snap.observations.map((o) =>
        o.sourceClass === 'hiring'
          ? { ...o, value: Math.round(o.value * factor * 10) / 10, metric: `${o.metric} × market` }
          : o,
      ),
    };
  });

  return { ...ledger, snapshots };
}

/** How many of the ledger's months the market series actually covers. */
export function marketCoverage(ledger: Ledger, market: MarketData | null = loadMarket()) {
  if (!market) return { covered: 0, total: ledger.snapshots.length };
  const months = ledger.snapshots.map((s) => s.ts.slice(0, 7));
  return { covered: months.filter((m) => market.monthly[m] !== undefined).length, total: months.length };
}
