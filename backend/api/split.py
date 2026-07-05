import os
import re

with open("app.py", "r", encoding="utf-8") as f:
    text = f.read()

# I am creating the blueprint files manually in python for safety
kpi_code = """from flask import Blueprint, jsonify
from core.db import get_pg_conn
from psycopg2.extras import RealDictCursor

kpi_bp = Blueprint('kpi', __name__)

@kpi_bp.route("/api/kpis")
def api_kpis():
    conn = get_pg_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT key, value FROM kpi_stats")
    data = {row["key"]: row["value"] for row in cur.fetchall()}
    return jsonify(data)
"""
with open("routes/kpi.py", "w", encoding="utf-8") as f:
    f.write(kpi_code)

print("Created routes/kpi.py")
