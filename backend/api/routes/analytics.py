from flask import Blueprint, jsonify, request
from core.db import get_pg_conn
from core.cache import cache
from psycopg2.extras import RealDictCursor

analytics_bp = Blueprint('analytics', __name__)

@analytics_bp.route("/api/top-orgs")
def api_top_orgs():
    by      = request.args.get("by", "count")
    if by not in ("count", "value"):
        by = "count"
    dataset = request.args.get("dataset", "aoc")
    if dataset not in ("aoc", "published"):
        dataset = "aoc"
        
    try:
        limit = min(int(request.args.get("limit", 25)), 100)
    except (ValueError, TypeError):
        limit = 25

    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    if dataset == "published":
        cur.execute("SELECT org_name, count FROM top_published_orgs ORDER BY count DESC LIMIT %s", (limit,))
        rows = cur.fetchall()
        return jsonify({"labels": [r["org_name"] for r in rows],
                        "values": [r["count"] for r in rows], "metric": "count"})

    if by == "value":
        cur.execute("""
            SELECT org_name, total_value_crore, count FROM top_orgs
            WHERE total_value_crore > 0 ORDER BY total_value_crore DESC LIMIT %s
        """, (limit,))
    else:
        cur.execute("SELECT org_name, count, total_value_crore FROM top_orgs ORDER BY count DESC LIMIT %s", (limit,))

    rows = cur.fetchall()
    if by == "value":
        return jsonify({"labels": [r["org_name"] for r in rows],
                        "values": [round(r["total_value_crore"], 2) for r in rows], "metric": "₹ Crore"})
    else:
        return jsonify({"labels": [r["org_name"] for r in rows],
                        "values": [r["count"] for r in rows], "metric": "contracts"})

@analytics_bp.route("/api/tender-types")
def api_tender_types():
    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT tender_type, count, total_value_crore FROM tender_type_dist ORDER BY count DESC LIMIT 20")
    rows = cur.fetchall()
    return jsonify({"labels": [r["tender_type"] for r in rows],
                    "counts": [r["count"] for r in rows],
                    "values": [round(r["total_value_crore"] or 0, 2) for r in rows]})

@analytics_bp.route("/api/sector-distribution")
def api_sector_distribution():
    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT sector, count, total_value_crore FROM sector_distribution ORDER BY count DESC")
    rows = cur.fetchall()
    return jsonify({
        "labels": [r["sector"] for r in rows],
        "counts": [r["count"] for r in rows],
        "values": [round(r["total_value_crore"] or 0, 2) for r in rows]
    })

@analytics_bp.route("/api/portal-breakdown")
def api_portal_breakdown():
    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT portal_type, count FROM portal_breakdown ORDER BY count DESC")
    rows = cur.fetchall()
    return jsonify({"labels": [r["portal_type"] for r in rows],
                    "counts": [r["count"] for r in rows]})

@analytics_bp.route("/api/value-distribution")
def api_value_dist():
    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT bracket, count FROM value_brackets ORDER BY min_val")
    rows = cur.fetchall()
    return jsonify({"labels": [r["bracket"] for r in rows],
                    "counts": [r["count"] for r in rows]})

@analytics_bp.route("/api/single-bid-contracts")
def api_single_bid():
    page     = max(1, int(request.args.get("page", 1)))
    per_page = 20
    offset   = (page - 1) * per_page
    min_val  = float(request.args.get("min_val", 0))

    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT COUNT(*) as cnt FROM single_bid_contracts WHERE contract_value >= %s", (min_val,))
    total = cur.fetchone()["cnt"]

    cur.execute("""
        SELECT internal_id, org_name, title, contract_value,
               aoc_date, portal_type, bidder_name, ref_no
        FROM single_bid_contracts WHERE contract_value >= %s
        ORDER BY contract_value DESC LIMIT %s OFFSET %s
    """, (min_val, per_page, offset))

    return jsonify({"total": total, "page": page, "per_page": per_page,
                    "results": [dict(r) for r in cur.fetchall()]})

@analytics_bp.route("/api/repeat-winners")
def api_repeat_winners():
    page     = max(1, int(request.args.get("page", 1)))
    per_page = 20
    offset   = (page - 1) * per_page
    min_wins = int(request.args.get("min_wins", 3))

    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT COUNT(*) as cnt FROM repeat_winners WHERE wins >= %s", (min_wins,))
    total = cur.fetchone()["cnt"]

    cur.execute("""
        SELECT rank_n, bidder_name, org_name, wins, total_value_crore, first_win, last_win
        FROM repeat_winners WHERE wins >= %s
        ORDER BY wins DESC LIMIT %s OFFSET %s
    """, (min_wins, per_page, offset))

    return jsonify({"total": total, "page": page, "per_page": per_page,
                    "results": [dict(r) for r in cur.fetchall()]})

@analytics_bp.route("/api/state-stats")
def api_state_stats():
    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT state_name, total_contracts, total_value_crore FROM state_stats")
    return jsonify([dict(r) for r in cur.fetchall()])

@analytics_bp.route("/api/monthly-seasonality")
def api_monthly_seasonality():
    """Aggregate monthly_trends by month number (1-12) across all years.
    Returns count per month for the fiscal year-end clustering chart."""
    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT month, SUM(count) AS count
        FROM monthly_trends
        WHERE year BETWEEN 2011 AND 2026
        GROUP BY month ORDER BY month
    """)
    rows = cur.fetchall()
    month_names = ["Jan","Feb","Mar","Apr","May","Jun",
                   "Jul","Aug","Sep","Oct","Nov","Dec"]
    total = sum(r["count"] for r in rows) or 1
    return jsonify([{
        "month": month_names[r["month"] - 1],
        "month_num": r["month"],
        "count": r["count"],
        "pct": round(100 * r["count"] / total, 1),
        "is_year_end": r["month"] in (1, 2, 3)
    } for r in rows])

@analytics_bp.route("/api/bid-competition")
def api_bid_competition():
    """Bid competition breakdown from aoc_details: 1 bid, 2-3, 4-10, 10+."""
    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    # Use kpi_stats for single-bid count; derive others from aoc_details if available
    # Fallback: return what we have from kpi_stats
    cur.execute("SELECT key, value FROM kpi_stats WHERE key IN ('total_aoc_tenders', 'single_bid_count')")
    kpis = {r["key"]: r["value"] for r in cur.fetchall()}

    # Try to get bid distribution from aoc_details
    try:
        cur.execute("""
            SELECT
                SUM(CASE WHEN bids_received = 0 THEN 1 ELSE 0 END) AS zero_bids,
                SUM(CASE WHEN bids_received = 1 THEN 1 ELSE 0 END) AS single_bid,
                SUM(CASE WHEN bids_received BETWEEN 2 AND 3 THEN 1 ELSE 0 END) AS two_three,
                SUM(CASE WHEN bids_received BETWEEN 4 AND 10 THEN 1 ELSE 0 END) AS four_ten,
                SUM(CASE WHEN bids_received > 10 THEN 1 ELSE 0 END) AS over_ten,
                SUM(CASE WHEN bids_received IS NULL THEN 1 ELSE 0 END) AS unknown
            FROM aoc_details
            WHERE bids_received IS NOT NULL
        """)
        r = cur.fetchone()
        return jsonify({
            "labels": ["Zero bids", "1 bid (single)", "2–3 bids", "4–10 bids", "10+ bids"],
            "counts": [r["zero_bids"] or 0, r["single_bid"] or 0,
                       r["two_three"] or 0, r["four_ten"] or 0, r["over_ten"] or 0],
            "colors": ["#6b7280", "#ef4444", "#f97316", "#3b82f6", "#10b981"]
        })
    except Exception:
        conn.rollback()
        return jsonify({"labels": [], "counts": [], "colors": []})

@analytics_bp.route("/api/red-flag-explorer")
def api_red_flag_explorer():
    """Multi-filter red-flag explorer across single_bid_contracts."""
    page     = max(1, int(request.args.get("page", 1)))
    per_page = min(int(request.args.get("per_page", 25)), 100)
    offset   = (page - 1) * per_page

    year      = request.args.get("year",    "").strip()
    org_kw    = request.args.get("org",     "").strip()
    bidder_kw = request.args.get("bidder",  "").strip()
    portal    = request.args.get("portal",  "").strip()
    min_val   = request.args.get("min_value", "").strip()
    flags_raw = request.args.get("flags",   "single_bid")
    flags     = [f.strip() for f in flags_raw.split(",") if f.strip()]

    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    where_parts, params = [], []

    # Flag filters — since we are querying single_bid_contracts, single_bid is always true.
    # We can add sub-filters for repeat_win, high_value, or debarred
    if "high_value" in flags:
        where_parts.append("t.contract_value >= 100000000")   # ≥ 10 Cr
    if "repeat_win" in flags:
        where_parts.append(
            "t.bidder_name IN (SELECT bidder_name FROM repeat_winners WHERE wins >= 3)"
        )
    if "debarred" in flags:
        where_parts.append(
            "EXISTS (SELECT 1 FROM sanctioned_entities s WHERE t.bidder_name ILIKE '%' || s.name || '%' OR s.name ILIKE '%' || t.bidder_name || '%')"
        )

    if year:
        where_parts.append("EXTRACT(YEAR FROM t.aoc_date::date)::int = %s")
        params.append(int(year))
    if org_kw:
        where_parts.append("t.org_name ILIKE %s")
        params.append(f"%{org_kw}%")
    if bidder_kw:
        where_parts.append("t.bidder_name ILIKE %s")
        params.append(f"%{bidder_kw}%")
    if portal:
        where_parts.append("t.portal_type = %s")
        params.append(portal)
    if min_val:
        where_parts.append("t.contract_value >= %s")
        params.append(float(min_val))

    where_sql = "WHERE " + " AND ".join(where_parts) if where_parts else ""

    # Risk score: sum of individual flag hits (each worth 1 point, debarred worth 2 points)
    risk_expr = " + ".join([
        "1", # it's single bid
        "(CASE WHEN t.contract_value >= 100000000 THEN 1 ELSE 0 END)",
        "(CASE WHEN t.bidder_name IN (SELECT bidder_name FROM repeat_winners WHERE wins >= 3) THEN 1 ELSE 0 END)",
        "(CASE WHEN EXISTS (SELECT 1 FROM sanctioned_entities s WHERE t.bidder_name ILIKE '%' || s.name || '%' OR s.name ILIKE '%' || t.bidder_name || '%') THEN 2 ELSE 0 END)",
    ])

    try:
        cur.execute(
            f"SELECT COUNT(*) AS cnt FROM single_bid_contracts t {where_sql}",
            params
        )
        total = cur.fetchone()["cnt"]

        cur.execute(f"""
            SELECT
                t.internal_id, t.org_name, t.title, t.bidder_name,
                t.contract_value, t.aoc_date, t.portal_type, t.ref_no,
                ({risk_expr}) AS risk_score
            FROM single_bid_contracts t
            {where_sql}
            ORDER BY t.contract_value DESC NULLS LAST, t.aoc_date DESC NULLS LAST
            LIMIT %s OFFSET %s
        """, params + [per_page, offset])

        rows = [dict(r) for r in cur.fetchall()]
        # Serialize dates
        for r in rows:
            if r.get("aoc_date"):
                r["aoc_date"] = str(r["aoc_date"])

        return jsonify({"total": total, "page": page, "per_page": per_page, "results": rows})

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e), "total": 0, "results": []}), 500


@analytics_bp.route("/api/map-tenders")
@cache.cached(timeout=300, query_string=True)
def api_map_tenders():
    """Fetch geocoded points — supports bounding box viewport loading."""
    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Disable parallel queries to avoid shared memory segment resize errors (No space left on device)
        cur.execute("SET max_parallel_workers_per_gather = 0;")
        
        min_lat = request.args.get('min_lat')
        max_lat = request.args.get('max_lat')
        min_lon = request.args.get('min_lon')
        max_lon = request.args.get('max_lon')
        limit = min(int(request.args.get('limit', 5000)), 15000)

        if min_lat and max_lat and min_lon and max_lon:
            cur.execute("""
                SELECT g.internal_id, g.lat, g.lon, g.resolved_address,
                       COALESCE(s.title, t.title) AS title,
                       COALESCE(s.org_name, t.org_name) AS org_name,
                       COALESCE(s.contract_value, 0) AS contract_value,
                       COALESCE(s.bidder_name, '') AS bidder_name,
                       COALESCE(s.portal_type, t.portal_type) AS portal_type,
                       (CASE WHEN s.internal_id IS NOT NULL THEN 1 ELSE 0 END) AS is_single_bid
                FROM aoc_geocoded g
                LEFT JOIN single_bid_contracts s ON g.internal_id = s.internal_id
                LEFT JOIN aoc_tenders t ON g.internal_id = t.internal_id
                WHERE g.lat BETWEEN %s AND %s AND g.lon BETWEEN %s AND %s
                ORDER BY COALESCE(s.contract_value, 0) DESC NULLS LAST
                LIMIT %s
            """, (float(min_lat), float(max_lat), float(min_lon), float(max_lon), limit))
        else:
            cur.execute("""
                SELECT g.internal_id, g.lat, g.lon, g.resolved_address,
                       COALESCE(s.title, t.title) AS title,
                       COALESCE(s.org_name, t.org_name) AS org_name,
                       COALESCE(s.contract_value, 0) AS contract_value,
                       COALESCE(s.bidder_name, '') AS bidder_name,
                       COALESCE(s.portal_type, t.portal_type) AS portal_type,
                       (CASE WHEN s.internal_id IS NOT NULL THEN 1 ELSE 0 END) AS is_single_bid
                FROM aoc_geocoded g
                LEFT JOIN single_bid_contracts s ON g.internal_id = s.internal_id
                LEFT JOIN aoc_tenders t ON g.internal_id = t.internal_id
                ORDER BY COALESCE(s.contract_value, 0) DESC NULLS LAST
                LIMIT %s
            """, (limit,))
            
        rows = [dict(r) for r in cur.fetchall()]
        return jsonify(rows)
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500



