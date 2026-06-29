# India Procurement Watch — Full Work Roadmap

Everything currently pending across bug fixes, the Postgres migration, new features, and collaboration tasks. No timelines — just full scope.

---

## 1. Critical / Blocking Fixes

### 1.1 Hardcoded SHA-256 hash check (breaks the tool for anyone but the original file)
- `analyse.py` contains a hardcoded `EXPECTED_HASHES` dict mapping `aoc_tenders.db` and `tenders_vps.db` to exact SHA-256 hashes.
- Any new data drop — a re-scrape, an updated dataset, a contributor's own data — gets rejected as "corrupted" even if perfectly valid, because the hash won't match.
- **Fix:** Remove the hard block, or convert it into a non-fatal warning (e.g. "hash differs from last known release — proceeding anyway") so new data isn't permanently locked out.
- This is the single most important fix — it currently makes the project unusable as an open, multi-contributor civic-tech tool.

### 1.2 Incomplete `requirements.txt`
- Only lists `flask` and `flask-cors`.
- `build_ml_risk.py` and `build_live_alerts.py` actually require `numpy`, `pandas`, `scikit-learn`, and `scipy`.
- Currently fails silently/gracefully (ML risk scoring and live alerts just get skipped with a log warning) — but this isn't documented anywhere, so anyone following the README's install instructions gets a degraded dashboard with no clear explanation.
- **Fix:** Add the missing packages to `requirements.txt`, or clearly mark them as an "optional extras" install (`pip install -r requirements-ml.txt`) with a note in the README about what's lost without them.

---

## 2. Database Migration: SQLite → PostgreSQL

Sarthak is moving the canonical data store to a PostgreSQL instance on his Contabo VPS, refreshed via a scraper pipeline workflow that runs every 24 hours (confirmed: batch refresh, not real-time writes). The dashboard will read from this instance instead of local SQLite file drops. Full scope of what changes:

### 2.1 Connection layer
- Replace all `sqlite3.connect(...)` calls across `app.py`, `analyse.py`, `build_summary.py`, `build_cartels.py`, `build_ml_risk.py`, `build_live_alerts.py`, `match_sanctions.py`, `build_search_index.py` with a PostgreSQL driver (`psycopg2` or `asyncpg`).
- Centralize connection logic (host, port, db name, credentials) into a single config module/env-var setup rather than scattering connection strings across files.

### 2.2 JSON query syntax rewrite
- All current `json_extract(details_json, '$."Field Name"')` calls (SQLite syntax) need to become PostgreSQL JSONB syntax: `details_json->>'Field Name'`.
- This touches every file that reads tender/award detail fields — not a find-and-replace, since SQLite and Postgres JSON operators have different semantics around type casting, null handling, and nested paths.
- Need to confirm whether the source data will be stored as `JSONB` (indexed, queryable) or plain `TEXT` (would require re-parsing) — JSONB is strongly preferred for query performance at this scale.

### 2.3 Full-text search rebuild
- Current search relies on SQLite's FTS5 virtual tables (`build_search_index.py`).
- PostgreSQL has no FTS5 equivalent — needs either:
  - `tsvector` + `GIN` index (PostgreSQL's native full-text search), or
  - `pg_trgm` extension for trigram-based fuzzy search (better for partial/typo-tolerant matches).
- This is a rewrite, not a port — ranking, tokenization, and query syntax all differ from FTS5.

### 2.4 Pipeline trigger logic change
- Current flow: user drops `.db` files → clicks "Analyse Data" → pipeline runs locally → dashboard reads from `summary.db`.
- New flow: Sarthak's VPS workflow refreshes Postgres every 24 hours independently. The dashboard becomes a **read-only consumer** of pre-aggregated tables — no more local "Analyse Data" trigger needed, since the data is already aggregated upstream (or aggregation logic itself may need to move server-side, to be confirmed).
- Need to clarify with Sarthak: will the VPS workflow run the equivalent of `build_summary.py`/`build_ml_risk.py`/`build_cartels.py` itself, or does the dashboard still need to run aggregation locally against the live Postgres data on each load?

### 2.5 Authentication
- The current architecture diagram shows an "API Coordinator (RestAPI)" on the Contabo VPS with no visible auth layer.
- Before the dashboard talks to this over the network, need to confirm: API key / token-based auth, IP allowlisting, or something else — an unauthenticated public endpoint sitting in front of a live database is a real exposure risk.

### 2.6 Migration approach
- Suggested approach: port and verify **one read-only endpoint first** (e.g. `/api/kpis`) end-to-end against the real Postgres instance before touching the rest of the codebase. Once that round-trip is confirmed working, the remaining endpoints follow the same pattern and can be ported more mechanically.
- Full list of files needing query changes: `app.py` (all `/api/*` routes), `analyse.py` (orchestration + schema checks), `build_summary.py` (core aggregation), `build_cartels.py` (graph queries), `build_ml_risk.py`, `build_live_alerts.py`, `match_sanctions.py`, `build_search_index.py`.

---

## 3. New Features Requested by Sarthak

### 3.1 Agentic search
- Ask: natural-language query input (e.g. *"Find me all the tenders issued by all the Educational Bodies for On Screen Marking and Evolution"*) that returns a relevant result set.
- Explicitly doesn't need to be highly accurate — "works just enough" is acceptable as a first version.
- **Critical constraint:** must NOT let an LLM generate and execute raw SQL directly against the database. This was explicitly flagged as a risk in the Darshi meeting notes (a user warned the team about allowing SQL to write custom queries). Needs a constrained query layer instead — the LLM should map natural language to a fixed set of pre-defined filters/parameters (organisation, tender type, date range, keyword) rather than writing arbitrary SQL.

### 3.2 RTI feedback loop
- Requested by Sarthak, tagged to Rishabh, under "CBSE investigation pipeline feature request."
- Scope not yet fully detailed — likely connects flagged anomalies (e.g. the corrigendum-pattern findings) to a structured RTI filing/tracking workflow, but needs clarification from Sarthak/Rishabh on exact intended functionality.

### 3.3 Report / Crowd-fund information feature
- Tagged to Hemanth Alex and madbull in Sarthak's feedback thread.
- Appears related to the broader crowd-source reporting feature from the meeting notes (see 4.1) and possibly a Tableau-based visualization layer (madbull's earlier suggestion).

---

## 4. Features From Darshi Meeting Notes

### 4.1 Crowd-source / reporting feature
- Users should be able to discuss specific tender documents and post supporting material: articles, ground-reality photos, progress updates.
- Meeting feedback was split on implementation: some preferred a comment system over a live chat; moderation was raised as a hard requirement, not optional, given the legal sensitivity of publicly discussing specific companies/contracts.

### 4.2 Company / organisation search
- Search by participating company (bidder) or by inviting organisation/ministry.
- Should include document download capability for the underlying tender, and ideally an alert/subscription system for updates on tracked tenders.

### 4.3 Audience-specific views
- Separate UI modes for journalists, analysts, and general civilians — same underlying data, different framing/complexity.
- Civilian-facing view specifically needs a "dumbed down," plain-language presentation rather than raw tables/charts.

### 4.4 Category/interest filtering
- Filter tenders by sector — health & medicine, transport, etc.

### 4.5 Tender timeline view
- Show how a given tender changed over time (amendments, corrigenda, value revisions).
- This connects directly to the corrigendum-pattern analysis already done manually on the Punjab tenders earlier — this feature would surface that kind of finding automatically instead of requiring manual SQL digging.

### 4.6 Expiring / renewed tenders page
- A view filtered by company size/funds showing tenders that are expiring soon or were recently renewed.

### 4.7 GitHub repository for public contribution
- Already exists (`India-Procurement-Watch` repo) — meeting notes specifically called for a repo so outside contributors can submit PRs. Confirm repo is structured to actually support external PRs cleanly (contribution guidelines, issue templates).

### 4.8 Dead link / data anomaly handling
- h1dden5643 and c_f00 reported dead `detail_url` links in the scraped data (screenshot showed "Invalid Url. Please Check" from the source portal).
- Needs investigation into how widespread this is across the dataset, and whether the dashboard should flag/exclude unreachable source links rather than silently displaying them.

### 4.9 MCA data limitation (no action item, but a constraint to design around)
- A meeting participant (likely a contractor/researcher) noted that MCA (Ministry of Corporate Affairs) data is limited by a paywall, and that private companies aren't required to disclose everything via forms like AOC-4/MGT-7.
- This directly limits how thoroughly company-ownership/director data can be verified — relevant to both the cartel-detection and sanctions-matching features, which rely on accurate company linkage data. Any feature claiming to "fully map" company ownership needs to caveat this limitation.

---

## 5. Collaboration & Documentation Tasks

### 5.1 Tender doc with Amogh
- Sarthak asked you to collaborate with Amogh on a "final tender doc" describing what's in the dashboard.
- Amogh has gathered feature requests from 3 journalists — Sarthak has already flagged that some of these requests may not be technically feasible as currently scoped, and said he'll revisit after improving the scraper pipeline.
- Action: get Amogh's actual consolidated list (not yet received) before committing to specific deliverables in the doc.

### 5.2 Domain + documentation (Amogh)
- Amogh requested the repo link to get a domain pointed at the project and write up documentation — already sent.

### 5.3 Integrate abcde's Streamlit dashboard scope
- Sarthak liked the data scope of a Streamlit dashboard built by a contributor referred to as "abcde" (real Discord handle unclear from context).
- abcde can't join the core team (already committed to Darshi's separate Streamlit project) but has given permission to use his work.
- Action: review abcde's Streamlit repo/scope and assess what parts of his data handling/visualization approach are worth folding into the main dashboard.

### 5.4 Antitrust/competition lawyer involvement
- A team member (JUNKDOG-K) recommended onboarding a lawyer to help package the platform's findings into properly evidenced "dossiers" and draft solid terms & conditions.
- This is directly relevant to the sanctions-matching and cartel-detection features specifically — both make claims about real, named companies, which carries real legal exposure if a match is wrong. Any public-facing sanctions/cartel claim should ideally wait for this legal review pass before being treated as "confirmed" rather than "flagged for review."

---

## 6. Code-Level Issues Found During Review/Testing

These were identified by actually cloning the repo, generating realistic test data, and running the full pipeline + API end-to-end.

### 6.1 Round-number anomaly detection is a weak signal alone
- Currently flags any contract value that's an exact multiple of ₹1 lakh as "anomalous."
- Many legitimate contracts (annual maintenance, rate-card purchases) round naturally — this produces false positives if treated as a standalone signal rather than combined with other flags (e.g. round number + single bid together is meaningful; round number alone isn't).

### 6.2 Year-over-year spike detection lacks context
- Doesn't account for inflation, or a department legitimately adding a new scheme/program that causes a genuine, non-suspicious spend increase.
- Needs to be paired with org-level context rather than flagged purely on raw total spend change.

### 6.3 Sanctions matching — exact-match path still carries false-positive risk
- The fuzzy-match path (cutoff 0.90, length-filtered, tagged "(Fuzzy)" separately) is reasonably implemented.
- The exact-match path has no such safeguard — a generic Indian business name could still collide with an unrelated global entity of the same normalized name.
- Needs either a confidence/manual-review flag on all matches (not just fuzzy ones), or a requirement for a second corroborating data point (country, registration ID) before surfacing a match as anything more than "needs verification."

### 6.4 Minor dead code
- `generate_executive_summary` recalculates `min_yr`/`max_yr` but the variables go unused — harmless, but worth cleaning up.

### 6.5 Cartel detection and live-alerts need additional input not covered in main README instructions
- Cartel detection requires `network_nodes`/`network_edges` data (CSV ingestion) — not mentioned in the main "Add Raw Data" section of the README, which only describes dropping the two `.db` files.
- Live-alerts (`build_live_alerts.py`) needs a sufficiently large sample of currently-open tenders to train against — with too little data it silently skips ("Not enough data to train ML model") with no clear guidance on the minimum data size needed.

---

## 7. Security Considerations Summary (cutting across multiple items above)

- **SQL injection risk** — explicitly flagged in the meeting notes, directly relevant to the agentic search feature (3.1). Any natural-language-to-query feature must use a constrained parameter-based layer, never raw LLM-generated SQL executed directly.
- **Unauthenticated API exposure** — the Postgres migration's API Coordinator needs a confirmed auth mechanism before going live publicly (2.5).
- **Defamation/legal exposure from sanctions and cartel matching** — both features make claims about real, named companies; false positives carry real legal risk, which is why the lawyer involvement (5.4) and the exact-match safeguard (6.3) both matter before any public claim is treated as confirmed rather than "flagged."
