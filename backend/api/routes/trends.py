from flask import Blueprint, jsonify, request
from core.db import get_pg_conn
from core.cache import cache
from psycopg2.extras import RealDictCursor

trends_bp = Blueprint('trends', __name__)

MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

@trends_bp.route("/api/trends")
@cache.cached(timeout=300, query_string=True)
def api_trends():
    grain   = request.args.get("grain", "monthly")
    dataset = request.args.get("dataset", "aoc")

    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    if dataset == "published":
        if grain == "yearly":
            cur.execute("""
                SELECT year, SUM(count) as count
                FROM published_monthly
                WHERE year BETWEEN 2015 AND 2030
                GROUP BY year ORDER BY year
            """)
            rows = cur.fetchall()
            return jsonify({"labels": [str(r["year"]) for r in rows],
                            "counts": [r["count"] for r in rows], "values": []})
        else:
            cur.execute("""
                SELECT year, month, count
                FROM published_monthly
                WHERE year BETWEEN 2018 AND 2030
                ORDER BY year, month
            """)
            rows = cur.fetchall()
            return jsonify({"labels": [f"{MONTH_NAMES[r['month']]} {r['year']}" for r in rows],
                            "counts": [r["count"] for r in rows], "values": []})

    if grain == "yearly":
        cur.execute("""
            SELECT
                yt.year,
                SUM(yt.count) as count,
                SUM(yt.total_value_crore) as total_value_crore,
                ROUND(100.0 * COUNT(sb.internal_id) / NULLIF(SUM(yt.count), 0), 1) as single_bid_pct
            FROM yearly_trends yt
            LEFT JOIN (
                SELECT EXTRACT(YEAR FROM aoc_date::date)::int AS yr, internal_id
                FROM single_bid_contracts WHERE aoc_date IS NOT NULL
            ) sb ON sb.yr = yt.year
            WHERE yt.year BETWEEN 2015 AND 2030
            GROUP BY yt.year ORDER BY yt.year
        """)
        rows   = cur.fetchall()
        labels = [str(r["year"]) for r in rows]
        counts = [r["count"] for r in rows]
        values = [round(r["total_value_crore"] or 0, 2) for r in rows]
        single_bid_pcts = [float(r["single_bid_pct"] or 0) for r in rows]

    else:
        cur.execute("""
            SELECT year, month, count, total_value_crore
            FROM monthly_trends WHERE year BETWEEN 2018 AND 2030
            ORDER BY year, month
        """)
        rows   = cur.fetchall()
        labels = [f"{MONTH_NAMES[r['month']]} {r['year']}" for r in rows]
        counts = [r["count"] for r in rows]
        values = [round(r["total_value_crore"] or 0, 2) for r in rows]
        single_bid_pcts = []

    return jsonify({"labels": labels, "counts": counts, "values": values,
                    "single_bid_pcts": single_bid_pcts})
