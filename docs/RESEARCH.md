# Leading indicators — verified research notes

Candidate sources that might predict skill hiring demand *before* it appears in job
postings. Every endpoint below was called live; counts are real observed responses,
independently re-verified rather than taken on trust.

**Status:** research only. Nothing here is wired into the index.

---

## The binding constraint (read this first)

**Our limit is hiring history, not indicator history.** EDGAR offers 25 years, EU TED
10, GitHub effectively unlimited. Our hiring ledger is **22 months**.

To test whether something leads by 2–4 quarters you need hiring history substantially
longer than the lead itself, or there are only a handful of overlapping observations per
skill and no indicator can be told apart from noise however good it is.

So the highest-value next move is **extending the Hacker News backfill backwards** — the
threads run to 2011, so 60+ months is free — not adding a fifth indicator. Doing it the
other way round means building on an untestable signal.

---

## Tier 1 — worth building

### SEC EDGAR full-text search
`https://efts.sec.gov/LATEST/search-index?q="TERM"&startdt=YYYY-MM-DD&enddt=YYYY-MM-DD`
Keyless. Requires a descriptive `User-Agent`. Count at `hits.total.value`. History to 2001.

Verified quarterly counts:

| | 2024 Q1 | 2025 Q1 | 2025 Q3 | 2026 Q1 |
|---|---|---|---|---|
| Model Context Protocol | 0 | 1 | 26 | 40 |
| AI agents | 4 | 110 | 225 | 436 |

Companies describing commitments to investors before they staff them. Denominator for
share-normalisation: `https://www.sec.gov/Archives/edgar/full-index/{year}/QTR{n}/form.idx`.
Coverage ~13/25 skills. Expected lead 2–4 quarters.

### GitHub repos by topic × creation month
`https://api.github.com/search/repositories?q=topic:mcp+created:2026-05-01..2026-05-31&per_page=1`
Keyless, `total_count`. 10 req/min unauthenticated, 30/min with a free PAT.

Verified `topic:mcp` (MCP launched Nov 2024):

| 2024-06 | 2024-12 | 2025-05 | 2026-05 |
|---|---|---|---|
| 29 | 169 | 724 | 7573 |

The inflection lands in the right month — a clean natural experiment for calibrating
lead time. Repo *creation* is a human act, unlike downloads. Coverage ~22/25 skills.

### Conference programmes
The sched.com JSON API is key-gated and robots-disallowed; the **`.ics` feed is public
and permitted**. `https://kccncna2025.sched.com/all.ics` — verified 542 sessions, each
with a track category, giving a per-skill series directly (AI+ML 39, Platform
Engineering 35, Security 21).

- KubeCon 2021→2026 · FOSDEM `https://fosdem.org/{year}/schedule/xml` 2013→2026 (13 years)
- pretalx `https://pretalx.com/api/events/` — 732 events, 2018→2027
- Exclude `SOLUTIONS SHOWCASE` — that's paid sponsor placement, not signal.

Schedules are retrievable ~3 months ahead (measured via Wayback first-snapshots, *not*
the 6–12 months assumed). The mechanism is longer — a talk published in month M was
proposed around M−2 by someone already deep in the topic at M−4 — but that is a
hypothesis to test, not an assertion.

---

## Tier 2 — usable with caveats

| Source | Endpoint | Caveat |
|---|---|---|
| **GitHub Innovation Graph** | `raw.githubusercontent.com/github/innovationgraph/main/data/topics.csv` | Official GitHub data, `num_pushers` per topic per quarter, 2020Q1→2026Q1. Best coverage of anything. But 3–5 month publication lag plus quarterly granularity eats most of the lead. Zeros are **censored, not zero**. |
| **EU TED procurement** | `POST api.ted.europa.eu/v3/notices/search` | Keyless, 10+ years. Kubernetes 2016=0 → 2025=317. Genuinely independent of US/English sources. Rate-limited. |
| **Coursera catalogue** | `api.coursera.org/api/courses.v1?fields=name,slug,startDate` | 23,773 courses; `startDate` is a stored field, so one crawl reconstructs a retroactive launch series. Survivorship bias undercounts older months. |
| **Wikipedia edits / article creation** | `wikimedia.org/api/rest_v1/metrics/edits/per-page/...` | Editing is a stronger commitment than reading, and a different population from the pageviews we already use. Article creation dates MCP to 2025-04-14. Tiny N. |
| **USAspending** | `POST api.usaspending.gov/api/v2/search/spending_by_award_count/` | Back to 2008, but **policy-driven not market-driven** — the zero-trust ramp tracks a federal mandate. ~8/25 skills. |
| **arXiv** | `export.arxiv.org/api/query?...` (https, not http) | Rich for ~10 research-native skills, **zero** for Apache Iceberg. Normalise against total submissions. |
| **crates.io dump** | `static.crates.io/db-dump.tar.gz` | The only source with both package creation *and* dependent-count growth with full history. Rust only. See the contamination warning below. |
| **ClickHouse playground** | `play.clickhouse.com/?user=play` | 11.1bn GitHub events, 2011→present, sub-second. Backtesting only — inherits the firehose collapse below. |

---

## Traps found — each would have manufactured a fake signal

**Substring collisions.** Naive matching for `RAG` in the FOSDEM 2026 programme gives
**464** hits; word-boundary matching gives **6**. The rest are *sto**rag**e*,
*f**rag**ment*, *d**rag***. A 77× inflation. Word boundaries and a per-skill stoplist are
mandatory before any regression.

**APIs answering a different question than the one asked.** EDGAR does not error on
malformed dates — it silently returns the **all-time** count. Kubernetes all-time =
1307; Kubernetes 2025 Q1 = 47. A first run returned an identical number every quarter
and looked like plausible flat data. Always assert the series actually moves. This is
the same class as Algolia ranking by relevance when we wanted recency.

**Name collisions.** `Terraform` in EDGAR returns 3,642 — TFC Thornton Oil LLC, bond
funds, real-estate entities. `"HashiCorp Terraform"` returns **4**. `dbt` hits the
10,000 cap on unrelated text. `DuckDB` returns 0 all-time.

**Secular platform inflation.** GitHub repo creation rises for everything. Control topic
`php` grew +71% from 2024-03 to 2026-03; `kubernetes` grew +257% over the same window.
Kubernetes does show real excess growth — but most of any raw series is platform drift,
and it has to be removed against both total repos created and a basket of control topics.

**Package creation is no longer purely human.** Testing the "creation beats downloads"
hypothesis on crates.io: new crates per month went 3,111 (2025-01) → 16,082 (2026-05),
and *every* keyword inflated in lockstep — including inert ones like `async` and
`embedded`. Agents publish packages now. It survives only as share-of-total: `llm` went
0.11% → 4.4% while `async` stayed flat at 1.2%. **Never use raw counts from any package
registry after 2025.**

**Non-stationary history.** Re-running the same historical GitHub search returns a
*different* number later — deleted repos leave, topics get applied retroactively.
Snapshot on collection; never assume a backfill reproduces.

---

## Rejected — do not re-research

| Source | Why |
|---|---|
| **Stack Overflow** | Platform collapse. `python` questions in June: 20,703 (2021) → 246 (2026). A 99% denominator collapse swamps any per-skill signal, and the new skills have no tags at all (`mcp` = 0). Tempting and completely dead. |
| **GH Archive (recent)** | The public event firehose is dying — global WatchEvent 6,206,143 (2025-01) → 79,895 (2026-07). Unusable for the recent ~12 months; fine for backtesting to 2025-05. |
| **Patents** | Structurally disqualified: publication is 18 months after filing, grant 2–4 years. The filing date is in the data but unobservable until years later — a lagging indicator wearing a leading indicator's clothes. |
| **Companies House (UK)** | No full-text search across filed accounts, and most UK companies file abridged accounts with no narrative. Not an EDGAR equivalent. |
| **Docker Hub** | Single cumulative counter, no time series. Mostly CI traffic — the npm failure mode. |
| **pypistats** | Only 180 days of history. |
| **Homebrew analytics** | Fixed trailing windows only, no retrievable history. |
| **VS Code Marketplace** | Undocumented internal API (ToS-risky) and cumulative snapshots. |
| **Libraries.io / ecosyste.ms** | Dependent counts are current snapshots; no bulk export, no keyword aggregate. |
| **Reddit / Meetup / Discord** | No retrievable historical counts. |
| **Google Books Ngram** | Corpus stops at 2019 — before the skills we track existed. |
| **SEC Form D** | Zero results; it's a checkbox form with no free-text technology description. |
| **Earnings transcripts, Crunchbase, Dealroom** | Paywalled or no free historical access. |
| **Certification launches** | No machine-readable source. The Wayback workaround is unreliable — slug renames reset the apparent date (dated CKA to 2019; it launched 2016). Qualitative only. |
| **Stock indices (FTSE 100)** | No per-skill resolution — one number describing the whole economy. The per-technology signal in public-company data lives in the **text of filings, not the share price**. |

---

## Labour-market signals — and a hypothesis partly refuted

**The salary-premium idea is weaker than it sounds.** Computed directly from the Stack
Overflow Survey (US respondents, n=5,079, median $150k): Terraform +23.3%, Kubernetes
+20.0%, Go +17.6%, Rust +7.0%, Python +0.0%.

The premiums are real. They are also **strikingly stable** — Terraform ran
+26/+21/+20/+21/+23 across 2021–2025. A slow-moving level is not a leading indicator.
The theory was that pay moves before headcount; the data says pay for a given skill
barely moves at all.

Measured confound, not assumed: high-premium respondents report 26–32 technologies
against a median of 18, and 15 years' experience against 14 — they are senior
polyglots. Matching on a 5–15 year experience band shrinks the premium without killing
it (Terraform +23.3 → +18.2).

**A correction worth recording: Adzuna's `/history` caps at 12 months.** The commonly
repeated claim that it offers 24+ is wrong. Verified against Adzuna's own spec at
`https://api.adzuna.com/v1/api-docs/adzuna` (33 KB, public): the `months` parameter
maxes at 12 and there is **no date, from, to or offset parameter of any kind**. It fails
our 24-month bar today and only clears it after a year of self-collection.

### The gap in our own method

`https://raw.githubusercontent.com/hiring-lab/job_postings_tracker/master/US/job_postings_by_sector_US.csv`
— CC BY 4.0, keyless, verified: 210,674 rows, with a **Software Development** index
daily from 2020-02-01 to 2026-08-21 (Feb 2020 = 100).

It went 233.8 at the 2022 peak → 65.2 in Aug 2025 → 74.6 now. **Our share-per-1,000
measure cannot see any of that.** Counting share was the right fix for thread-size
noise, but it made us blind to whether the whole market is expanding or contracting — a
skill holding share in a market that halved is not holding demand. This is the control
series the ledger currently lacks, and it is one CSV.

| Source | Verdict |
|---|---|
| **Stack Overflow Survey** | `github.com/StackExchange/Survey/raw/refs/heads/main/packages/archive/2025/results.csv` — keyless, 2011→2025, 140 MB. Annual only. Vocabulary churn is severe: Kafka dropped in 2025; WebAssembly, Flink, dbt, Iceberg and eBPF never appear. |
| **Indeed Hiring Lab** | Recommended as **control/denominator**, rejected as per-skill — its 44 categories are occupational sectors, none resolve to a technology. |
| **HN salary disclosures** | Free upside in data we already hold, but only 11–19% of posts disclose pay: 4–21 figures per skill per month. Quarterly and only for the ~8 highest-frequency skills. Tokenisation warning: bare "Go" matched 254 posts vs "Golang" 9. |
| **ITJobsWatch** | The best data — per-skill contract day rates, permanent salaries and volumes on one taxonomy, with MCP as a clean natural experiment (0→18→131 postings, £475→£600 day rate). **Blocked on two counts:** no API or bulk download (HTML parsing only), and CC BY-NC-SA — NonCommercial plus a ShareAlike term that is viral onto derived data, which conflicts with this MIT repo. |

**Rejected:** CEDEFOP Skills-OVATE (rolling 4 quarters only; granular data needs research
accreditation), USAJOBS (current openings only, federal-only), O*NET (years-lagging —
Kubernetes was added only recently despite being mainstream since 2018; ~6/25 coverage),
BLS/JOLTS, Eurostat and ONS/NOMIS (deep and free but SOC/NAICS only — no per-skill
resolution, ever), Upwork/Fiverr/Toptal and freelance marketplaces (approval-gated or
crawling explicitly forbidden), time-to-fill (no free per-skill source; the one credible
US series, FRED `DHIDFHDMII`, stopped in 2018). Lightcast Open Skills is a taxonomy
rather than demand data — keep it only as a name-normalisation dictionary so
`k8s`/`Kubernetes` and `Go`/`Golang` collapse correctly.

### Cheap wins on the Adzuna key we already have a slot for

`server/collectors/adzuna.ts` currently calls `/search` for a current count only — a
snapshot with no history. Three additions, ~125 calls/month against a 2,500 free limit:

1. `/jobs/{country}/history?what={skill}&months=12` — a monthly offered-salary series,
   12 months deep immediately.
2. `contract=1` / `permanent=1` on `/search` — contract share per skill. Contract demand
   moves before permanent hiring.
3. Two `max_days_old` calls (7 vs 60) — a vacancy-staleness ratio, a usable time-to-fill
   proxy given the real series is dead.

Attribution ("The Adzuna API") is required, and their free tier covers personal
research — worth a look at the terms before any commercial use.

---

## Tested since — results

| Candidate | Outcome |
|---|---|
| **SEC EDGAR** | **Tested, weak.** 14 skills × 84 months, share per 10,000 filings. Hold-out +0.117, 91% of splits positive — the best of anything tested — but 19% of shuffled nulls beat it, and the peak lag is 1–2 months rather than the 2–4 quarters the mechanism predicted. A two-month lead is not actionable for learning advice. |
| **Wikipedia pageviews** | Rejected on 72 months (+0.043, 18.3%). Decayed monotonically as the sample grew from 16 months. |
| **npm downloads** | Rejected (+0.012, 28.0%). |
| **Indeed market adjustment** | Rejected — costs 17 points of backtest accuracy. |

Untested: GitHub topic-creation, conference programmes, EU TED, Coursera launch dates.
Given four refutations the prior should be that they fail too.

**The EDGAR guard is worth reusing.** `assertVaries()` throws if a fetched series never
changes, because EDGAR returns the all-time count rather than erroring on a bad date
range. Any collector whose API can silently answer a different question should have one.

---

## Next actions, in order

1. **Extend the hiring backfill backwards** to 60+ months. Unblocks everything else.
2. Build **SEC EDGAR** and **GitHub topic-creation** collectors, with word-boundary
   matching, hand-checked disambiguation per skill, and share-normalisation.
3. Re-run `holdout` with the longer hiring history before trusting any new lead.
4. Add the **Indeed Hiring Lab** Software Development index as a control series — one
   CSV, and it closes a real blind spot in the share-based measure.
5. Only then consider wiring a leading indicator into a verdict.
