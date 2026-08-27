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

## Next actions, in order

1. **Extend the hiring backfill backwards** to 60+ months. Unblocks everything else.
2. Build **SEC EDGAR** and **GitHub topic-creation** collectors, with word-boundary
   matching, hand-checked disambiguation per skill, and share-normalisation.
3. Re-run `holdout` with the longer hiring history before trusting any new lead.
4. Only then consider wiring a leading indicator into a verdict.
