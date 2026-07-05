from flask import Blueprint, jsonify, request
from core.db import get_pg_conn
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
