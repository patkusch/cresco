# Pre-registered retest — GitHub topic-creation, rescaled growth

**Written 2026-09-16, before any new hiring month exists.** This file locks the
method for one specific re-test *before* the data that would decide it has been
collected. Nothing below may change once new data starts arriving — the point of
writing it down now is that a later change would be checkable against this
commit.

## A correction to how this got framed

The task that produced this file described the open thread as belonging to
**conference programmes**. That is not what the project's own records say. The
post-hoc rescale check — "keep months the growth step would otherwise drop, see
if the correlation and null-beat-rate improve on the same data already used to
reject it" — was run against **GitHub topic-creation**, not conference
programmes. See `README.md`, the paragraph beginning "One more check was run
after seeing that result" directly under the GitHub row, and
`docs/RESEARCH.md`'s "Tested since" table, GitHub row: *"A check run after
seeing that result: rescaling so months under 1 per 10,000 are not skipped gives
lag 3, +0.081, and 1.0% of nulls beating it. […] Re-test on fresh data with the
rescaled test named beforehand."*

Conference programmes was rejected on its own pre-specified floor (+0.091 fell
short of +0.1) and was never subject to this particular trap — its own collector
deliberately stores share **per 1,000** conferences rather than per 10,000
specifically so quiet months would not fall under the growth step's floor (see
the comment above `shareOf()` in `server/collectors/conference-programmes.ts`).
There is no "conference-programmes rescale thread" recorded anywhere in this
repo to pre-register. Building this infrastructure for conference programmes
would have meant inventing a finding that the project never made — the opposite
of what a pre-registration is for. This document therefore pre-registers the
retest for the candidate the project's own write-up actually names: **GitHub
topic-creation**.

## The candidate

**GitHub topic-creation**, exactly as already collected and rejected:

- Collector: `server/collectors/github-topics.ts`, run via `npm run
  github-topics`.
- Data source: GitHub's search API, `topic:<tag>` × creation month, one hand-checked
  topic per skill (`GITHUB_TOPICS` in that file), 64 skills.
- Series stored: `data/github-topics.json`, share per 10,000 repositories created
  that month — `shareOf()`, `Math.round((v / total) * 10_000 * 100) / 100`.
- No change to the collector or the data format. The rescaling below changes
  only how the already-collected series is turned into a growth number for the
  correlation test.

## The rescaled-growth method, exact formula

The project's existing growth step (`growth()` in `server/leadlag.ts`) is:

```
growth(series, m):
  now    = series[m]
  before = series[m − 3 months]
  if now or before is undefined, or before < 1:
    return null   # "too small a base to divide by safely"
  return (now − before) / before
```

That `before < 1` guard is what silently drops most months for a series stored
per 10,000 — the exact effect described in `docs/RESEARCH.md`'s "growth step
hides quiet series" note. The rescaled version pre-registered here changes only
that one condition, keeping everything else — the 3-month window, the
month-lookup — identical:

```
rescaledGrowth(series, m):
  now    = series[m]
  before = series[m − 3 months]
  if now or before is undefined, or before <= 0:
    return null   # only a true zero is unsafe to divide by
  return (now − before) / before
```

This is a direct implementation of "keep months where the starting share is
below 1 per 10,000 rather than dropping them" — it drops a month only when
dividing by zero would be undefined, not because the share was merely small.
Implemented in `server/rescaled-retest.ts` as `rescaledGrowth()`.

## The pre-specified lag: 3 months

The lag is **not** re-chosen when new data arrives — doing that would be fitting
on the test set. It is fixed now, to the value the project already published
from the post-hoc check on old data (`npm run holdout -- --only=github
--scale=100`, 2026-09-15): **lag = 3 months**. Reusing an already-published
number computed on already-seen data is not a new researcher degree of freedom;
re-deriving a "better" lag from the new month(s) would be.

## The test

For each skill with both a GitHub topic-creation series and a hiring series,
and for each month `m` in the **new** hiring data only (see trigger condition
below):

1. `g_hiring = rescaledGrowth(hiring[skill], m)`
2. `g_github = rescaledGrowth(github[skill], m − 3 months)` — note the lead
   month itself can fall inside the already-collected Sep 2019 – Aug 2026
   window; only the **hiring** value being predicted has to be new.
3. Keep the pair `(g_github, g_hiring)` when both are non-null.

Compute:

- **Real r** — Pearson correlation (`pearson()` from `server/leadlag.ts`,
  minimum 8 pairs) across all kept pairs.
- **Null distribution** — 2,000 shuffles (`NULL_SHUFFLES`), fixed seed
  `20260916` (`NULL_SEED`, chosen today, not tuned), each pairing a skill's
  GitHub growth with a **different**, randomly chosen skill's hiring growth,
  same month set, same lag. Recompute r each time.
- **Beat share** — the fraction of null r's that are `>=` the real r.

Verdict, using this project's own standing thresholds (`scripts/holdout.ts`,
and the "anything above 5% means luck explains it" rule stated in
`README.md`):

| Condition | Verdict |
|---|---|
| beat < 5% and real r > 0.15 | **SURVIVES** — holds out of sample and beats the null |
| beat < 20% and real r > 0.10 | **WEAK** — directionally there, not established |
| otherwise | **DOES NOT SURVIVE** |

No other threshold is legitimate for this retest. Choosing a friendlier one
after seeing the new-data result would be the same move this file exists to
prevent.

## The trigger condition — when this is allowed to run

`npm run rescaled-retest` refuses to run the test above unless **both**:

1. `data/ledger.json` is a real backfill (`ledger.seeded === false`), and
2. it contains at least one snapshot whose month is **after 2026-08** — i.e.
   a real calendar month collected by the normal `npm run backfill` process,
   not a re-slice or re-analysis of the Sep 2019 – Aug 2026 window already used
   to reject GitHub topic-creation on 2026-09-15.

If either condition fails, the script prints why and exits non-zero. It does
**not** fall back to running the test on the old window — there is nothing to
report until real new data exists, and reporting a number computed on old data
under a new name would be the same p-hack one step removed. See
`server/rescaled-retest.ts::checkEligibility()`, unit-tested in
`test/rescaled-retest.test.ts` against fabricated ledgers so the gate itself is
provably correct without needing real new data to exist.

Even once the gate opens, if the overlap between new hiring months and
available GitHub series is too small to reach the 8-pair minimum `pearson()`
requires, the script says so and stops — that is a "not enough data yet" state,
not a result, and it is reported as such rather than silently skipped.

## What would violate this pre-registration

- Changing the lag, the rescale rule, the null-shuffle seed, the pairing
  procedure, or the verdict thresholds after new data exists.
- Running the test against the existing Sep 2019 – Aug 2026 window and
  reporting the result as if it answered this retest.
- Including only some of the new months, chosen after looking at which ones
  give a better number.
- Treating a "WEAK" or "DOES NOT SURVIVE" verdict differently from a
  "SURVIVES" one when deciding whether to write the result up.

## Content hash

The block below is a SHA-256 hash of everything in this file above this
heading, computed 2026-09-16, before this repository has seen a single month of
hiring data past August 2026. It exists so a later reader — human or agent —
can confirm this method was not edited after new data arrived, independent of
trusting git history alone.

```
SHA-256 (this file, content above "## Content hash"): b64092a016b6e55ebb550fa7aa12b34e63450fc536028ca84b1c252106f2bdfe
```

The commit that adds this file is authored on 2026-09-16 and its hash is
recorded in this project's `git log`, which is a second, independent check on
the date: `git log --format='%H %ad' --date=short -- docs/PREREGISTERED.md`.
