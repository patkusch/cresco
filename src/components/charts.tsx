import { useState } from 'react';
import type { SourceClass } from '../types.ts';

export const CLASS_COLOR: Record<SourceClass, string> = {
  hiring: 'var(--c-hiring)',
  practitioner: 'var(--c-practitioner)',
  community: 'var(--c-community)',
  content: 'var(--c-content)',
  vendor: 'var(--c-vendor)',
};

export const CLASS_LABEL: Record<SourceClass, string> = {
  hiring: 'Hiring',
  practitioner: 'Practitioner',
  community: 'Community',
  content: 'Content',
  vendor: 'Vendor',
};

interface SparkProps {
  points: { ts: string; demandIndex: number }[];
  color: string;
  width?: number;
  height?: number;
  interactive?: boolean;
}

/** 2px line, recessive baseline, one 8px end marker. No axis furniture at this size. */
export function Sparkline({ points, color, width = 260, height = 56, interactive = false }: SparkProps) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <div style={{ height, color: 'var(--ink-4)', fontSize: 11 }}>not enough history</div>;

  const vals = points.map((p) => p.demandIndex);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(1, max - min);
  const pad = 6;
  const x = (i: number) => pad + (i * (width - pad * 2)) / (points.length - 1);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.demandIndex).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(points.length - 1).toFixed(1)} ${height} L ${x(0).toFixed(1)} ${height} Z`;
  const gid = `g-${color.replace(/[^a-z]/gi, '')}-${width}`;
  const active = hover ?? points.length - 1;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`Demand index trend, ${vals[0]} to ${vals[vals.length - 1]}`}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {interactive && hover !== null && (
          <line x1={x(hover)} y1={0} x2={x(hover)} y2={height} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
        )}
        <circle cx={x(active)} cy={y(points[active].demandIndex)} r="4" fill={color} stroke="var(--bg)" strokeWidth="2" />
        {interactive &&
          points.map((_, i) => (
            <rect
              key={i}
              x={x(i) - (width / points.length) / 2}
              y={0}
              width={width / points.length}
              height={height}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
      </svg>
      {interactive && hover !== null && (
        <div
          style={{
            position: 'absolute', top: -8, left: Math.min(x(hover), width - 110), transform: 'translateY(-100%)',
            background: 'var(--panel-2)', border: '1px solid var(--hairline-strong)', borderRadius: 8,
            padding: '6px 9px', fontSize: 11.5, whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: 'var(--lit)',
          }}
        >
          <strong>{points[hover].demandIndex}</strong>{' '}
          <span style={{ color: 'var(--ink-3)' }}>
            · {new Date(points[hover].ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Where a skill's score actually comes from. 2px gaps between segments so
 * adjacent fills never touch, and every segment is direct-labelled in the
 * legend beneath — identity is never carried by colour alone.
 */
export function SourceMix({ byClass }: { byClass: Record<SourceClass, number> }) {
  const entries = (Object.keys(byClass) as SourceClass[]).filter((c) => byClass[c] > 0.001);
  const total = entries.reduce((a, c) => a + byClass[c], 0) || 1;

  return (
    <div>
      <div className="meter" style={{ height: 10 }}>
        {entries.map((c) => (
          <i key={c} style={{ width: `${(byClass[c] / total) * 100}%`, background: CLASS_COLOR[c] }} />
        ))}
      </div>
      <div className="legend">
        {entries.map((c) => (
          <span key={c}>
            <i className="swatch" style={{ background: CLASS_COLOR[c] }} />
            {CLASS_LABEL[c]}
            <b className="mono" style={{ color: 'var(--ink-3)', fontWeight: 500 }}>
              {Math.round((byClass[c] / total) * 100)}%
            </b>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Signal-to-noise as a two-part meter: substance versus chatter. */
export function SignalMeter({ snr }: { snr: number }) {
  return (
    <div className="meter" title={`${Math.round(snr * 100)}% of the weight is hiring or practitioner evidence`}>
      <i style={{ width: `${snr * 100}%`, background: 'var(--c-hiring)' }} />
      <i style={{ width: `${(1 - snr) * 100}%`, background: 'rgba(255,255,255,0.14)' }} />
    </div>
  );
}
