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
            SELECT year, SUM(count) as count, SUM(total_value_crore) as total_value_crore
            FROM yearly_trends WHERE year BETWEEN 2015 AND 2030
            GROUP BY year ORDER BY year
        """)
        rows   = cur.fetchall()
        labels = [str(r["year"]) for r in rows]
        counts = [r["count"] for r in rows]
        values = [round(r["total_value_crore"] or 0, 2) for r in rows]
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

    return jsonify({"labels": labels, "counts": counts, "values": values})
