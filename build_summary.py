"""
build_summary.py
================
One-time pre-aggregation script for the India Procurement Analytics Dashboard.
Reads both SQLite databases (~12 GB total), computes aggregates, and writes
results to a compact summary.db (~50 MB) for fast dashboard queries.

**Includes deduplication and outlier filtering** to fix scraper noise.

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
    ("Zero / Undisclosed", -1,         0),
    ("< ₹1 Lakh",          0,          100_000),
    ("₹1L – ₹10L",         100_000,    1_000_000),
    ("₹10L – ₹1 Cr",       1_000_000,  10_000_000),
    ("₹1Cr – ₹10 Cr",      10_000_000, 100_000_000),
    ("₹10Cr – ₹100 Cr",    100_000_000,1_000_000_000),
    ("> ₹100 Cr",          1_000_000_000, float('inf')),
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
        return v if v >= 0 else None
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
    if value is None or value <= 0:
        return 0
    for i, (_, lo, hi) in enumerate(BRACKETS[1:], start=1):
        if lo < value <= hi:
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

        DROP TABLE IF EXISTS single_bid_contracts;
        CREATE TABLE single_bid_contracts (
            internal_id     TEXT,
            org_name        TEXT,
            title           TEXT,
            contract_value  REAL,
            aoc_date        TEXT,
            portal_type     TEXT,
            bidder_name     TEXT,
            ref_no          TEXT
        );

        DROP TABLE IF EXISTS repeat_winners;
        CREATE TABLE repeat_winners (
            rank_n          INTEGER,
            bidder_name     TEXT,
            org_name        TEXT,
            wins            INTEGER,
            total_value_crore REAL,
            first_win       TEXT,
            last_win        TEXT
        );

        DROP TABLE IF EXISTS org_report_cards;
        CREATE TABLE org_report_cards (
            org_name            TEXT,
            total_contracts     INTEGER,
            total_value_crore   REAL,
            single_bid_pct      REAL,
            round_number_pct    REAL,
            score               REAL,
            grade               TEXT
        );

        DROP TABLE IF EXISTS state_stats;
        CREATE TABLE state_stats (
            state_name          TEXT,
            total_contracts     INTEGER,
            total_value_crore   REAL
        );
    """)
    conn.commit()
    log("Summary DB tables created.")


# ─────────────────────────────────────────────
# PHASE 1: aoc_tenders.db — Full In-Memory Deduplication Pass
# ─────────────────────────────────────────────

def aggregate_aoc_data(aoc_conn, sum_conn):
    """
    Stream aoc_details for lookup, then stream aoc_tenders to compute
    fully deduplicated metrics in memory before writing to summary.db.
    """
    # ── Step A: Build lookup dict from aoc_details ──
    log("Phase 1a: Loading details_json lookup (this may take a while)...")
    cur = aoc_conn.cursor()
    cur.execute("SELECT internal_id, details_json FROM aoc_details")

    # internal_id → (contract_value, tender_type, ref_no, bids_count, bidder_name)
    lookup = {}
    json_errors = 0

    t0 = time.time()
    i = 0
    for row in cur:
        iid, djson = row
        cv, tt, ref, bids, bidder = None, "Unknown", "", None, ""
        if djson:
            try:
                data   = json.loads(djson)
                cv     = parse_contract_value(data.get("Contract Value"))
                tt     = (data.get("Tender Type") or "Unknown").strip() or "Unknown"
                ref    = str(data.get("Tender Ref. No.", "")).strip()
                bids_raw = data.get("Number of bids received", "")
                try:
                    bids = int(str(bids_raw).strip())
                except (ValueError, TypeError):
                    bids = None
                bidder = str(data.get("Name of the selected bidder(s)", "") or "").strip()[:200]
            except (json.JSONDecodeError, Exception):
                json_errors += 1

        lookup[iid] = (cv, tt, ref, bids, bidder)

        i += 1
        if i % 500_000 == 0:
            elapsed = time.time() - t0
            log(f"  Loaded {i:,} detail records ({elapsed:.0f}s)...")

    log(f"  ✓ Loaded {i:,} detail records.")

    # ── Step B: Stream aoc_tenders, deduplicate, and aggregate ──
    log("Phase 1b: Streaming aoc_tenders for deduplicated aggregation...")
    cur2 = aoc_conn.cursor()
    cur2.execute("""
        SELECT internal_id, org_name, year, portal_type, aoc_date, closing_date, title
        FROM aoc_tenders
    """)

    # Accumulators
    yearly        = defaultdict(lambda: {'count': 0, 'value': 0.0}) # (year, portal_type)
    monthly       = defaultdict(lambda: {'count': 0, 'value': 0.0}) # (year, month)
    org_stats     = defaultdict(lambda: {'count': 0, 'value': 0.0, 'portal': '', 'single_bid_count': 0, 'round_number_count': 0})
    state_stats   = defaultdict(lambda: {'count': 0, 'value': 0.0})
    portal_counts = defaultdict(lambda: {'count': 0, 'value': 0.0})
    type_counts   = defaultdict(lambda: {'count': 0, 'value': 0.0})
    bracket_counts= defaultdict(int)
    
    total_value   = 0.0
    valued_count  = 0
    dedup_count   = 0

    seen_sigs = set()

    anom_round    = []
    anom_quick    = []
    anom_hv_state = []

    # Repeat winner: (bidder_name, org_name) → {wins, value, first, last}
    winner_stats = defaultdict(lambda: {'wins': 0, 'value': 0.0, 'first': '', 'last': ''})
    # Single-bid accumulator (store up to 2000, filter later)
    single_bid_rows = []
    SINGLE_BID_LIMIT = 2000

    t1 = time.time()
    j = 0
    duplicates = 0
    outliers = 0

    for row in cur2:
        iid, org, year, ptype, aoc_date, closing_date, title = row
        cv, tt, ref, bids, bidder = lookup.get(iid, (None, "Unknown", "", None, ""))
        org = org or ""

        # ── DEDUPLICATION ──
        # Same org, same ref number, same award date, same value = duplicate scraper noise
        sig = (ref, org, aoc_date, cv)
        if sig in seen_sigs:
            duplicates += 1
            j += 1
            continue
        seen_sigs.add(sig)

        # ── OUTLIER TRIMMING ──
        # If contract is > ₹10,000 Crore, it's almost certainly a data entry typo.
        if cv is not None and cv > 100_000_000_000:
            cv = None
            outliers += 1

        dedup_count += 1
        ptype = ptype or "unknown"

        # Monthly & Yearly trends
        yr, mon = parse_aoc_date(aoc_date)
        if yr and mon:
            yearly[(yr, ptype)]['count'] += 1
            monthly[(yr, mon)]['count'] += 1
            if cv is not None:
                yearly[(yr, ptype)]['value'] += cv
                monthly[(yr, mon)]['value'] += cv

        # Portal & Org
        portal_counts[ptype]['count'] += 1
        org_stats[org]['count'] += 1
        if ptype and not org_stats[org]['portal']:
            org_stats[org]['portal'] = ptype
        if ptype == 'state' and org:
            state_stats[org]['count'] += 1
            if cv is not None:
                state_stats[org]['value'] += cv

        type_counts[tt]['count'] += 1
        bracket_counts[bracket_index(cv)] += 1

        if cv is not None:
            portal_counts[ptype]['value'] += cv
            org_stats[org]['value'] += cv
            type_counts[tt]['value'] += cv
            total_value += cv
            valued_count += 1

        # ── Single-bid contracts (≥ ₹10 Lakh, only 1 bidder) ──
        if bids == 1:
            org_stats[org]['single_bid_count'] += 1
            if cv and cv >= 1_000_000 and len(single_bid_rows) < SINGLE_BID_LIMIT:
                single_bid_rows.append((
                    iid, org or '', (title or '')[:200], cv,
                    aoc_date or '', ptype or '', bidder, ref
                ))

        # ── Repeat winner tracking ──
        if bidder and org:
            key = (bidder, org)
            winner_stats[key]['wins'] += 1
            if cv:
                winner_stats[key]['value'] += cv
            if aoc_date:
                if not winner_stats[key]['first'] or aoc_date < winner_stats[key]['first']:
                    winner_stats[key]['first'] = aoc_date
                if not winner_stats[key]['last'] or aoc_date > winner_stats[key]['last']:
                    winner_stats[key]['last'] = aoc_date

        # ── Anomaly: round numbers ──
        if cv and is_round_number(cv):
            org_stats[org]['round_number_count'] += 1
            if cv >= 1_000_000 and len(anom_round) < ANOMALY_LIMIT:
                anom_round.append((
                    'round_number', iid, org, (title or '')[:200], cv,
                    aoc_date or '', ptype, json.dumps({'tender_type': tt})
                ))

        # ── Anomaly: quick award ──
        if aoc_date and closing_date and len(anom_quick) < ANOMALY_LIMIT:
            d = days_between(aoc_date, closing_date)
            if d is not None and d <= 1:
                anom_quick.append((
                    'quick_award', iid, org, (title or '')[:200],
                    cv or 0, aoc_date, ptype,
                    json.dumps({'closing_date': closing_date, 'days_to_award': d})
                ))

        # ── Anomaly: high-value state contracts (> ₹10 Cr) ──
        if ptype == 'state' and cv and cv >= 100_000_000 and len(anom_hv_state) < ANOMALY_LIMIT:
            anom_hv_state.append((
                'high_value_state', iid, org, (title or '')[:200],
                cv, aoc_date, ptype,
                json.dumps({'contract_value_crore': round(cv/1e7, 2)})
            ))

        j += 1
        if j % 500_000 == 0:
            elapsed = time.time() - t1
            log(f"  Processed {j:,} raw tender records ({elapsed:.0f}s)...")

    log(f"  ✓ Processed {j:,} raw records.")
    log(f"  ✓ Filtered {duplicates:,} duplicates and trimmed {outliers:,} extreme outliers.")
    log(f"  ✓ Final unique AOC count: {dedup_count:,}")

    # ── Write to Database ──
    log("Phase 1c: Writing aggregated results to summary.db...")
    
    # Yearly
    sum_conn.executemany(
        "INSERT INTO yearly_trends(year, portal_type, count, total_value_crore) VALUES (?,?,?,?)",
        [(yr, ptype, d['count'], round(d['value']/1e7, 4)) for (yr, ptype), d in yearly.items()]
    )
    # Monthly
    sum_conn.executemany(
        "INSERT INTO monthly_trends(year, month, count, total_value_crore) VALUES (?,?,?,?)",
        [(yr, mon, d['count'], round(d['value']/1e7, 4)) for (yr, mon), d in monthly.items()]
    )
    # Portals
    sum_conn.executemany(
        "INSERT INTO portal_breakdown(portal_type, count, total_value_crore) VALUES (?,?,?)",
        [(ptype, d['count'], round(d['value']/1e7, 4)) for ptype, d in portal_counts.items()]
    )
    # Top Orgs
    sorted_orgs = sorted(org_stats.items(), key=lambda x: -x[1]['count'])[:TOP_ORGS_LIMIT]
    sum_conn.executemany(
        "INSERT INTO top_orgs(rank_n, org_name, portal_type, count, total_value_crore) VALUES (?,?,?,?,?)",
        [(i+1, org, d['portal'], d['count'], round(d['value']/1e7, 4)) for i, (org, d) in enumerate(sorted_orgs)]
    )
    # Tender Types
    sum_conn.executemany(
        "INSERT INTO tender_type_dist(tender_type, count, total_value_crore) VALUES (?,?,?)",
        [(tt, d['count'], round(d['value']/1e7, 4)) for tt, d in type_counts.items()]
    )
    # Brackets
    sum_conn.executemany(
        "INSERT INTO value_brackets(bracket, min_val, max_val, count) VALUES (?,?,?,?)",
        [(BRACKETS[i][0], BRACKETS[i][1], BRACKETS[i][2], bracket_counts[i]) for i in range(len(BRACKETS))]
    )
    # Anomalies
    sum_conn.executemany(
        "INSERT INTO anomalies(anom_type, internal_id, org_name, title, contract_value, aoc_date, portal_type, extra_info) VALUES (?,?,?,?,?,?,?,?)",
        anom_round + anom_quick + anom_hv_state
    )

    # Single-bid contracts — sort by value descending
    single_bid_rows.sort(key=lambda x: -(x[3] or 0))
    sum_conn.executemany(
        "INSERT INTO single_bid_contracts(internal_id, org_name, title, contract_value, aoc_date, portal_type, bidder_name, ref_no) VALUES (?,?,?,?,?,?,?,?)",
        single_bid_rows
    )
    log(f"  OK Stored {len(single_bid_rows):,} single-bid contracts.")

    # Repeat winners — filter to those with >= 3 wins, sort by wins desc
    rw_rows = [
        (bidder, org, stats['wins'], round(stats['value']/1e7, 4), stats['first'], stats['last'])
        for (bidder, org), stats in winner_stats.items()
        if stats['wins'] >= 3
    ]
    rw_rows.sort(key=lambda x: -x[2])  # sort by wins desc
    rw_rows = [(i+1,) + r for i, r in enumerate(rw_rows[:2000])]
    sum_conn.executemany(
        "INSERT INTO repeat_winners(rank_n, bidder_name, org_name, wins, total_value_crore, first_win, last_win) VALUES (?,?,?,?,?,?,?)",
        rw_rows
    )
    log(f"  OK Stored {len(rw_rows):,} repeat winners (>= 3 wins from same org).")

    # ── Report Cards ──
    rc_rows = []
    for o, stats in org_stats.items():
        if stats['count'] < 10:  # Minimum 10 contracts to be graded
            continue
        s_pct = (stats['single_bid_count'] / stats['count']) * 100
        r_pct = (stats['round_number_count'] / stats['count']) * 100
        
        # Risk Score (0-100 where 100 is max risk)
        raw_risk = min(100.0, (s_pct * 0.7) + (r_pct * 0.3))
        
        if raw_risk < 5: grade = 'A'
        elif raw_risk < 15: grade = 'B'
        elif raw_risk < 25: grade = 'C'
        elif raw_risk < 40: grade = 'D'
        else: grade = 'F'
        
        score = round(100 - raw_risk, 1) # 100 is best, 0 is worst
        rc_rows.append((
            o, stats['count'], round(stats['value']/1e7, 4),
            round(s_pct, 1), round(r_pct, 1), score, grade
        ))
    sum_conn.executemany(
        "INSERT INTO org_report_cards(org_name, total_contracts, total_value_crore, single_bid_pct, round_number_pct, score, grade) VALUES (?,?,?,?,?,?,?)",
        rc_rows
    )
    log(f"  OK Generated {len(rc_rows):,} department report cards.")

    # ── State Stats ──
    sum_conn.executemany(
        "INSERT INTO state_stats(state_name, total_contracts, total_value_crore) VALUES (?,?,?)",
        [(st, d['count'], round(d['value']/1e7, 4)) for st, d in state_stats.items()]
    )
    log(f"  OK Generated stats for {len(state_stats)} states.")

    sum_conn.commit()

    return dedup_count, total_value, valued_count


# ─────────────────────────────────────────────
# PHASE 2: tenders_vps.db
# ─────────────────────────────────────────────

def aggregate_vps(vps_conn, sum_conn):
    log("Phase 2a: tenders status breakdown...")
    cur = vps_conn.cursor()

    # Check what columns exist in the tenders table
    cur.execute("PRAGMA table_info(tenders)")
    cols = {row[1] for row in cur.fetchall()}
    log(f"  VPS tenders columns: {cols}")

    # Status breakdown (only if status column exists)
    if 'status' in cols:
        cur.execute("SELECT status, COUNT(*) FROM tenders GROUP BY status")
        status_rows = cur.fetchall()
        sum_conn.executemany(
            "INSERT INTO tenders_status(status, count) VALUES (?,?)",
            status_rows
        )
    else:
        log("  (no 'status' column — skipping status breakdown)")

    log("Phase 2b: Top published orgs...")
    # Detect org name column
    org_col = None
    for candidate in ['organisation_name', 'org_name', 'organization_name']:
        if candidate in cols:
            org_col = candidate
            break

    if org_col:
        cur.execute(f"""
            SELECT {org_col}, COUNT(*) as cnt
            FROM tenders
            WHERE {org_col} IS NOT NULL AND {org_col} != ''
            GROUP BY {org_col}
            ORDER BY cnt DESC
            LIMIT 100
        """)
        pub_org_rows = [(i+1, r[0], r[1]) for i, r in enumerate(cur.fetchall())]
        sum_conn.executemany(
            "INSERT INTO top_published_orgs(rank_n, org_name, count) VALUES (?,?,?)",
            pub_org_rows
        )
    else:
        log("  (no recognised org name column in tenders table — skipping top orgs)")

    log("Phase 2c: Monthly published tenders...")
    # Detect date column
    date_col = None
    for candidate in ['e_published_date', 'published_date', 'pub_date', 'date']:
        if candidate in cols:
            date_col = candidate
            break

    if date_col:
        cur.execute(f"SELECT {date_col} FROM tenders WHERE {date_col} IS NOT NULL")
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
    else:
        log("  (no recognised date column — skipping monthly published)")

    sum_conn.commit()

    cur.execute("SELECT COUNT(*) FROM tenders")
    total_pub = cur.fetchone()[0]
    log(f"  OK Phase 2 complete. Total published tenders: {total_pub:,}")
    return total_pub



# ─────────────────────────────────────────────
# PHASE 3: Write KPI stats
# ─────────────────────────────────────────────

def write_kpi_stats(sum_conn, dedup_count, total_value, valued_count, total_pub):
    log("Phase 3: Writing KPI stats...")
    
    cur = sum_conn.cursor()
    cur.execute("SELECT COUNT(DISTINCT org_name) FROM top_orgs")
    unique_orgs = cur.fetchone()[0] # This is just top 100 now, which is wrong. 
    # Let's count unique orgs directly from raw if we want accuracy. But actually we can just use len(org_stats)

    kpi_data = [
        ("total_aoc_tenders",       str(dedup_count)),
        ("total_contracts_valued",  str(valued_count)),
        ("total_value_crore",       str(round(total_value / 1e7, 2))),
        ("avg_value_crore",         str(round(total_value / max(valued_count, 1) / 1e7, 4))),
        # "unique_aoc_orgs" is handled below
        ("total_published_tenders", str(total_pub)),
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

    # Remove old summary DB with retry for lock conflicts on Windows
    if os.path.exists(SUM_DB):
        log(f"Removing old {SUM_DB}...")
        for attempt in range(5):
            try:
                os.remove(SUM_DB)
                break
            except PermissionError:
                if attempt == 4:
                    log("  WARN: summary.db locked by another process. Clearing tables instead of deleting...")
                    try:
                        temp_conn = sqlite3.connect(SUM_DB)
                        cur = temp_conn.cursor()
                        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
                        for table in [r[0] for r in cur.fetchall()]:
                            if not table.startswith("sqlite_"):
                                cur.execute(f"DROP TABLE IF EXISTS [{table}]")
                        temp_conn.commit()
                        temp_conn.close()
                        break
                    except Exception as e:
                        print(f"ERROR: Cannot clear summary.db: {e}", file=sys.stderr)
                        raise
                time.sleep(0.5)

    log("Opening databases...")
    aoc_conn = sqlite3.connect(f"file:{AOC_DB}?mode=ro", uri=True)
    vps_conn = sqlite3.connect(f"file:{VPS_DB}?mode=ro", uri=True)
    aoc_conn.row_factory = None  # raw tuple mode for speed

    sum_conn = sqlite3.connect(SUM_DB)
    sum_conn.execute("PRAGMA journal_mode=WAL")
    sum_conn.execute("PRAGMA synchronous=NORMAL")

    create_summary_db(sum_conn)
    dedup_count, total_value, valued_count = aggregate_aoc_data(aoc_conn, sum_conn)
    
    # We need unique orgs count, easiest to just query raw DB since we didn't track it
    cur = aoc_conn.cursor()
    cur.execute("SELECT COUNT(DISTINCT org_name) FROM aoc_tenders WHERE org_name != ''")
    unique_orgs = cur.fetchone()[0]
    sum_conn.execute("INSERT INTO kpi_stats(key, value) VALUES ('unique_aoc_orgs', ?)", (str(unique_orgs),))

    cur.execute("SELECT MIN(year), MAX(year) FROM aoc_tenders WHERE year BETWEEN 2010 AND 2030")
    min_yr, max_yr = cur.fetchone()
    sum_conn.execute("INSERT INTO kpi_stats(key, value) VALUES ('min_year', ?)", (str(min_yr or ''),))
    sum_conn.execute("INSERT INTO kpi_stats(key, value) VALUES ('max_year', ?)", (str(max_yr or ''),))
    sum_conn.commit()
    
    total_pub = aggregate_vps(vps_conn, sum_conn)
    write_kpi_stats(sum_conn, dedup_count, total_value, valued_count, total_pub)

    # Ingest company-director network files if present
    import csv
    nodes_path = os.path.join(BASE_DIR, "data_dump", "nodes.csv")
    edges_path = os.path.join(BASE_DIR, "data_dump", "edges.csv")
    if not os.path.exists(nodes_path) or not os.path.exists(edges_path):
        nodes_path = os.path.join(BASE_DIR, "nodes.csv")
        edges_path = os.path.join(BASE_DIR, "edges.csv")

    if os.path.exists(nodes_path) and os.path.exists(edges_path):
        log("Phase 4: Ingesting company-director network tables...")
        sum_cur = sum_conn.cursor()
        sum_cur.execute("DROP TABLE IF EXISTS network_nodes")
        sum_cur.execute("""
            CREATE TABLE network_nodes (
                id TEXT PRIMARY KEY,
                label TEXT,
                kind TEXT,
                state TEXT,
                email TEXT,
                value REAL,
                n_contracts INTEGER,
                n_buyers INTEGER
            )
        """)
        
        with open(nodes_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader, None)
            rows = []
            for r in reader:
                if not r: continue
                while len(r) < 8: r.append(None)
                rows.append((r[0], r[1], r[2], r[3], r[4], 
                             float(r[5]) if r[5] else None, 
                             int(r[6]) if r[6] else None, 
                             int(r[7]) if r[7] else None))
            sum_cur.executemany("INSERT OR REPLACE INTO network_nodes VALUES (?,?,?,?,?,?,?,?)", rows)
        
        sum_cur.execute("DROP TABLE IF EXISTS network_edges")
        sum_cur.execute("""
            CREATE TABLE network_edges (
                source TEXT,
                target TEXT,
                relationship TEXT,
                weight REAL,
                total_value REAL,
                label TEXT
            )
        """)
        
        with open(edges_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader, None)
            rows = []
            for r in reader:
                if not r: continue
                while len(r) < 6: r.append(None)
                rows.append((r[0], r[1], r[2], 
                             float(r[3]) if r[3] else None, 
                             float(r[4]) if r[4] else None, 
                             r[5]))
            sum_cur.executemany("INSERT INTO network_edges VALUES (?,?,?,?,?,?)", rows)
        
        sum_conn.commit()
        sum_cur.execute("CREATE INDEX IF NOT EXISTS idx_net_nodes_kind ON network_nodes(kind)")
        sum_cur.execute("CREATE INDEX IF NOT EXISTS idx_net_edges_src ON network_edges(source)")
        sum_cur.execute("CREATE INDEX IF NOT EXISTS idx_net_edges_dst ON network_edges(target)")
        sum_conn.commit()
        log(f"  ✓ Ingested network nodes and edges successfully.")
        
        # Add KPI metadata for network status
        sum_cur.execute("INSERT OR REPLACE INTO kpi_stats(key, value) VALUES ('has_network_data', 'true')")
        sum_conn.commit()
    else:
        log("Phase 4: Skipping network ingestion (nodes.csv / edges.csv not found)")
        sum_cur = sum_conn.cursor()
        sum_cur.execute("INSERT OR REPLACE INTO kpi_stats(key, value) VALUES ('has_network_data', 'false')")
        sum_conn.commit()

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
