import os
import time
from flask import Blueprint, jsonify
from core.db import get_pg_conn
from psycopg2.extras import RealDictCursor

DATA_DUMP = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'databases', 'data_dump'))

system_bp = Blueprint('system', __name__)

@system_bp.route("/api/status")
def api_status():
    try:
        conn = get_pg_conn()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.fetchone()
        db_ready = True
    except Exception:
        db_ready = False

    return jsonify({
        "summary_db_ready": db_ready,
        "search_db_ready": db_ready,
        "aoc_in_dump": False,
        "message": "Connected to PostgreSQL" if db_ready else "PostgreSQL Database Offline"
    })

@system_bp.route("/api/analysis-progress")
def api_analysis_progress():
    return jsonify({"status": "completed", "progress": 100})

@system_bp.route("/api/system-status")
def api_system_status():
    """Comprehensive system health check for the System Status dashboard."""
    result = {
        "db_online": False,
        "latency_ms": None,
        "pg_version": None,
        "db_size_mb": None,
        "uptime": None,
        "tables": [],
        "error": None,
    }

    try:
        start = time.time()
        conn = get_pg_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # 1. Latency check
        cur.execute("SELECT 1")
        cur.fetchone()
        result["latency_ms"] = round((time.time() - start) * 1000, 2)
        result["db_online"] = True

        # 2. PostgreSQL version
        cur.execute("SELECT version()")
        row = cur.fetchone()
        result["pg_version"] = row["version"] if row else "Unknown"

        # 3. Database size
        cur.execute("SELECT pg_size_pretty(pg_database_size(current_database())) AS size")
        row = cur.fetchone()
        result["db_size_mb"] = row["size"] if row else "Unknown"

        # 4. Server uptime
        cur.execute("SELECT now() - pg_postmaster_start_time() AS uptime")
        row = cur.fetchone()
        if row and row["uptime"]:
            td = row["uptime"]
            days = td.days
            hours, rem = divmod(td.seconds, 3600)
            mins, _ = divmod(rem, 60)
            result["uptime"] = f"{days}d {hours}h {mins}m"

        # 5. Table row counts for all important tables
        important_tables = [
            "aoc_tenders", "aoc_details", "kpi_stats", "yearly_trends",
            "monthly_trends", "top_orgs", "tender_type_dist", "portal_breakdown",
            "value_brackets", "tenders_status", "published_monthly",
            "top_published_orgs", "single_bid_contracts", "repeat_winners",
            "org_report_cards", "state_stats", "sector_distribution",
            "network_nodes", "network_edges"
        ]

        tables_info = []
        for table in important_tables:
            try:
                cur.execute(f"SELECT count(1) AS cnt FROM {table}")
                row = cur.fetchone()
                tables_info.append({
                    "name": table,
                    "rows": row["cnt"] if row else 0,
                    "status": "ok"
                })
            except Exception:
                conn.rollback()
                tables_info.append({
                    "name": table,
                    "rows": 0,
                    "status": "missing"
                })

        result["tables"] = tables_info

    except Exception as e:
        result["error"] = str(e)

    return jsonify(result)

@system_bp.route("/api/dump-files")
def api_dump_files():
    """List .db files currently in data_dump/."""
    if not os.path.exists(DATA_DUMP):
        return jsonify({"files": []})
    files = []
    for f in os.listdir(DATA_DUMP):
        if f.lower().endswith(".db"):
            full = os.path.join(DATA_DUMP, f)
            size_mb = round(os.path.getsize(full) / 1024 / 1024, 1)
            files.append({"name": f, "size_mb": size_mb})
    return jsonify({"files": files, "data_dump_path": DATA_DUMP})
