from flask import Blueprint, jsonify, request
from core.db import get_pg_conn
from core.cache import cache
from psycopg2.extras import RealDictCursor

insights_bp = Blueprint('insights', __name__)


@insights_bp.route("/api/hhi-scatter")
@cache.cached(timeout=900)
def api_hhi_scatter():
    """
    Compute Herfindahl-Hirschman Index per organization from aoc_tenders.
    Only considers orgs with >= 30 awards that have an identified bidder.
    Returns: org_name, hhi (0-10000), n_vendors, total_awards, single_bid_pct, portal_type
    """
    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        WITH org_vendor_counts AS (
            SELECT
                org_name,
                portal_type,
                bidder_name,
                COUNT(*) AS wins
            FROM aoc_tenders
            WHERE bidder_name IS NOT NULL
              AND bidder_name <> ''
              AND org_name IS NOT NULL
            GROUP BY org_name, portal_type, bidder_name
        ),
        org_totals AS (
            SELECT org_name, SUM(wins) AS total_with_bidder
            FROM org_vendor_counts
            GROUP BY org_name
            HAVING SUM(wins) >= 30
        ),
        hhi_calc AS (
            SELECT
                ovc.org_name,
                ovc.portal_type,
                ot.total_with_bidder,
                COUNT(DISTINCT ovc.bidder_name) AS n_vendors,
                ROUND(
                    SUM(
                        POWER(
                            100.0 * ovc.wins / NULLIF(ot.total_with_bidder, 0),
                            2
                        )
                    )::numeric,
                0) AS hhi
            FROM org_vendor_counts ovc
            JOIN org_totals ot ON ot.org_name = ovc.org_name
            GROUP BY ovc.org_name, ovc.portal_type, ot.total_with_bidder
        ),
        single_bid_stats AS (
            SELECT org_name, COUNT(*) AS n_single_bid
            FROM single_bid_contracts
            GROUP BY org_name
        ),
        full_org_counts AS (
            SELECT org_name, COUNT(*) AS total_awards
            FROM aoc_tenders
            GROUP BY org_name
        )
        SELECT
            h.org_name,
            h.portal_type,
            h.hhi,
            h.n_vendors,
            h.total_with_bidder,
            foc.total_awards,
            ROUND(
                100.0 * COALESCE(sbs.n_single_bid, 0) / NULLIF(foc.total_awards, 0),
            1) AS single_bid_pct
        FROM hhi_calc h
        JOIN full_org_counts foc ON foc.org_name = h.org_name
        LEFT JOIN single_bid_stats sbs ON sbs.org_name = h.org_name
        WHERE h.hhi IS NOT NULL
          AND foc.total_awards >= 30
        ORDER BY foc.total_awards DESC
        LIMIT 400
    """)
    rows = cur.fetchall()
    return jsonify([{
        "org":            r["org_name"],
        "portal":         r["portal_type"] or "unknown",
        "hhi":            float(r["hhi"] or 0),
        "n_vendors":      int(r["n_vendors"] or 0),
        "total_awards":   int(r["total_awards"] or 0),
        "single_bid_pct": float(r["single_bid_pct"] or 0),
    } for r in rows])


@insights_bp.route("/api/vendor-profile")
def api_vendor_profile():
    """Search a vendor by name and return their full profile."""
    name = request.args.get("name", "").strip()
    if not name or len(name) < 3:
        return jsonify({"error": "Provide at least 3 characters"}), 400

    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    # Summary stats
    cur.execute("""
        SELECT
            bidder_name,
            COUNT(*) AS total_wins,
            COUNT(DISTINCT org_name) AS n_orgs,
            ROUND(SUM(contract_value) / 1e7, 2) AS total_value_cr,
            MIN(aoc_date) AS first_win,
            MAX(aoc_date) AS last_win,
            COUNT(*) FILTER (WHERE contract_value >= 100000000) AS high_value_count
        FROM aoc_tenders
        WHERE bidder_name ILIKE %s
          AND bidder_name IS NOT NULL
        GROUP BY bidder_name
        ORDER BY total_wins DESC
        LIMIT 20
    """, (f"%{name}%",))
    matches = [dict(r) for r in cur.fetchall()]

    if not matches:
        return jsonify({"matches": [], "profile": None})

    # Auto-select the top match for profile
    top = matches[0]["bidder_name"]

    # Year-wise trend
    cur.execute("""
        SELECT EXTRACT(YEAR FROM aoc_date::date)::int AS yr, COUNT(*) AS wins
        FROM aoc_tenders
        WHERE bidder_name = %s AND aoc_date IS NOT NULL
        GROUP BY yr ORDER BY yr
    """, (top,))
    trend = [{"year": str(r["yr"]), "wins": r["wins"]} for r in cur.fetchall()]

    # Top departments
    cur.execute("""
        SELECT org_name, COUNT(*) AS wins,
               ROUND(SUM(contract_value)/1e7, 2) AS value_cr
        FROM aoc_tenders
        WHERE bidder_name = %s
        GROUP BY org_name ORDER BY wins DESC LIMIT 10
    """, (top,))
    depts = [dict(r) for r in cur.fetchall()]

    # Single-bid count for this vendor
    cur.execute("""
        SELECT COUNT(*) AS cnt FROM single_bid_contracts WHERE bidder_name = %s
    """, (top,))
    sb_count = cur.fetchone()["cnt"]

    # Recent contracts
    cur.execute("""
        SELECT org_name, title, contract_value, aoc_date, portal_type
        FROM aoc_tenders
        WHERE bidder_name = %s
        ORDER BY contract_value DESC NULLS LAST
        LIMIT 20
    """, (top,))
    contracts = [dict(r) for r in cur.fetchall()]
    for c in contracts:
        if c.get("aoc_date"): c["aoc_date"] = str(c["aoc_date"])

    return jsonify({
        "matches":   matches,
        "profile": {
            "name":           top,
            "trend":          trend,
            "departments":    depts,
            "contracts":      contracts,
            "single_bid_count": int(sb_count),
        }
    })
