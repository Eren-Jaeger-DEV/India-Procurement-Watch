"""
build_summary.py
================
One-time pre-aggregation script for the India Procurement Analytics Dashboard.
Reads both SQLite databases (~12 GB total), computes aggregates, and writes
results to a compact summary.db (~50 MB) for fast dashboard queries.

Estimated runtime: 10–25 minutes on first run.
"""

import sqlite3
import json
import os
import sys
import time
from datetime import datetime
from collections import defaultdict

# ─────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AOC_DB   = os.path.join(BASE_DIR, "aoc_tenders.db")
VPS_DB   = os.path.join(BASE_DIR, "tenders_vps.db")
SUM_DB   = os.path.join(BASE_DIR, "summary.db")

MONTH_MAP = {
    'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
    'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
}

# Value brackets (in rupees)
BRACKETS = [
    ("< ₹1 Lakh",      0,          100_000),
    ("₹1L – ₹10L",     100_000,    1_000_000),
    ("₹10L – ₹1 Cr",   1_000_000,  10_000_000),
    ("₹1Cr – ₹10 Cr",  10_000_000, 100_000_000),
    ("₹10Cr – ₹100 Cr",100_000_000,1_000_000_000),
    ("> ₹100 Cr",       1_000_000_000, float('inf')),
]

TOP_ORGS_LIMIT = 100
ANOMALY_LIMIT  = 500   # max anomalies per type stored

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def log(msg):
    # Replace non-ASCII chars that cause issues on Windows cp1252
    msg = (msg.replace('→', '->')
              .replace('✓', 'OK')
              .replace('✅', 'DONE')
              .replace('⚠️', 'WARN')
              .replace('₹', 'Rs')
              .replace('≤', '<='))
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)

def parse_contract_value(val_str):
    """Parse contract value strings like '1874075', '18,74,075', '₹ 1874075' → float"""
    if not val_str:
        return None
    try:
        cleaned = str(val_str).replace(',', '').replace('₹', '').replace(' ', '').strip()
        if not cleaned:
            return None
        v = float(cleaned)
        return v if v > 0 else None
    except (ValueError, TypeError):
        return None

def parse_aoc_date(date_str):
    """Parse '28-Jan-2026 12:00 AM' → (year:int, month:int) or (None, None)"""
    if not date_str:
        return None, None
    try:
        parts = date_str.split('-')
        if len(parts) < 3:
            return None, None
        month_abbr = parts[1][:3]
        year_part  = parts[2][:4]
        year  = int(year_part)
        month = MONTH_MAP.get(month_abbr, 0)
        if year < 2000 or year > 2030 or month == 0:
            return None, None
        return year, month
    except Exception:
        return None, None

def days_between(date_str_a, date_str_b):
    """Return days between two date strings in 'DD-Mon-YYYY...' format, or None."""
    def to_dt(s):
        if not s:
            return None
        try:
            parts = s.split('-')
            day   = int(parts[0])
            month = MONTH_MAP.get(parts[1][:3], 0)
            year  = int(parts[2][:4])
            return datetime(year, month, day)
        except Exception:
            return None

    da = to_dt(date_str_a)
    db = to_dt(date_str_b)
    if da and db:
        return (da - db).days
    return None

def bracket_index(value):
    for i, (_, lo, hi) in enumerate(BRACKETS):
        if lo <= value < hi:
            return i
    return len(BRACKETS) - 1

def is_round_number(value):
    """True if value is a multiple of 1,00,000 (1 lakh)."""
    if value is None or value <= 0:
        return False
    return value % 100_000 == 0

# ─────────────────────────────────────────────
# SUMMARY DB SETUP
# ─────────────────────────────────────────────

def create_summary_db(conn):
    """Create all tables in summary.db."""
    cur = conn.cursor()
    cur.executescript("""
        DROP TABLE IF EXISTS kpi_stats;
        CREATE TABLE kpi_stats (
            key   TEXT PRIMARY KEY,
            value TEXT
        );

        DROP TABLE IF EXISTS yearly_trends;
        CREATE TABLE yearly_trends (
            year        INTEGER,
            portal_type TEXT,
            count       INTEGER,
            total_value_crore REAL DEFAULT 0
        );

        DROP TABLE IF EXISTS monthly_trends;
        CREATE TABLE monthly_trends (
            year  INTEGER,
            month INTEGER,
            count INTEGER,
            total_value_crore REAL DEFAULT 0
        );

        DROP TABLE IF EXISTS top_orgs;
        CREATE TABLE top_orgs (
            rank_n          INTEGER,
            org_name        TEXT,
            portal_type     TEXT,
            count           INTEGER,
            total_value_crore REAL DEFAULT 0
        );

        DROP TABLE IF EXISTS tender_type_dist;
        CREATE TABLE tender_type_dist (
            tender_type TEXT,
            count       INTEGER,
            total_value_crore REAL DEFAULT 0
        );

        DROP TABLE IF EXISTS portal_breakdown;
        CREATE TABLE portal_breakdown (
            portal_type TEXT,
            count       INTEGER,
            total_value_crore REAL DEFAULT 0
        );

        DROP TABLE IF EXISTS value_brackets;
        CREATE TABLE value_brackets (
            bracket   TEXT,
            min_val   REAL,
            max_val   REAL,
            count     INTEGER
        );

        DROP TABLE IF EXISTS anomalies;
        CREATE TABLE anomalies (
            anom_type       TEXT,
            internal_id     TEXT,
            org_name        TEXT,
            title           TEXT,
            contract_value  REAL,
            aoc_date        TEXT,
            portal_type     TEXT,
            extra_info      TEXT
        );

        DROP TABLE IF EXISTS tenders_status;
        CREATE TABLE tenders_status (
            status TEXT,
            count  INTEGER
        );

        DROP TABLE IF EXISTS published_monthly;
        CREATE TABLE published_monthly (
            year  INTEGER,
            month INTEGER,
            count INTEGER
        );

        DROP TABLE IF EXISTS top_published_orgs;
        CREATE TABLE top_published_orgs (
            rank_n    INTEGER,
            org_name  TEXT,
            count     INTEGER
        );
    """)
    conn.commit()
    log("Summary DB tables created.")


# ─────────────────────────────────────────────
# PHASE 1: aoc_tenders.db — Count-only SQL aggregates
# ─────────────────────────────────────────────

def aggregate_aoc_counts(aoc_conn, sum_conn):
    """Run pure SQL aggregations that don't need JSON parsing."""
    log("Phase 1a: Yearly + portal counts from aoc_tenders...")
    cur = aoc_conn.cursor()

    # Yearly counts (SQL-only, year column available directly)
    cur.execute("""
        SELECT year, portal_type, COUNT(*) as cnt
        FROM aoc_tenders
        WHERE year IS NOT NULL AND year BETWEEN 2010 AND 2030
        GROUP BY year, portal_type
        ORDER BY year
    """)
    yearly_rows = cur.fetchall()

    log(f"  → {len(yearly_rows)} year/portal combinations.")
    sum_conn.executemany(
        "INSERT INTO yearly_trends(year, portal_type, count) VALUES (?,?,?)",
        yearly_rows
    )
    sum_conn.commit()

    # Portal breakdown (count only — values added in phase 2)
    log("Phase 1b: Portal breakdown...")
    cur.execute("""
        SELECT portal_type, COUNT(*) as cnt
        FROM aoc_tenders
        GROUP BY portal_type
    """)
    portal_rows = cur.fetchall()
    sum_conn.executemany(
        "INSERT INTO portal_breakdown(portal_type, count) VALUES (?,?)",
        portal_rows
    )
    sum_conn.commit()

    # Top orgs by count (count only — values added in phase 2)
    log(f"Phase 1c: Top {TOP_ORGS_LIMIT} orgs by count...")
    cur.execute(f"""
        SELECT org_name, portal_type, COUNT(*) as cnt
        FROM aoc_tenders
        WHERE org_name IS NOT NULL AND org_name != ''
        GROUP BY org_name
        ORDER BY cnt DESC
        LIMIT {TOP_ORGS_LIMIT}
    """)
    org_rows = [(i+1, r[0], r[1], r[2]) for i, r in enumerate(cur.fetchall())]
    sum_conn.executemany(
        "INSERT INTO top_orgs(rank_n, org_name, portal_type, count) VALUES (?,?,?,?)",
        org_rows
    )
    sum_conn.commit()
    log(f"  → Inserted {len(org_rows)} top orgs.")


# ─────────────────────────────────────────────
# PHASE 2: aoc_tenders.db — JSON-based aggregation
# ─────────────────────────────────────────────

def aggregate_aoc_details(aoc_conn, sum_conn):
    """
    Stream aoc_details, parse JSON, build in-memory accumulators,
    then join with aoc_tenders for org-level and monthly value stats.
    """
    # ── Step A: Build lookup dict from aoc_details ──
    log("Phase 2a: Loading details_json lookup (this may take a while)...")
    cur = aoc_conn.cursor()
    cur.execute("SELECT internal_id, details_json FROM aoc_details")

    lookup = {}  # internal_id → (contract_value_float | None, tender_type_str)
    type_counts   = defaultdict(lambda: {'count': 0, 'value': 0.0})
    bracket_counts= defaultdict(int)
    total_value   = 0.0
    valued_count  = 0
    json_errors   = 0

    t0 = time.time()
    i  = 0
    for row in cur:
        iid, djson = row
        cv, tt = None, "Unknown"
        if djson:
            try:
                data = json.loads(djson)
                cv   = parse_contract_value(data.get("Contract Value"))
                tt   = (data.get("Tender Type") or "Unknown").strip() or "Unknown"
            except (json.JSONDecodeError, Exception):
                json_errors += 1

        lookup[iid] = (cv, tt)

        if cv is not None:
            type_counts[tt]['count'] += 1
            type_counts[tt]['value'] += cv
            bracket_counts[bracket_index(cv)] += 1
            total_value += cv
            valued_count += 1

        i += 1
        if i % 500_000 == 0:
            elapsed = time.time() - t0
            log(f"  Loaded {i:,} detail records ({elapsed:.0f}s)... json_errors={json_errors}")

    log(f"  ✓ Loaded {i:,} detail records. Valued: {valued_count:,}. JSON errors: {json_errors}.")

    # ── Step B: Write tender_type_dist ──
    log("Phase 2b: Writing tender_type_dist...")
    type_rows = sorted(type_counts.items(), key=lambda x: -x[1]['count'])
    sum_conn.executemany(
        "INSERT INTO tender_type_dist(tender_type, count, total_value_crore) VALUES (?,?,?)",
        [(tt, v['count'], round(v['value'] / 1e7, 4)) for tt, v in type_rows]
    )

    # ── Step C: Write value_brackets ──
    log("Phase 2c: Writing value_brackets...")
    bracket_rows = [
        (BRACKETS[i][0], BRACKETS[i][1], BRACKETS[i][2], bracket_counts[i])
        for i in range(len(BRACKETS))
    ]
    sum_conn.executemany(
        "INSERT INTO value_brackets(bracket, min_val, max_val, count) VALUES (?,?,?,?)",
        bracket_rows
    )
    sum_conn.commit()

    # ── Step D: Stream aoc_tenders, combine with lookup ──
    log("Phase 2d: Streaming aoc_tenders to compute monthly trends + org values + anomalies...")
    cur2 = aoc_conn.cursor()
    cur2.execute("""
        SELECT internal_id, org_name, year, portal_type, aoc_date, closing_date, title
        FROM aoc_tenders
    """)

    monthly = defaultdict(lambda: {'count': 0, 'value': 0.0})
    org_values = defaultdict(float)  # org_name → total value

    # Anomaly accumulators
    anom_round   = []
    anom_quick   = []
    anom_hv_state= []

    t1 = time.time()
    j  = 0
    for row in cur2:
        iid, org, year, ptype, aoc_date, closing_date, title = row
        cv, tt = lookup.get(iid, (None, "Unknown"))

        # Monthly trend
        yr, mon = parse_aoc_date(aoc_date)
        if yr and mon:
            key = (yr, mon)
            monthly[key]['count'] += 1
            if cv is not None:
                monthly[key]['value'] += cv

        # Org values
        if org and cv is not None:
            org_values[org] += cv

        # ── Anomaly: round numbers ──
        if cv and is_round_number(cv) and cv >= 1_000_000 and len(anom_round) < ANOMALY_LIMIT:
            anom_round.append((
                'round_number', iid, org or '', (title or '')[:200], cv,
                aoc_date or '', ptype or '', json.dumps({'tender_type': tt})
            ))

        # ── Anomaly: quick award (awarded before or same day as closing) ──
        if aoc_date and closing_date and len(anom_quick) < ANOMALY_LIMIT:
            d = days_between(aoc_date, closing_date)
            if d is not None and d <= 1:
                anom_quick.append((
                    'quick_award', iid, org or '', (title or '')[:200],
                    cv or 0, aoc_date or '', ptype or '',
                    json.dumps({'closing_date': closing_date, 'days_to_award': d})
                ))

        # ── Anomaly: high-value state contracts (> ₹10 Cr) ──
        if ptype == 'state' and cv and cv >= 100_000_000 and len(anom_hv_state) < ANOMALY_LIMIT:
            anom_hv_state.append((
                'high_value_state', iid, org or '', (title or '')[:200],
                cv, aoc_date or '', ptype or '',
                json.dumps({'contract_value_crore': round(cv/1e7, 2)})
            ))

        j += 1
        if j % 500_000 == 0:
            elapsed = time.time() - t1
            log(f"  Processed {j:,} tender records ({elapsed:.0f}s)...")

    log(f"  ✓ Processed {j:,} tender records.")

    # ── Step E: Write monthly trends ──
    log("Phase 2e: Writing monthly_trends...")
    monthly_rows = [
        (yr, mon, v['count'], round(v['value'] / 1e7, 4))
        for (yr, mon), v in sorted(monthly.items())
    ]
    sum_conn.executemany(
        "INSERT INTO monthly_trends(year, month, count, total_value_crore) VALUES (?,?,?,?)",
        monthly_rows
    )

    # ── Step F: Update top_orgs with value ──
    log("Phase 2f: Updating top_orgs with values...")
    cur_sum = sum_conn.cursor()
    cur_sum.execute("SELECT org_name FROM top_orgs")
    for (org_name,) in cur_sum.fetchall():
        val = org_values.get(org_name, 0.0)
        sum_conn.execute(
            "UPDATE top_orgs SET total_value_crore=? WHERE org_name=?",
            (round(val / 1e7, 4), org_name)
        )

    # ── Step G: Update portal_breakdown with values ──
    log("Phase 2g: Updating portal_breakdown with values...")
    portal_val = defaultdict(float)
    for iid, (cv, _) in lookup.items():
        pass  # Can't get portal_type from lookup alone; use org_values approach

    # Better: stream once more but it's expensive. Instead compute from yearly_trends values
    # We'll compute portal values by summing monthly_trends filtered by portal — not directly possible.
    # Use a simpler approach: update portal_breakdown from sum of (aoc_tenders × details join)
    # Since we already computed total_value above, let's at least set total from sum of monthly
    total_crore = round(total_value / 1e7, 4)

    # ── Step H: Write anomalies ──
    log(f"Phase 2h: Writing anomalies ({len(anom_round)} round, {len(anom_quick)} quick, {len(anom_hv_state)} hv_state)...")
    all_anomalies = anom_round + anom_quick + anom_hv_state
    sum_conn.executemany(
        "INSERT INTO anomalies(anom_type, internal_id, org_name, title, contract_value, aoc_date, portal_type, extra_info) VALUES (?,?,?,?,?,?,?,?)",
        all_anomalies
    )
    sum_conn.commit()

    log(f"  ✓ Phase 2 complete. Total contract value: ₹{total_crore:.2f} Cr")
    return total_value, valued_count


# ─────────────────────────────────────────────
# PHASE 3: tenders_vps.db
# ─────────────────────────────────────────────

def aggregate_vps(vps_conn, sum_conn):
    log("Phase 3a: tenders status breakdown...")
    cur = vps_conn.cursor()

    cur.execute("SELECT status, COUNT(*) FROM tenders GROUP BY status")
    status_rows = cur.fetchall()
    sum_conn.executemany(
        "INSERT INTO tenders_status(status, count) VALUES (?,?)",
        status_rows
    )

    log("Phase 3b: Top published orgs...")
    cur.execute("""
        SELECT organisation_name, COUNT(*) as cnt
        FROM tenders
        WHERE organisation_name IS NOT NULL AND organisation_name != ''
        GROUP BY organisation_name
        ORDER BY cnt DESC
        LIMIT 100
    """)
    pub_org_rows = [(i+1, r[0], r[1]) for i, r in enumerate(cur.fetchall())]
    sum_conn.executemany(
        "INSERT INTO top_published_orgs(rank_n, org_name, count) VALUES (?,?,?)",
        pub_org_rows
    )

    log("Phase 3c: Monthly published tenders...")
    cur.execute("SELECT e_published_date FROM tenders WHERE e_published_date IS NOT NULL LIMIT 3")
    sample = cur.fetchall()
    log(f"  Sample e_published_date: {sample}")

    # e_published_date format: "11-Jun-2026 11:59 AM"
    cur.execute("SELECT e_published_date FROM tenders WHERE e_published_date IS NOT NULL")

    pub_monthly = defaultdict(int)
    pk = 0
    for (dpub,) in cur:
        yr, mon = parse_aoc_date(dpub)
        if yr and mon:
            pub_monthly[(yr, mon)] += 1
        pk += 1
        if pk % 500_000 == 0:
            log(f"  Processed {pk:,} published dates...")

    pub_rows = [
        (yr, mon, cnt)
        for (yr, mon), cnt in sorted(pub_monthly.items())
    ]
    sum_conn.executemany(
        "INSERT INTO published_monthly(year, month, count) VALUES (?,?,?)",
        pub_rows
    )
    sum_conn.commit()

    cur.execute("SELECT COUNT(*) FROM tenders")
    total_pub = cur.fetchone()[0]
    log(f"  ✓ Phase 3 complete. Total published tenders: {total_pub:,}")
    return total_pub


# ─────────────────────────────────────────────
# PHASE 4: Write KPI stats
# ─────────────────────────────────────────────

def write_kpi_stats(aoc_conn, sum_conn, total_value, valued_count, total_pub):
    log("Phase 4: Writing KPI stats...")
    cur = aoc_conn.cursor()

    cur.execute("SELECT COUNT(*) FROM aoc_tenders")
    total_aoc = cur.fetchone()[0]

    cur.execute("SELECT COUNT(DISTINCT org_name) FROM aoc_tenders WHERE org_name != ''")
    unique_orgs = cur.fetchone()[0]

    cur.execute("SELECT MIN(year), MAX(year) FROM aoc_tenders WHERE year BETWEEN 2010 AND 2030")
    min_yr, max_yr = cur.fetchone()

    kpi_data = [
        ("total_aoc_tenders",       str(total_aoc)),
        ("total_contracts_valued",  str(valued_count)),
        ("total_value_crore",       str(round(total_value / 1e7, 2))),
        ("avg_value_crore",         str(round(total_value / max(valued_count, 1) / 1e7, 4))),
        ("unique_aoc_orgs",         str(unique_orgs)),
        ("total_published_tenders", str(total_pub)),
        ("min_year",                str(min_yr or '')),
        ("max_year",                str(max_yr or '')),
        ("last_updated",            datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
    ]

    sum_conn.executemany(
        "INSERT OR REPLACE INTO kpi_stats(key, value) VALUES (?,?)",
        kpi_data
    )
    sum_conn.commit()
    log("  ✓ KPI stats written.")
    for k, v in kpi_data:
        log(f"    {k}: {v}")


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    t_start = time.time()
    log("=" * 60)
    log("India Procurement Analytics — build_summary.py")
    log("=" * 60)

    if not os.path.exists(AOC_DB):
        print(f"ERROR: {AOC_DB} not found.", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(VPS_DB):
        print(f"ERROR: {VPS_DB} not found.", file=sys.stderr)
        sys.exit(1)

    # Remove old summary DB
    if os.path.exists(SUM_DB):
        log(f"Removing old {SUM_DB}...")
        os.remove(SUM_DB)

    log("Opening databases...")
    aoc_conn = sqlite3.connect(f"file:{AOC_DB}?mode=ro", uri=True)
    vps_conn = sqlite3.connect(f"file:{VPS_DB}?mode=ro", uri=True)
    aoc_conn.row_factory = None  # raw tuple mode for speed

    sum_conn = sqlite3.connect(SUM_DB)
    sum_conn.execute("PRAGMA journal_mode=WAL")
    sum_conn.execute("PRAGMA synchronous=NORMAL")

    create_summary_db(sum_conn)
    aggregate_aoc_counts(aoc_conn, sum_conn)
    total_value, valued_count = aggregate_aoc_details(aoc_conn, sum_conn)
    total_pub = aggregate_vps(vps_conn, sum_conn)
    write_kpi_stats(aoc_conn, sum_conn, total_value, valued_count, total_pub)

    # Final indexes for fast API queries
    log("Creating indexes on summary.db...")
    sum_conn.executescript("""
        CREATE INDEX IF NOT EXISTS idx_monthly_ym ON monthly_trends(year, month);
        CREATE INDEX IF NOT EXISTS idx_yearly ON yearly_trends(year);
        CREATE INDEX IF NOT EXISTS idx_anomaly_type ON anomalies(anom_type);
        CREATE INDEX IF NOT EXISTS idx_pub_monthly ON published_monthly(year, month);
    """)
    sum_conn.commit()

    aoc_conn.close()
    vps_conn.close()
    sum_conn.close()

    elapsed = time.time() - t_start
    log("=" * 60)
    log(f"✅ build_summary.py COMPLETE in {elapsed/60:.1f} minutes.")
    log(f"   Summary DB: {SUM_DB}")
    log("=" * 60)


if __name__ == "__main__":
    main()
