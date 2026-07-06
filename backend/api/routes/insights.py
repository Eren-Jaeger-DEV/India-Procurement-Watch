from flask import Blueprint, jsonify, request
from core.db import get_pg_conn
from core.cache import cache
from psycopg2.extras import RealDictCursor

insights_bp = Blueprint('insights', __name__)


@insights_bp.route("/api/hhi-scatter")
@cache.cached(timeout=900)
def api_hhi_scatter():
    """
    Compute Herfindahl-Hirschman Index per organization from repeat_winners and single_bid_contracts.
    Only considers orgs with >= 30 awards that have an identified bidder.
    Returns: org_name, hhi (0-10000), n_vendors, total_awards, single_bid_pct, portal_type
    """
    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        WITH org_totals AS (
            SELECT org_name, SUM(wins) AS total_wins, COUNT(DISTINCT bidder_name) AS n_vendors
            FROM repeat_winners
            GROUP BY org_name
        ),
        hhi_calc AS (
            SELECT
                rw.org_name,
                ROUND(SUM(POWER(100.0 * rw.wins / ot.total_wins, 2))::numeric, 0) AS hhi
            FROM repeat_winners rw
            JOIN org_totals ot ON ot.org_name = rw.org_name
            GROUP BY rw.org_name, ot.total_wins
        )
        SELECT
            h.org_name,
            h.hhi,
            ot.n_vendors,
            ot.total_wins AS total_awards,
            COALESCE((SELECT portal_type FROM single_bid_contracts WHERE org_name = h.org_name LIMIT 1), 'central') AS portal_type,
            ROUND(100.0 * COALESCE((SELECT COUNT(*) FROM single_bid_contracts WHERE org_name = h.org_name), 0) / NULLIF(ot.total_wins, 0), 1) AS single_bid_pct
        FROM hhi_calc h
        JOIN org_totals ot ON ot.org_name = h.org_name
        WHERE ot.total_wins >= 30
        ORDER BY ot.total_wins DESC
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
    """Search a vendor by name and return their profile details from single_bid_contracts and repeat_winners."""
    name = request.args.get("name", "").strip()
    if not name or len(name) < 3:
        return jsonify({"error": "Provide at least 3 characters"}), 400

    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    # Find matching bidder names
    cur.execute("""
        SELECT DISTINCT bidder_name
        FROM (
            SELECT bidder_name FROM repeat_winners WHERE bidder_name ILIKE %s
            UNION
            SELECT bidder_name FROM single_bid_contracts WHERE bidder_name ILIKE %s
        ) as tmp
        ORDER BY bidder_name
        LIMIT 20
    """, (f"%{name}%", f"%{name}%"))
    matches_rows = cur.fetchall()
    
    if not matches_rows:
        return jsonify({"matches": [], "profile": None})

    matches = [{"bidder_name": r["bidder_name"]} for r in matches_rows]
    top = matches[0]["bidder_name"]

    # Compute stats for the top matching vendor
    # Total wins
    cur.execute("SELECT COALESCE(SUM(wins), 0) AS total_wins FROM repeat_winners WHERE bidder_name = %s", (top,))
    rw_wins = cur.fetchone()["total_wins"]
    
    cur.execute("SELECT COUNT(*) AS count FROM single_bid_contracts WHERE bidder_name = %s", (top,))
    sb_wins = cur.fetchone()["count"]
    total_wins = int(rw_wins + sb_wins)

    # Orgs (departments) count
    cur.execute("""
        SELECT COUNT(DISTINCT org_name) AS n_orgs
        FROM (
            SELECT org_name FROM repeat_winners WHERE bidder_name = %s
            UNION
            SELECT org_name FROM single_bid_contracts WHERE bidder_name = %s
        ) as tmp
    """, (top, top))
    n_orgs = cur.fetchone()["n_orgs"]

    # Total value crore
    cur.execute("SELECT COALESCE(SUM(total_value_crore), 0) AS total_val FROM repeat_winners WHERE bidder_name = %s", (top,))
    rw_val = cur.fetchone()["total_val"]
    
    cur.execute("SELECT COALESCE(SUM(contract_value)/1e7, 0) AS total_val FROM single_bid_contracts WHERE bidder_name = %s", (top,))
    sb_val = cur.fetchone()["total_val"]
    total_value_cr = float(rw_val + sb_val)

    # Matches summary formatting (update matches[0] with actual stats)
    matches[0]["total_wins"] = total_wins
    matches[0]["n_orgs"] = n_orgs
    matches[0]["total_value_cr"] = total_value_cr

    # Trend: years based on single_bid_contracts or repeat_winners win dates
    cur.execute("""
        SELECT
            yr, COUNT(*) AS wins
        FROM (
            SELECT EXTRACT(YEAR FROM aoc_date::date)::int AS yr FROM single_bid_contracts WHERE bidder_name = %s AND aoc_date IS NOT NULL
            UNION ALL
            SELECT EXTRACT(YEAR FROM first_win::date)::int AS yr FROM repeat_winners WHERE bidder_name = %s AND first_win IS NOT NULL
        ) as tmp
        WHERE yr IS NOT NULL
        GROUP BY yr ORDER BY yr
    """, (top, top))
    trend = [{"year": str(r["yr"]), "wins": r["wins"]} for r in cur.fetchall()]

    # Top departments
    cur.execute("""
        SELECT org_name, SUM(wins) AS wins, SUM(total_value_crore) AS value_cr
        FROM (
            SELECT org_name, wins, total_value_crore FROM repeat_winners WHERE bidder_name = %s
            UNION ALL
            SELECT org_name, 1 AS wins, contract_value/1e7 AS total_value_crore FROM single_bid_contracts WHERE bidder_name = %s
        ) as tmp
        GROUP BY org_name ORDER BY wins DESC LIMIT 10
    """, (top, top))
    depts = [dict(r) for r in cur.fetchall()]

    # Recent contracts from single_bid_contracts
    cur.execute("""
        SELECT org_name, title, contract_value, aoc_date, portal_type
        FROM single_bid_contracts
        WHERE bidder_name = %s
        ORDER BY contract_value DESC NULLS LAST
        LIMIT 20
    """, (top,))
    contracts = [dict(r) for r in cur.fetchall()]
    for c in contracts:
        if c.get("aoc_date"): c["aoc_date"] = str(c["aoc_date"])

    # Check if top vendor matches any sanctioned entity
    cur.execute("""
        SELECT name, schema_type, countries, addresses, sanctions, first_seen
        FROM sanctioned_entities
        WHERE name ILIKE %s OR %s ILIKE '%' || name || '%'
        LIMIT 1
    """, (f"%{top}%", top))
    sanction_row = cur.fetchone()
    sanction_match = dict(sanction_row) if sanction_row else None

    return jsonify({
        "matches":   matches,
        "profile": {
            "name":           top,
            "trend":          trend,
            "departments":    depts,
            "contracts":      contracts,
            "single_bid_count": int(sb_wins),
            "sanction_match": sanction_match,
        }
    })
