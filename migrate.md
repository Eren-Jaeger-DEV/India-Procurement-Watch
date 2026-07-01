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
