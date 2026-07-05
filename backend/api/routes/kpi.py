from flask import Blueprint, jsonify
from core.db import get_pg_conn
from core.cache import cache
from psycopg2.extras import RealDictCursor

kpi_bp = Blueprint('kpi', __name__)

@kpi_bp.route("/api/kpis")
@cache.cached(timeout=300)
def api_kpis():
    conn = get_pg_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT key, value FROM kpi_stats")
    data = {row["key"]: row["value"] for row in cur.fetchall()}
    return jsonify(data)
