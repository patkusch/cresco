# Cresco

**A skill-demand radar that tells you what to learn next — and where to learn it free.**

Cresco watches hiring demand, practitioner signal and social chatter across six
sources, weights them so that noise cannot masquerade as demand, and points you at
the free YouTube course for whatever is actually rising.

It runs unattended. You come back to what changed.

---

## The problem it solves

Every "skills to learn in 2026" list is written by someone with an incentive, from
sources that all point at each other. A vendor blog, a viral thread and a paid job
advert are treated as the same kind of evidence — and they are not remotely the same
kind of evidence.

Cresco's whole thesis is the weighting. A skill named in a paid job advert is someone
committing money. A skill trending on social is someone committing a sentence. The
**signal-to-noise** figure on every card is the share of that skill's score carried by
people actually paying for it. Sort by it and the hype separates from the demand.

## What makes it different: the calls are gradeable

Most research tools produce a report and forget it. Cresco writes every verdict to a
**claim ledger** as a dated, falsifiable statement with a check-back date attached.

That matters because this domain has a grader built in — **time passing**. The system
claims "X is rising, Y is a hype spike." Months later, reality settles the bet. Its
self-evaluation and its product value are the same mechanism: checking its own old
calls is both the regression suite and a headline finding.

The loop:

| Step | Status |
|---|---|
| 1. Collect, unattended — six sources on a schedule | **built** |
| 2. Commit to a call — dated, falsifiable, with a check-back date | **built** |
| 3. Score itself when the check-back date arrives | next |
| 4. Reweight sources by which ones survived scoring | next |

Steps 3 and 4 are not built yet, and the dashboard says so on its face rather than
implying a loop that does not close. Step 2 exists now specifically so that when
scoring lands it has real history to grade instead of starting from zero.

Step 4 is where this earns its keep: *which of your sources lie to you* is knowledge
no general-purpose model can have about your particular feed.

---

## Quickstart

```bash
npm install
npm run seed     # eight weeks of synthetic history so the dashboard has something to show
npm run dev      # http://localhost:3000
```

Then, for real data:

```bash
npm run collect -- --paths
```

### Running it while you are away

```bash
0 7 * * 1  cd /path/to/cresco && npm run collect -- --paths
```

A run that finds nothing materially new reports *no material change* and stops. That
is a deliberate design rule: an unattended agent that has to justify its weekly slot
will manufacture novelty, and you will come home to forty pages of slop.

---

## Sources

Every key is optional. Cresco runs with none of them; each key you add upgrades one
collector from fixture to live.

| Source | Class | Key needed | Notes |
|---|---|---|---|
| **HN "Who is Hiring?"** | hiring | none | The sharpest free hiring signal on the open web. Every comment is one company describing one real role, dated, no recruiter SEO. |
| **Adzuna** | hiring | free | Live job-advert counts by keyword. The load-bearing demand signal. |
| **Hacker News** | practitioner | none | Early indicator, and a reliable source of noise — weighted accordingly. |
| **Reddit** | community | none | Best-effort via public JSON; rate-limited. |
| **Bluesky** | community | none | Public AT Protocol. The social signal that is actually open. |
| **YouTube** | content | free | Weak as demand (content follows hype), essential as supply. |

**Not included, deliberately:** X/Twitter is a paid API tier, and LinkedIn has no
public API for this. Shipping a collector that breaks or invites a cease-and-desist
would be worse than not having one.

Copy `.env.example` to `.env` to add keys. Every one is free and takes about five
minutes.

---

## How the index works

1. Each source is normalised against a **ledger-wide** reference scale — never the
   current snapshot. Scaling per-snapshot destroys the thing being measured: if every
   skill grows, the max grows with it and the whole board reads as flat.
2. Normalised values are averaged per source class, then weighted:
   hiring `1.0`, practitioner `0.7`, community `0.45`, content `0.35`, vendor `0.2`.
3. **Momentum** compares the last two snapshots against the preceding baseline window.
4. **Signal-to-noise** is the share of weight carried by hiring evidence alone.

| Verdict | Means |
|---|---|
| **Rising** | Climbing, and hiring is carrying the rise. |
| **Hype** | Loud, but nobody is paying for it yet. |
| **Table stakes** | Assumed rather than advertised — gaps here cost you quietly. |
| **Cooling** | Demand receding. |
| **No call** | Not enough history to say anything honest. |

---

## Honest status

- The bundled ledger is **synthetic** — eight weeks of plausible trajectories so the
  dashboard is not empty on first run. It is flagged as seeded in the UI and in the
  data. Nothing here is a measurement until you run a collection.
- Self-scoring (steps 3 and 4 above) is **not built**. Claims are minted with
  check-back dates; nothing grades them yet.
- Fixture learning paths link to a real YouTube *search* rather than inventing video
  titles and IDs. Add a YouTube key for actual ranked picks.

## Stack

TypeScript · React 19 · Vite 6 · Express · Tailwind 4. Storage is a JSON ledger on
disk — no database, deliberately.

## Licence

MIT © Patricia Kusch
