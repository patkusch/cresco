import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLedger } from '../server/ledger.ts';
import { loadIndicators } from '../server/sources.ts';
import { MAX_LAG, hiringByMonth, pairsAtLag, pearson } from '../server/leadlag.ts';

/**
 * Renders the lead-lag curve to docs/leadlag.svg, computed from whatever is
 * currently in the ledger.
 *
 * Generated rather than hand-drawn on purpose: a chart in a README that was
 * typed out once will keep asserting last month's number long after the data
 * has moved, and this project's entire pitch is that it does not do that.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const leading = loadIndicators();
const ledger = loadLedger();
const hiring = hiringByMonth(ledger);
const months = [...new Set(ledger.snapshots.map((s) => s.ts.slice(0, 7)))].sort();

const SOURCES = [
  { id: 'edgar', label: 'SEC filings', colour: '#c98500', verdict: 'weak, lag too short' },
  { id: 'wikipedia', label: 'Wikipedia pageviews', colour: '#7c8391', verdict: 'rejected' },
  { id: 'npm', label: 'npm downloads', colour: '#5b6270', verdict: 'rejected' },
];

const data = SOURCES.map((s) => ({
  ...s,
  points: Array.from({ length: MAX_LAG + 1 }, (_, lag) => {
    const skills = Object.keys(leading.series).filter((k) => leading.series[k][s.id] && hiring[k]);
    return { lag, r: pearson(pairsAtLag(leading, hiring, months, s.id, lag, { skills })) };
  }),
}));

const W = 900, H = 476, L = 74, R = 34, T = 76, B = 98;
const plotW = W - L - R, plotH = H - T - B;
const YMAX = 0.55;
const x = (lag: number) => L + (lag / MAX_LAG) * plotW;
const y = (r: number) => T + ((YMAX - r) / (YMAX * 2)) * plotH;

const line = (pts: { lag: number; r: number | null }[]) => {
  const valid = pts.filter((p) => p.r !== null) as { lag: number; r: number }[];
  return valid.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.lag).toFixed(1)} ${y(p.r).toFixed(1)}`).join(' ');
};

const wiki = data.find((d) => d.id === 'edgar') ?? data[0];
const peak = wiki.points.filter((p) => p.r !== null).reduce((a, b) => ((b.r as number) > (a.r as number) ? b : a));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Correlation between adoption growth and hiring growth at each lag; Wikipedia peaks around ${peak.lag} months">
  <defs>
    <linearGradient id="wfade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#c98500" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#c98500" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#07080a"/>

  <text x="${L}" y="38" font-family="Inter, Helvetica, Arial, sans-serif" font-size="19" font-weight="700" fill="#fff" letter-spacing="-0.3">Does anything lead hiring? Four tests, four failures.</text>
  <text x="${L}" y="58" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12.5" fill="#ffffff" fill-opacity="0.5">Correlation of 3-month growth rates at each lag · ${months.length} months of hiring data</text>

  <!-- the band where the shuffled null lives -->
  <rect x="${L}" y="${y(0.1)}" width="${plotW}" height="${y(-0.1) - y(0.1)}" fill="#ffffff" fill-opacity="0.035"/>
  <text x="${W - R - 8}" y="${y(0.1) - 7}" text-anchor="end" font-family="Inter, Helvetica, Arial, sans-serif" font-size="10" fill="#ffffff" fill-opacity="0.34">noise band — where shuffled labels land</text>
  <line x1="${L}" y1="${y(0)}" x2="${W - R}" y2="${y(0)}" stroke="#ffffff" stroke-opacity="0.16" stroke-width="1"/>

  ${[-0.4, -0.2, 0.2, 0.4].map((v) => `<line x1="${L}" y1="${y(v)}" x2="${W - R}" y2="${y(v)}" stroke="#ffffff" stroke-opacity="0.05"/><text x="${L - 12}" y="${y(v) + 4}" text-anchor="end" font-family="ui-monospace, Menlo, monospace" font-size="10.5" fill="#ffffff" fill-opacity="0.35">${v > 0 ? '+' : ''}${v.toFixed(1)}</text>`).join('\n  ')}
  <text x="${L - 12}" y="${y(0) + 4}" text-anchor="end" font-family="ui-monospace, Menlo, monospace" font-size="10.5" fill="#ffffff" fill-opacity="0.35">0</text>

  ${Array.from({ length: MAX_LAG + 1 }, (_, l) => `<text x="${x(l)}" y="${H - B + 24}" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="10.5" fill="#ffffff" fill-opacity="0.35">${l}</text>`).join('\n  ')}
  <text x="${L + plotW / 2}" y="${H - B + 46}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="11.5" fill="#ffffff" fill-opacity="0.45">months between adoption and hiring</text>

  <path d="${line(wiki.points)} L ${x(MAX_LAG)} ${y(0)} L ${x(0)} ${y(0)} Z" fill="url(#wfade)"/>
  ${data.map((d) => `<path d="${line(d.points)}" fill="none" stroke="${d.colour}" stroke-width="${d.id === 'edgar' ? 2.6 : 1.6}" stroke-linecap="round" stroke-linejoin="round" ${d.id === 'edgar' ? '' : 'stroke-dasharray="5 4"'}/>`).join('\n  ')}

  <circle cx="${x(peak.lag)}" cy="${y(peak.r as number)}" r="5.5" fill="#c98500" stroke="#07080a" stroke-width="2.5"/>
  <text x="${x(peak.lag)}" y="${y(peak.r as number) - 16}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="#c98500">peak at ${peak.lag} months</text>

  <g transform="translate(${L}, ${H - 22})">
    ${data.map((d, i) => `<g transform="translate(${i * 255}, 0)"><rect width="20" height="2.6" y="5" rx="1.3" fill="${d.colour}"/><text x="30" y="10" font-family="Inter, Helvetica, Arial, sans-serif" font-size="11.5" fill="#ffffff" fill-opacity="0.7">${d.label} — ${d.verdict}</text></g>`).join('\n    ')}
  </g>
</svg>`;

mkdirSync(join(ROOT, 'docs'), { recursive: true });
writeFileSync(join(ROOT, 'docs', 'leadlag.svg'), svg);
console.log(`docs/leadlag.svg written · wikipedia peaks at ${peak.lag}mo (${(peak.r as number).toFixed(3)}) over ${months.length} months`);
