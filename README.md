<div align="center">

<img src="docs/banner.svg" alt="Cresco — what to learn next, and where to learn it free" width="100%">

<br>

**A skill-demand radar that tells you what to learn next — and where to learn it free.**

<br>

![MIT](https://img.shields.io/badge/licence-MIT-1c1d20?style=flat-square&labelColor=07080a)
![TypeScript](https://img.shields.io/badge/TypeScript-3987e5?style=flat-square&labelColor=07080a)
![React 19](https://img.shields.io/badge/React_19-199e70?style=flat-square&labelColor=07080a)
![No keys required](https://img.shields.io/badge/API_keys-optional-c98500?style=flat-square&labelColor=07080a)
![Runs unattended](https://img.shields.io/badge/runs-unattended-d55181?style=flat-square&labelColor=07080a)

</div>

<br>

Cresco watches hiring demand, practitioner signal and social chatter across six
sources, weights them so that noise cannot masquerade as demand, and points you at
the free YouTube course for whatever is actually rising.

It runs unattended. You come back to what changed.

```bash
npm install && npm run seed && npm run dev
```

<br>

---

## The one idea

> Every "skills to learn in 2026" list treats a vendor blog post, a viral thread and
> a paid job advert as the same kind of evidence. **They are not the same kind of
> evidence.**

A skill named in a paid job advert is someone committing money. A skill trending on
social is someone committing a sentence. The **signal-to-noise** figure on every card
is the share of that skill's score carried by people actually paying for it.

Sort by it and the hype separates from the demand.

<br>

## What makes it different — the calls are gradeable

Most research tools produce a report and forget it. Cresco writes every verdict to a
**claim ledger** as a dated, falsifiable statement with a check-back date attached.

That matters because this domain has a grader built in: **time passing.** The system
claims *"X is rising, Y is a hype spike."* Months later, reality settles the bet. Its
self-evaluation and its product value turn out to be the same mechanism — checking
its own old calls is both the regression suite and a headline finding.

<table>
<tr><td width="60"><b>1</b></td><td><b>Collect, unattended</b><br><sub>Six sources on a schedule. A run that finds nothing says so.</sub></td><td width="90"><code>built</code></td></tr>
<tr><td><b>2</b></td><td><b>Commit to a call</b><br><sub>Dated, falsifiable, with a check-back date. An opinion with no date attached is not a prediction.</sub></td><td><code>built</code></td></tr>
<tr><td><b>3</b></td><td><b>Score itself</b><br><sub>The call is re-opened when its date arrives and graded against what happened.</sub></td><td><code>next</code></td></tr>
<tr><td><b>4</b></td><td><b>Reweight the sources</b><br><sub>Sources whose calls survive earn weight; sources that cried wolf lose it.</sub></td><td><code>next</code></td></tr>
</table>

Steps 3 and 4 are **not built**, and the dashboard says so on its face rather than
implying a loop that closes. Step 2 exists now specifically so that when scoring lands
it has real history to grade instead of starting from zero.

Step 4 is where this earns its keep: *which of your sources lie to you* is knowledge
no general-purpose model can have about your particular feed.

<br>

## Quickstart

```bash
npm install
npm run seed          # eight weeks of synthetic history, so the dashboard isn't empty
npm run dev           # → http://localhost:3000
```

Then, for real data:

```bash
npm run collect -- --paths
```

<details>
<summary><b>Running it while you're away</b></summary>

<br>

```bash
0 7 * * 1  cd /path/to/cresco && npm run collect -- --paths
```

A run that finds nothing materially new reports **no material change** and stops.

That is a deliberate design rule, not an oversight. An unattended agent that has to
justify its weekly slot will manufacture novelty, and you will come home to forty
pages of slop.

</details>

<details>
<summary><b>Adding API keys (all free, all optional)</b></summary>

<br>

Copy `.env.example` to `.env`. Each key upgrades one collector from fixture to live —
none of them are required for the app to run.

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
| **Adzuna** | `hiring` | free | Live job-advert counts by keyword. The load-bearing demand signal. |
| **Hacker News** | `practitioner` | — | Early indicator, and a reliable source of noise — weighted accordingly. |
| **Reddit** | `community` | — | Best-effort via public JSON; rate-limited. |
| **Bluesky** | `community` | — | Public AT Protocol. The social signal that is actually open. |
| **YouTube** | `content` | free | Weak as demand — content follows hype. Essential as supply. |

**Deliberately absent:** X/Twitter is a paid API tier, and LinkedIn has no public API
for this. Shipping a collector that breaks or invites a cease-and-desist would be
worse than not having one.

<br>

## How the index works

**1 · Normalise** each source against a **ledger-wide** reference scale — never the
current snapshot. Scaling per-snapshot destroys the thing being measured: if every
skill grows, the max grows with them and the whole board reads as flat.

**2 · Weight** by source class:

```
hiring 1.0   practitioner 0.7   community 0.45   content 0.35   vendor 0.2
```

**3 · Momentum** compares the last two snapshots against the preceding baseline window.

**4 · Signal-to-noise** is the share of weight carried by hiring evidence *alone*.
Practitioner chatter is better evidence than social chatter, and is weighted above it —
but it is still talk, and counting it as substance is what let a skill with 95 job
adverts and a wall of blog posts read as real demand.

| Verdict | Means |
|---|---|
| 🟢 **Rising** | Climbing, and hiring is carrying the rise. |
| 🟡 **Hype** | Loud, but nobody is paying for it yet. |
| 🔵 **Table stakes** | Assumed rather than advertised — gaps here cost you quietly. |
| ⚪ **Cooling** | Demand receding. |
| ⚫ **No call** | Not enough history to say anything honest. |

<br>

## Honest status

- The bundled ledger is **synthetic** — eight weeks of plausible trajectories so the
  dashboard isn't empty on first run. It is flagged as seeded in the UI *and* in the
  data. Nothing here is a measurement until you run a collection.
- **Self-scoring is not built.** Claims are minted with check-back dates; nothing
  grades them yet.
- Fixture learning paths link to a real YouTube **search** rather than inventing video
  titles and IDs. Add a YouTube key for actual ranked picks.

<br>

## Stack

TypeScript · React 19 · Vite 6 · Express · Tailwind 4.
Storage is a JSON ledger on disk — no database, deliberately.

<br>

---

<div align="center">
<sub><a href="LICENSE">MIT Licence</a></sub>
</div>
