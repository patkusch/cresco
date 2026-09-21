<div align="center">

<img src="docs/banner.svg" alt="Cresco — what to learn next, and where to learn it free" width="100%">

<br>

**A skill-demand radar that grades its own predictions — and publishes the score,
including the calls it cannot make.**

<br>

[![CI](https://github.com/patkusch/cresco/actions/workflows/ci.yml/badge.svg)](https://github.com/patkusch/cresco/actions/workflows/ci.yml)
![Tests](https://img.shields.io/badge/tests-195-199e70?style=flat-square&labelColor=07080a)
![MIT](https://img.shields.io/badge/licence-MIT-1c1d20?style=flat-square&labelColor=07080a)
![TypeScript](https://img.shields.io/badge/TypeScript-3987e5?style=flat-square&labelColor=07080a)
![React 19](https://img.shields.io/badge/React_19-199e70?style=flat-square&labelColor=07080a)
![No keys required](https://img.shields.io/badge/API_keys-optional-c98500?style=flat-square&labelColor=07080a)
![72 months real data](https://img.shields.io/badge/72_months-real_data-d55181?style=flat-square&labelColor=07080a)

</div>

<br>

Every *"skills to learn in 2026"* list is written by someone with an incentive, from
sources that all cite each other. None of them ever tell you whether last year's list
was right.

Cresco watches hiring demand across six sources, weights them so noise cannot
masquerade as demand, writes every verdict down as a **dated, falsifiable claim**, and
then **grades itself** against what actually happened. Its hit rate is on the
dashboard. So is every call it got wrong.

### ▶ [**See the live dashboard**](https://patkusch.github.io/cresco/) &nbsp;·&nbsp; no install

Real data, rebuilt from the committed ledger on every push. Or run it yourself:

```bash
npm install && npm run dev
```

<br>

---

## The receipts

<div align="center">
<img src="docs/leadlag.svg" alt="Correlation between adoption growth and hiring growth at each lag" width="100%">
</div>

Job postings are where demand *arrives*, not where it starts — so predicting hiring from
hiring means fighting sampling noise for something that already happened. We spent real
effort testing whether anything upstream **leads** it.

**It doesn't. Or at least, nothing we tested does.**

### A finding that died as the data grew

Wikipedia pageviews looked like a six-month leading indicator. On 16 months of hiring
history the hold-out correlation was **+0.440**, with only 2.3% of shuffled nulls beating
it — a publishable-looking number that went into this README.

Then we fixed a bug that had been silently truncating the hiring archive, and kept
extending it:

| Hiring history | Hold-out r | Nulls beating it | Reading |
|---|---|---|---|
| 16 months | +0.440 | 2.3% | survives |
| 19 months | +0.394 | 1.0% | survives |
| 22 months | +0.210 | 7.5% | weak |
| **72 months** | **+0.043** | **18.3%** | **dead** |
| 72 months, rebuilt ledger | +0.002 | 38.3% | dead |

A clean monotonic decay as the sample grew. That is the signature of a finding that was
never real — an artefact of one small, recent window. The six-month lag stayed put the
whole way, which is what made it convincing; the correlation underneath it evaporated.

### Everything else we tested

| Candidate | Hold-out r | Nulls beating it | Verdict |
|---|---|---|---|
| **Conference programmes** — talks per topic at major conferences | +0.091 | **8.8%** | rejected, but the closest miss of anything tested |
| **GitHub** repos created per topic | +0.076 | 13.8% | rejected: moves with hiring, not ahead of it |
| **SEC EDGAR** filings naming a technology | +0.066 | 32.8% | rejected, and the lag is 1–2 months |
| **Wikipedia** pageviews | +0.002 | 38.3% | rejected |
| **npm** downloads | +0.003 | 31.0% | rejected |
| **Market adjustment** (Indeed index) | — | — | rejected: −17pp on the backtest |

Hold-out r is the correlation on skills the test never used to choose its lag.
Zero means no link, and 1 means a perfect one.
"Nulls beating it" is the share of shuffled series, each skill paired with a different skill's hiring, that score as well.
Anything above 5% means luck explains it.

These numbers were re-run on 2026-09-15.
EDGAR, Wikipedia and npm first scored +0.117, +0.043 and +0.012.
The hiring history was rebuilt after that, when throttled months were dropped and the skill matcher was fixed.
On the rebuilt history all three score lower, and none of them changes verdict.

**Conference programmes came closest, and it still failed.**
A conference programme is fixed months before the event, so a talk about a skill is one
organiser betting early that people want to hear about it.
We counted conferences, not individual talks — a three-day event with eighty sessions
counts once — for 17 of the 64 skills, using a public, topic-tagged conference list
maintained on GitHub (confs.tech's dataset), covering the same 84 months as everything
else here.
Only **8.8%** of shuffled tests scored as well as the real one, the lowest share of any
candidate — most of the shuffled runs land nowhere near it.
But the real number was **+0.091**, just under the **+0.1** floor we set before running
the test, so by our own rule it still stays rejected.
No exception was made for coming close.

**GitHub was the next-closest candidate with a clear mechanism behind it.**
Creating a repository is a deliberate act, unlike a download.
We collected 84 months of new repositories for all 64 skills, as a share of every repository created that month.

It comes closer than anything else to looking real, and it still fails.
95% of hold-out splits come out positive, so the link is consistent.
But 13.8% of shuffled series match it, where anything above 5% means luck explains it.
And the best lag is 0 months.
GitHub activity rises in the same month as hiring, so it tells you nothing that hiring does not already tell you.

One more check was run after seeing that result, so treat it with care.
The growth step skips any month where a skill's share is below 1 per 10,000 repositories, and many quiet topics sit below that.
Keeping those months (`npm run holdout -- --only=github --scale=100`) moves the best lag to 3 months, and only 1% of shuffled series beat it.
The correlation stays at +0.081, though.
That means GitHub explains less than 1% of the ups and downs in hiring, far too little to base advice on.
It was also not a test we named in advance, so GitHub stays rejected.
It is the one thread worth re-testing on fresh data, with the rescaled test named before the data comes in.

SEC EDGAR was the most promising on mechanism: companies describe commitments to investors before they staff them.
When first tested it was the best of the early three, with 91% of hold-out splits positive.
It still did not clear the bar, and its peak lag came out at **1–2 months**.
Even a solid two-month warning is useless for a tool whose purpose is telling you what to start learning.

One pre-specified follow-up was attempted — a minimum-volume floor, on the same logic as
the evidence floor already used for verdicts, since several EDGAR series run at 0–2
filings a month. Only one skill cleared it, so there was no split left to test. We
stopped there rather than hunting for a threshold that happened to work.

**Six hypotheses tested, six refuted.** That table is the project working as intended.

## How it grades itself

| Step | Status |
|---|---|
| 1. Collect, unattended — six sources on a schedule | **built** |
| 2. Commit to a call — dated, falsifiable, with a check-back date | **built** |
| 3. Score itself by replaying history with no lookahead | **built** |
| 4. Reweight sources by which ones survived scoring | next |

`npm run backtest` replays the ledger month by month: grade whatever has come due, then
mint new calls from **only** the data that existed at that point. Signals at step *m*
are computed from `snapshots.slice(0, m+1)`, so the reference scale, the momentum
window and source eligibility all see exactly what they would have seen at the time.

**Current score — 93 graded calls over 72 months, 64 skills:**

| Call type | Hit rate | Right / wrong / partial |
|---|---|---|
| **Established** | **57%** | 8 / **0** / 6 |
| Hype | 67% | 2 / 1 / 0 |
| Receding | 53% | 10 / 4 / 5 |
| Rising | 21% | 12 / 40 / 5 |
| **Overall** | **34%** | 32 / 45 / 16 |

### One verdict survived a wider test, and one didn't

An earlier version of this README said the system had been **wrong zero times across
32 `table-stakes` and `cooling` calls**. That was true, and it was measured on a
curated set of 25 mostly high-volume skills. Expanding to 64 — adding cloud, mobile,
mainstream languages and lower-volume specialisms — broke half of it.

| | on 25 skills | on 64 skills |
|---|---|---|
| **Established** | 71%, 0 wrong | **57%, 0 wrong** |
| Receding | 64%, 0 wrong | **33%, 20 wrong** |

**Established held.** It is the only call in this system that is stable across every
evidence threshold tested — its calls live in high-volume skills, so the floor does not
move it. *This is assumed knowledge now* is a claim the data supports.

**Receding did not.** Its perfect record was an artefact of the narrow skill set. It has
been demoted out of the trusted tier on its own evidence, and now sits alongside `rising`
and `hype` with its real number attached.

The evidence floor was also raised from 3 to 6 as part of this. The original was never
genuinely tested: every skill in the old taxonomy was high-volume, so the effective
evidence density was far above the nominal floor. Adding 39 lower-volume skills exposed
it.

### What this product can and cannot do

**It can tell you what has become assumed knowledge.** 57%, never wrong, robust to every
threshold we tried. Those are the calls worth acting on.

**It cannot tell you what will rise next.** `rising` is 21% — 40 wrong calls against 12
right. Every "skills to learn in 2026" list is making exactly this call, and six years of
data say it cannot be made reliably from this evidence.

Every verdict badge in the UI carries its own measured hit rate, so the unreliable calls
announce themselves on the card.

<details>
<summary><b>Why <code>rising</code> fails, and what we tried</b></summary>

<br>

The median month-to-month swing in a skill's index is **19%** — sampling jitter from
which companies happened to post that month. The original threshold was **12%**, i.e.
*below* the noise floor, so it was classifying noise as trend.

Worse, momentum on this source is mildly **anti**-predictive: correlation −0.15 with
what happens next, with rising calls followed by an average 5% fall and cooling calls
by a 16% rise. Textbook mean reversion.

Smoothing over three months and raising thresholds to twice the smoothed noise floor
lifted the overall rate from 32% to 45% on the smaller ledger. On the full 22 months it
sits at 39% with `rising` at 32%. Tuning stopped there rather than continuing until the
numbers flattered the project.

</details>

<br>

## The one idea underneath it

> A skill named in a paid job advert is someone committing **money**.
> A skill trending on social is someone committing **a sentence**.

The **signal-to-noise** figure on every card is the share of a skill's score carried by
people actually paying for it. Sort by it and hype separates from demand.

<br>

## Quickstart

```bash
npm install
npm run dev           # → http://localhost:3000
```

The repo already ships with the real history: 72 months of Hacker News hiring data
(Sep 2020 → Aug 2026) in `data/ledger.json`. Nothing else is needed to see it.

`backfill` is what built that ledger. Most sources only answer *"what is true now"* — you
cannot ask a job board what it said in March. Hacker News is the exception: the monthly
**"Ask HN: Who is hiring?"** threads are a genuine, dated, public hiring archive, so
Cresco can rebuild years of real signal from scratch instead of making you wait. No key
needed.

```bash
BACKFILL_MONTHS=73 npm run backfill   # rebuild from Hacker News: 73 months, the 72 you have plus a new one
npm run backfill -- --force           # replace the ledger even if the new one is shorter
```

Read this before running it. **`npm run backfill` on its own fetches only 8 months** and
replaces the ledger with them. So it refuses, and says how many months it would throw away,
whenever the new run is shorter than the ledger you already have. To extend history, ask
for at least as many months as you already hold (`BACKFILL_MONTHS=73` above); it goes
slowly on purpose, to stay under Hacker News's rate limit. To shorten it anyway, pass
`--force`. Either way the ledger being replaced is first copied to
`data/ledger.previous-<timestamp>.json`, and a backup is never overwritten. A backfill also
rebuilds the list of calls from scratch, so run `npm run backtest` afterwards to grade them.

```bash
npm run backtest      # replay history and grade the calls it would have made (re-writes data/ledger.json, and says whether it changed)
npm run leading       # fetch leading indicators (npm + Wikipedia, 84 months, no key)
npm run leadlag       # measure whether adoption leads hiring, and by how long
npm run holdout       # validate that lead out-of-sample against a shuffled null
npm run chart         # regenerate docs/leadlag.svg from current data
npm run paths         # free YouTube learning paths (needs a YouTube key)
npm run collect       # add today's snapshot from all six sources. Refuses on a seeded ledger unless --force (see below)
npm run seed          # offline fallback: synthetic history, clearly labelled. Refuses if data/ledger.json is real (see below)
```

`npm run seed` replaces `data/ledger.json` with eight weeks of invented data, so it has the
same seat belt as the backfill. On a ledger of real months it refuses, says how many it would
throw away, and changes nothing. `npm run seed -- --force` goes ahead, after copying the real
ledger to `data/ledger.previous-<timestamp>.json` (a backup is never overwritten). A ledger
that is invented all the way through is replaced freely, and a fresh clone with no ledger
just gets one.

**What counts as real.** The `seeded` flag at the top of the ledger says what the ledger
*started* as, not what is in it, so `seed` and `backfill` do not go by the flag alone. They
look at every snapshot: a ledger is only freely replaceable if all of them are invented. One
real snapshot makes the whole ledger real, whatever the flag says, and it gets the same
refusal and the same timestamped backup as any other real ledger.

`npm run collect` will not add real numbers to a ledger flagged `seeded`. Mixing them would
score invented numbers next to real ones and label the result as sample data, which is how
real snapshots used to get thrown away without a backup. It stops, changes nothing, and
offers two ways out: `npm run backfill` for real history, or `npm run collect -- --force`,
which drops the invented weeks and starts a real ledger from that run. If an older run has
already left real snapshots in a seeded ledger, `--force` keeps them, drops the invented
ones, and copies the old ledger to `data/ledger.previous-<timestamp>.json` first. A run that
finds nothing real (no network) may still add to a seeded ledger, since nothing is mixed.

<details>
<summary><b>Running it while you're away</b></summary>

<br>

```bash
0 7 * * 1  cd /path/to/cresco && npm run collect -- --paths
```

A run that finds nothing materially new reports **no material change** and stops. That
is a deliberate rule: an unattended agent that has to justify its weekly slot will
manufacture novelty, and you will come home to forty pages of slop.

</details>

<details>
<summary><b>Adding API keys (all free, all optional)</b></summary>

<br>

| Key | Where | Time |
|---|---|---|
| `YOUTUBE_API_KEY` | Google Cloud console → enable *YouTube Data API v3* → API key | ~5 min, no billing card |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | developer.adzuna.com → register | ~5 min |

</details>

<br>

## Sources

| Source | Class | Key | Notes |
|---|:---:|:---:|---|
| **HN "Who is Hiring?"** | `hiring` | — | The sharpest free hiring signal on the open web. Every comment is one company describing one real role, dated, no recruiter SEO. |
| **Adzuna** | `hiring` | free | Live job-advert counts by keyword. |
| **Hacker News** | `practitioner` | — | Early indicator, and a reliable source of noise — weighted accordingly. |
| **Reddit** | `community` | — | Best-effort via public JSON; rate-limited. |
| **Bluesky** | `community` | — | Public AT Protocol. The social signal that is actually open. |
| **YouTube** | `content` | free | Weak as demand — content follows hype. Essential as supply. |
| **Wikipedia** | *leading* | — | 84 months of pageviews. Measured and rejected. |
| **GitHub** | *leading* | free | 84 months of new repositories per topic, for all 64 skills. Measured and rejected. |
| **npm** | *leading* | — | Collected and **rejected** — see the receipts above. |
| **Conference programmes** | *leading* | — | 84 months of conference counts per topic, for 17 of 64 skills. Measured and **rejected, closest miss** — see the receipts above. |

**Deliberately absent:** X/Twitter is a paid API tier, and LinkedIn has no public API
for this. Shipping a collector that breaks or invites a cease-and-desist would be worse
than not having one.

<br>

## How the index works

**1 · Count share, never volume.** The monthly hiring threads swing between 240 and 413
posts, so raw mention counts largely measure how busy the thread was — which made 22 of
25 skills read as "cooling" in a quiet month. Everything is stored per 1,000 job posts.

**2 · Normalise** each source against a **ledger-wide** reference scale, never the
current snapshot. Scale per-snapshot and a board where everything rises reads as flat.

**3 · Weight** by source class:

```
hiring 1.0   practitioner 0.7   community 0.45   content 0.35   vendor 0.2
```

**4 · Momentum** compares the last two snapshots, smoothed over three months, against
the preceding baseline window.

**5 · Signal-to-noise** is the share of weight carried by hiring evidence *alone*.
Practitioner chatter is weighted above social chatter but is still talk — counting it
as substance let a skill with 95 job adverts and a wall of blog posts read as real
demand.

Three rules keep the score honest, and each exists because it caught a real bug:

- **A new source gets no vote until it has three snapshots of its own.** Otherwise
  adding a collector rewrites the present without touching the past, and the jump shows
  up as momentum nothing in the world caused.
- **Fixture data never scores** in a real ledger. A collector falling back to sample
  data for want of a key must not quietly contribute invented numbers.
- **No call below an evidence floor.** One job advert becoming two is a 100% rise and
  means nothing.

| Verdict | Means | Measured hit rate |
|---|---|---|
| 🔵 **Table stakes** | Assumed rather than advertised — gaps here cost you quietly. | **71%**, never wrong |
| ⚪ **Cooling** | Demand receding. | **64%**, never wrong |
| 🟢 **Rising** | Climbing, and hiring is carrying the rise. | 29% — do not act on this |
| 🟡 **Hype** | Loud, but nobody is paying for it yet. | 20% — do not act on this |
| ⚫ **No call** | Not enough history to say anything honest. | — |

<br>

## Honest status

- **72 real months** (Sep 2020 → Aug 2026) across **64 skills**, mined from the Hacker News hiring archive.
  `npm run seed` generates a synthetic ledger for offline demos and flags itself as
  seeded in the UI *and* the data. Real and invented snapshots are never scored in the
  same ledger: `collect` refuses to add real numbers to a seeded one.
- **Only two sources currently score:** `whoshiring` and `hackernews`. Adzuna, YouTube,
  Bluesky and Reddit contribute evidence and learning paths now, and join the index once
  they have three snapshots of their own.
- **No leading indicator survived testing.** Wikipedia, npm, SEC EDGAR, GitHub and
  conference programmes were all measured and all rejected on the full history. Nothing
  in the product depends on any of them, and the collectors remain only so the tests can
  be re-run against new data.
- **Market adjustment was tested and rejected** — it costs 17 percentage points of
  accuracy. `data/market.json` is kept as context, not as an input.
- **Sample sizes are moderate** — 5 to 48 graded calls per verdict type across 85 total.
  `table-stakes` (n=21) and `cooling` (n=11) are the load-bearing ones.
- **The hiring signal is Hacker News**, so it reads startup and tech-forward hiring, not
  the whole labour market.
- **Source reweighting (step 4) is not built.**
- **Proxy coverage is partial and honest.** 24 of the original 25 skills have an npm or
  Wikipedia proxy, and 14 have an EDGAR series. All 64 have a GitHub series, because a
  specific topic tag exists for each. Conference programmes cover 17 skills — the
  programming languages, mobile platforms and a few practices with an unambiguous,
  dedicated conference category — deliberately not stretched to cover the rest. No proxy
  was invented to fill a blank.
- **64 skills across 8 categories**, and only about five get a confident call. That is the
  honest yield, not a bug — see the threshold table above.

<br>

## Two bugs worth knowing about

Both were the same failure wearing different clothes, and both nearly became findings:

**Throttling disguised as absence.** Wikimedia rate-limits, and the HTTP helper turned a
429 into `null` — which reads exactly like *"no such article"*. Ten valid titles were
briefly recorded as missing proxies. The Hacker News backfill did the same to itself at
scale: ~1,500 queries into a run it would start getting throttled, and because it
processed oldest-first, the months it silently lost were always the **most recent** ones.
That is what produced the 16-month ledger and the +0.440 that did not hold.

Both now serialise their requests, retry before believing a null, and the backfill
processes newest-first so throttling costs old history rather than the months the
dashboard reports on.

<br>

## How this is tested

```bash
npm test        # 195 cases, no network, no fixtures on disk
npm run typecheck
```

A product whose whole pitch is *"it grades its own predictions"* has an obvious
incentive to grade itself generously. So the grader is the most heavily tested thing
here, and it is tested for **falsifiability** rather than for working:

- **Every verdict can be graded wrong.** For each of `rising`, `cooling`,
  `table-stakes` and `hype`, a seeded generator explores 4,000 outcomes and asserts
  that `wrong` is reachable. A rule that cannot fail is not a scoring rule, and this
  suite fails the build if one ever becomes decoration.
- **`cooling` is the exact mirror of `rising`** across 2,000 random movements — so one
  direction cannot quietly be graded more generously than the other.
- **Open claims never dilute the published rate**, `partial` never counts as correct,
  and an ungraded system reports `null` rather than a hit rate it has not earned.

The rest covers the ways a number here can be *silently* fabricated, one test per bug
that actually shipped: the `source|metric` scale key (keyed on source alone, one
ordinary `npm run collect` would have collapsed six years of history and made every
skill look vertical at once), fixture data scoring in a real ledger, a brand-new
collector manufacturing momentum on arrival, and the matcher cases — `"a lambda
function in Python"` is not AWS demand, `"ready to go now"` is not Go.

Writing these found one more, now fixed: `loadLedger()` returned `{ ...EMPTY }`, a
shallow copy sharing its `snapshots` and `claims` arrays with a module-level constant,
so one caller mutating its "own" empty ledger changed what the next caller received.

<br>

## What's being researched next

Job postings lag. [`docs/RESEARCH.md`](docs/RESEARCH.md) holds verified notes on
candidate **leading** indicators — every endpoint called live, with the traps that would
have manufactured fake signals written down next to them.

Wikipedia, npm, SEC EDGAR, GitHub repos by topic and conference programmes were all
tested against 72 months of hiring data. All five failed. EDGAR (companies naming a
technology to investors — Model Context Protocol went 0 → 1 → 26 → 40 across recent
quarters) peaked at a lag of one to two months rather than the quarters its mechanism
predicted. GitHub rose in the same month as hiring rather than ahead of it. Conference
programmes came closest — only 8.8% of shuffled tests scored as well as the real one —
but the real correlation still landed just under the bar we set before running the test.

No candidate with a clear mechanism is left untested. The two still on the list — EU
procurement notices and Coursera course-launch dates, both noted in
[`docs/RESEARCH.md`](docs/RESEARCH.md) — are weaker bets, kept for completeness rather
than because either looks likely to work.

<br>

## Stack

TypeScript · React 19 · Vite 6 · Express · Tailwind 4.
Storage is a JSON ledger on disk — no database, deliberately.

<br>

---

<div align="center">
<sub><a href="LICENSE">MIT Licence</a></sub>
</div>
