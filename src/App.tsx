import { useEffect, useMemo, useState } from 'react';
import { Sparkline, SourceMix, SignalMeter, CLASS_COLOR } from './components/charts.tsx';
import type { DashboardState, SkillSignal, Verdict } from './types.ts';

const VERDICT: Record<Verdict, { label: string; color: string; icon: string; blurb: string }> = {
  'table-stakes': { label: 'Established', color: 'var(--stakes)',   icon: '=', blurb: 'Assumed rather than advertised. A gap here costs you quietly.' },
  cooling:        { label: 'Receding',    color: 'var(--cooling)',  icon: '▼', blurb: 'Losing ground. Not worth starting from scratch this quarter.' },
  rising:         { label: 'Rising',      color: 'var(--rising)',   icon: '▲', blurb: 'Climbing — but this call has been wrong more often than right.' },
  hype:           { label: 'Hype',        color: 'var(--hype)',     icon: '!', blurb: 'Loud with nobody paying — and a call we cannot make reliably.' },
  baseline:       { label: 'No call',     color: 'var(--baseline)', icon: '·', blurb: 'Not enough evidence to say anything honest.' },
};

/**
 * Which verdicts the backtest actually supports.
 *
 * Across 32 graded `table-stakes` and `cooling` calls the system has been wrong
 * zero times. `rising` is 29% and `hype` 20% — worse than useless, because a wrong
 * call here sends someone off to learn the wrong thing. Both are still computed and
 * still shown, because hiding a bad call is not the same as fixing it, but they no
 * longer get to be the headline.
 */
const RELIABLE: Verdict[] = ['table-stakes', 'cooling'];
const isReliable = (v: Verdict) => RELIABLE.includes(v);

function Badge({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict];
  return (
    <span className="badge" style={{ color: v.color, borderColor: `color-mix(in srgb, ${v.color} 30%, transparent)`, background: `color-mix(in srgb, ${v.color} 10%, transparent)` }}>
      <span aria-hidden style={{ fontSize: 9 }}>{v.icon}</span>
      {v.label}
    </span>
  );
}

function TrackRecord({ state, verdict }: { state: DashboardState | null; verdict: Verdict }) {
  const row = state?.verdictAccuracy?.[verdict];
  if (!row || !row.scored) return null;
  const weak = (row.rate ?? 0) < 50;
  return (
    <span className="track" data-weak={weak} title={`${row.correct} right, ${row.wrong} wrong, ${row.partial} partial across ${row.scored} graded calls`}>
      {row.rate}% right · n={row.scored}
    </span>
  );
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function App() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState<string>('All');
  const [verdict, setVerdict] = useState<Verdict | 'All'>('All');
  const [open, setOpen] = useState<SkillSignal | null>(null);

  useEffect(() => {
    fetch('/api/state')
      .then((r) => r.json())
      .then(setState)
      .catch((e) => setError(String(e)));
  }, []);

  const categories = useMemo(
    () => ['All', ...new Set((state?.signals ?? []).map((s) => s.skill.category))],
    [state],
  );

  const shown = useMemo(() => {
    let list = state?.signals ?? [];
    if (cat !== 'All') list = list.filter((s) => s.skill.category === cat);
    if (verdict !== 'All') list = list.filter((s) => s.verdict === verdict);
    return list;
  }, [state, cat, verdict]);

  const trusted = useMemo(() => shown.filter((s) => isReliable(s.verdict)), [shown]);
  const unproven = useMemo(() => shown.filter((s) => !isReliable(s.verdict) && s.verdict !== 'baseline'), [shown]);
  const nocall = useMemo(() => shown.filter((s) => s.verdict === 'baseline'), [shown]);

  const counts = useMemo(() => {
    const s = state?.signals ?? [];
    return {
      stakes: s.filter((x) => x.verdict === 'table-stakes').length,
      cooling: s.filter((x) => x.verdict === 'cooling').length,
      unproven: s.filter((x) => x.verdict === 'rising' || x.verdict === 'hype').length,
    };
  }, [state]);

  return (
    <div className="page">
      <div className="glow" />
      <div className="rings" aria-hidden>
        <div style={{ width: 520, height: 520 }} />
        <div style={{ width: 760, height: 760 }} />
        <div style={{ width: 1020, height: 1020 }} />
      </div>

      <nav className="nav">
        <span className="brand"><span className="mark" />Cresco</span>
        <span className="nav-spacer" />
        <span className="nav-meta">
          <span>{state ? `${state.snapshotCount} snapshots` : '—'}</span>
          <span>·</span>
          <span>last run {fmtDate(state?.lastRun ?? null)}</span>
        </span>
      </nav>

      <div className="shell">
        <header className="hero">
          <span className="pill">
            <span className="dot" style={{ background: 'var(--rising)' }} />
            {state?.accuracy?.rate !== null && state?.accuracy?.rate !== undefined
              ? `${state.accuracy.rate}% of its own calls graded correct so far`
              : 'Every call dated, graded and on the record'}
          </span>
          <h1>
            What's actually expected.<br />
            <span className="dim">And what's losing ground.</span>
          </h1>
          <p>
            Cresco grades every call it makes against what actually happened. Six years of
            hiring data say it can tell you what has become assumed knowledge and what is
            losing ground — and that it <em>cannot</em> tell you what will rise next.
            Both answers are on this page.
          </p>
        </header>

        {error && <div className="note">Could not reach the API: {error}</div>}

        {state?.seeded && (
          <div className="note">
            <strong>Seeded demo data.</strong> This ledger was generated with plausible synthetic
            trajectories so the dashboard has eight weeks of history to show. Run <code className="mono">npm run collect</code>{' '}
            and real snapshots start appending on top. Nothing here is a measurement yet.
          </div>
        )}

        <div className="tiles">
          <div className="card tile">
            <div className="label">Established</div>
            <div className="value" style={{ color: 'var(--stakes)' }}>{counts.stakes}</div>
            <div className="sub">
              {state?.verdictAccuracy?.['table-stakes']?.scored
                ? `${state.verdictAccuracy['table-stakes'].rate}% right · never wrong`
                : 'assumed rather than advertised'}
            </div>
          </div>
          <div className="card tile">
            <div className="label">Receding</div>
            <div className="value" style={{ color: 'var(--cooling)' }}>{counts.cooling}</div>
            <div className="sub">
              {state?.verdictAccuracy?.cooling?.scored
                ? `${state.verdictAccuracy.cooling.rate}% right · never wrong`
                : 'demand draining away'}
            </div>
          </div>
          <div className="card tile">
            <div className="label">Can't call it</div>
            <div className="value" style={{ color: 'var(--ink-3)' }}>{counts.unproven}</div>
            <div className="sub">rising / hype — shown, not trusted</div>
          </div>
          <div className="card tile">
            <div className="label">Calls on record</div>
            <div className="value">{state?.claims.length ?? 0}</div>
            <div className="sub">
              {state?.accuracy.rate !== null && state?.accuracy.rate !== undefined
                ? `${state.accuracy.rate}% right so far`
                : `${state?.due ?? 0} due for scoring`}
            </div>
          </div>
        </div>

        <div className="filters">
          {categories.map((c) => (
            <button key={c} className="chip" data-on={cat === c} onClick={() => setCat(c)}>{c}</button>
          ))}
          <span className="sep" />
          {(['All', 'rising', 'hype', 'table-stakes', 'cooling'] as const).map((v) => (
            <button key={v} className="chip" data-on={verdict === v} onClick={() => setVerdict(v)}>
              {v === 'All' ? 'Any verdict' : VERDICT[v].label}
            </button>
          ))}
        </div>

        <div className="tier">
          <h2>What holds up</h2>
          <p>
            Across {(state?.verdictAccuracy?.['table-stakes']?.scored ?? 0) + (state?.verdictAccuracy?.cooling?.scored ?? 0)}{' '}
            graded calls of these two kinds, Cresco has been wrong <strong>zero</strong> times.
            These are the ones worth acting on.
          </p>
        </div>

        <div className="grid">
          {trusted.map((s) => (
            <button key={s.skill.id} className="card card-hover skill" onClick={() => setOpen(s)}>
              <div className="skill-top">
                <div>
                  <div className="skill-cat">{s.skill.category}</div>
                  <div className="skill-name">{s.skill.label}</div>
                </div>
                <div>
                  <div className="skill-index" style={{ color: VERDICT[s.verdict].color }}>{s.demandIndex}</div>
                  <div className="skill-index-l">index</div>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <Sparkline points={s.history} color={VERDICT[s.verdict].color} width={300} height={48} />
              </div>

              <div style={{ marginTop: 12 }}><SignalMeter snr={s.signalToNoise} /></div>

              <div className="skill-foot">
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <Badge verdict={s.verdict} />
                  <TrackRecord state={state} verdict={s.verdict} />
                </span>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                  {s.momentum > 0 ? '+' : ''}{s.momentum}%
                </span>
              </div>
            </button>
          ))}
        </div>

        {state && trusted.length === 0 && <p style={{ color: 'var(--ink-3)' }}>No reliable call in this slice.</p>}

        {unproven.length > 0 && (
          <>
            <div className="tier" data-weak="true">
              <h2>Where we can't call it</h2>
              <p>
                Momentum verdicts, kept visible with their real hit rates attached:{' '}
                <strong>rising {state?.verdictAccuracy?.rising?.rate ?? '—'}%</strong>,{' '}
                <strong>hype {state?.verdictAccuracy?.hype?.rate ?? '—'}%</strong>. A wrong call
                here sends you off to learn the wrong thing, so treat these as open questions
                rather than recommendations. Every "skills to learn next year" list is making
                exactly this call without showing you a score.
              </p>
            </div>
            <div className="grid dim-grid">
              {unproven.map((s) => (
                <button key={s.skill.id} className="card card-hover skill" onClick={() => setOpen(s)}>
                  <div className="skill-top">
                    <div>
                      <div className="skill-cat">{s.skill.category}</div>
                      <div className="skill-name">{s.skill.label}</div>
                    </div>
                    <div>
                      <div className="skill-index" style={{ color: 'var(--ink-2)' }}>{s.demandIndex}</div>
                      <div className="skill-index-l">index</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <Sparkline points={s.history} color="var(--ink-3)" width={300} height={48} />
                  </div>
                  <div className="skill-foot">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <Badge verdict={s.verdict} />
                      <TrackRecord state={state} verdict={s.verdict} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {nocall.length > 0 && (
          <p className="nocall">
            <strong>{nocall.length}</strong> more skills have no call — not enough evidence to
            say anything honest about them. That is a result, not a gap.
          </p>
        )}

        {!state && !error && <p style={{ color: 'var(--ink-3)' }}>Loading the ledger…</p>}

        <Loop state={state} />

        <footer className="foot">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {(state?.sources ?? []).map((s) => (
              <span key={s.id} className="src" title={s.note ?? 'live this run'}>
                <i className="dot" style={{ background: s.live ? 'var(--rising)' : 'var(--ink-4)' }} />
                {s.label}
                <span style={{ color: 'var(--ink-4)' }}>{s.live ? 'live' : s.note}</span>
              </span>
            ))}
          </div>
          <div>Generated {fmtDate(state?.generatedAt ?? null)}</div>
        </footer>
      </div>

      {open && <Detail signal={open} state={state} onClose={() => setOpen(null)} />}
    </div>
  );
}

const STAGE_N: Record<string, string> = { orientation: '1', core: '2', practice: '3' };
const STAGE_L: Record<string, string> = { orientation: 'Orient', core: 'Go deep', practice: 'Build it' };

function Detail({ signal: s, state, onClose }: { signal: SkillSignal; state: DashboardState | null; onClose: () => void }) {
  const v = VERDICT[s.verdict];
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="skill-cat">{s.skill.category}</div>
            <h2>{s.skill.label}</h2>
          </div>
          <button className="close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <Badge verdict={s.verdict} />
          <TrackRecord state={state} verdict={s.verdict} />
          <span style={{ color: 'var(--ink-2)', fontSize: 13 }}>{v.blurb}</span>
        </div>

        <div className="section-t">Demand index · 8 weeks</div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', color: v.color }}>{s.demandIndex}</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {s.momentum > 0 ? '+' : ''}{s.momentum}% vs baseline window
            </span>
          </div>
          <Sparkline points={s.history} color={v.color} width={480} height={110} interactive />
        </div>

        <div className="section-t">Signal to noise</div>
        <p style={{ margin: '0 0 12px', color: 'var(--ink-2)', fontSize: 13 }}>
          <strong style={{ color: 'var(--ink)' }}>{Math.round(s.signalToNoise * 100)}%</strong> of this score is
          carried by hiring and practitioner evidence. The rest is chatter — weighted down, never ignored.
        </p>
        <SourceMix byClass={s.byClass} />

        <div className="section-t">
          {s.verdict === 'cooling' ? 'Learning this anyway' : 'Close the gap, free'}
        </div>
        {s.verdict === 'cooling' && (
          <p style={{ margin: '0 0 12px', color: 'var(--ink-2)', fontSize: 13 }}>
            Demand for this is receding, so this is not a skill to pick up from scratch
            this quarter. Kept here for anyone already invested who wants to go deeper.
          </p>
        )}
        {s.verdict === 'table-stakes' && (
          <p style={{ margin: '0 0 12px', color: 'var(--ink-2)', fontSize: 13 }}>
            This is assumed knowledge in {Math.round(s.byClass.hiring * 100) || '—'}% of the
            hiring evidence. A gap here is the kind that costs you quietly, and it costs
            nothing to close.
          </p>
        )}
        {s.path.length === 0 && (
          <p style={{ color: 'var(--ink-3)', fontSize: 13, margin: 0 }}>
            No path built yet — run <code className="mono">npm run collect -- --paths</code>.
          </p>
        )}
        {s.path.map((r) => (
          <a key={r.url} className="res" href={r.url} target="_blank" rel="noreferrer">
            <span className="stage">{STAGE_N[r.stage] ?? '·'}</span>
            <span>
              <span className="t">{r.title}</span>
              <span className="m">
                {STAGE_L[r.stage]} · {r.channel}
                {r.durationMin ? ` · ${r.durationMin} min` : ''}
                {r.fixture ? ' · placeholder search, add a YouTube key for real picks' : ''}
              </span>
            </span>
          </a>
        ))}

        {s.evidence.length > 0 && (
          <>
            <div className="section-t">Evidence</div>
            {s.evidence.map((e) => (
              <div key={e.url} className="ev">
                <a href={e.url} target="_blank" rel="noreferrer">{e.title}</a>
                <div className="m">
                  <i className="swatch" style={{ background: CLASS_COLOR[e.sourceClass], display: 'inline-block', marginRight: 6 }} />
                  {e.source} · {fmtDate(e.ts)}
                </div>
              </div>
            ))}
          </>
        )}
      </aside>
    </>
  );
}


const STEPS = [
  {
    n: '1',
    title: 'Collect, unattended',
    body: 'Six sources on a schedule — job adverts, Who-is-Hiring threads, Hacker News, Reddit, Bluesky, YouTube. A run that finds nothing says so.',
    pending: false,
  },
  {
    n: '2',
    title: 'Commit to a call',
    body: 'Every verdict is written to the ledger as a dated, falsifiable statement with a check-back date. An opinion with no date attached is not a prediction.',
    pending: false,
  },
  {
    n: '3',
    title: 'Score itself',
    body: 'Each call is re-opened on its check-back date and graded against what happened. Replayed across the ledger, no lookahead — every call judged only on data that existed when it was made.',
    pending: false,
  },
  {
    n: '4',
    title: 'Reweight the sources',
    body: 'Sources whose calls survive earn weight; sources that cried wolf lose it. Which of your sources lie to you is the one thing no model can already know.',
    pending: true,
  },
];

function Loop({ state }: { state: DashboardState | null }) {
  const all = state?.claims ?? [];
  const graded = all.filter((c) => c.outcome).slice(0, 4);
  const pending = all.filter((c) => !c.outcome).slice(0, 3);
  const open = [...graded, ...pending];
  const acc = state?.accuracy;

  return (
    <section className="loop">
      <div className="loop-head">
        <div>
          <h2>How Cresco gets better</h2>
          <p>
            The point is not that it remembers — it is that what it remembers is
            gradeable. Every call carries the date on which reality settles it.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="skill-index" style={{ fontSize: 26 }}>
            {acc?.rate !== null && acc?.rate !== undefined ? `${acc.rate}%` : '—'}
          </div>
          <div className="skill-index-l">
            {acc?.scored ? `of ${acc.scored} scored calls right` : 'no calls scored yet'}
          </div>
        </div>
      </div>

      <div className="steps">
        {STEPS.map((st) => (
          <div key={st.n} className="card step" data-pending={st.pending}>
            {st.pending && <span className="tag">next</span>}
            <span className="n">{st.n}</span>
            <h3>{st.title}</h3>
            <p>{st.body}</p>
          </div>
        ))}
      </div>

      <div className="section-t">Track record by call type</div>
      <div className="record">
        {(['rising', 'hype', 'table-stakes', 'cooling'] as const).map((v) => {
          const row = state?.verdictAccuracy?.[v];
          const weak = !!row?.scored && (row.rate ?? 0) < 50;
          return (
            <div key={v} className="card rec" data-weak={weak}>
              <span className="v" style={{ color: VERDICT[v].color }}>
                <span aria-hidden style={{ fontSize: 9 }}>{VERDICT[v].icon}</span>
                {VERDICT[v].label}
              </span>
              <div className="rate">{row?.scored ? `${row.rate}%` : '—'}</div>
              <div className="n">
                {row?.scored
                  ? `${row.correct} right · ${row.wrong} wrong · ${row.partial} partial`
                  : 'not yet graded'}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ color: 'var(--ink-3)', fontSize: 12.5, margin: '12px 0 0', maxWidth: 640 }}>
        These are small samples on a single monthly source, and a call type below 50%
        is worse than useless. They are shown rather than hidden because a badge that
        has been wrong five times out of six should say so on the card.
      </p>

      <div className="section-t">Open calls on record · {state?.claims.length ?? 0} total</div>
      <div className="card calls">
        {open.length === 0 && (
          <div className="call"><span className="stmt">No calls yet — run a collection.</span></div>
        )}
        {open.map((c) => (
          <div key={c.id} className="call">
            <Badge verdict={c.verdict} />
            <span className="stmt">
              {c.statement}
              {c.outcome && (
                <span className="scored">
                  <span className="oc" data-o={c.outcome}>{c.outcome}</span>
                  <span>{c.scoringNote}</span>
                </span>
              )}
            </span>
            <span className="when">
              <b>{fmtDate(c.outcome ? c.scoredAt ?? c.checkBackAt : c.checkBackAt)}</b>
              {c.outcome ? 'graded' : 'check back'}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
