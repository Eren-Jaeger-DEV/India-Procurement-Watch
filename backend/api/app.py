"""
app.py
======
Flask API backend for India Procurement Watch — Power Analysis Tool.
Serves data from a local PostgreSQL database (ipw).
"""

import json
import os
import re as _re
import threading
from flask import Flask, jsonify, request, send_from_directory, abort, g
import time
from flask_cors import CORS
import traceback
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "frontend", "dist"))
STATE_FILE = os.path.abspath(os.path.join(BASE_DIR, "..", "databases", "analysis_state.json"))
REPORT_FILE= os.path.abspath(os.path.join(BASE_DIR, "..", "databases", "narrative_report.json"))
DATA_DUMP  = os.path.abspath(os.path.join(BASE_DIR, "..", "databases", "data_dump"))

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from core.cache import cache
from core.logger import setup_logger
from routes.kpi import kpi_bp
from routes.trends import trends_bp

ipw_logger = setup_logger()

app = Flask(__name__)
CORS(app, origins=["https://tender.darshi.app", "http://localhost:3000", "http://127.0.0.1:3000"])

cache.init_app(app)
app.register_blueprint(kpi_bp)
app.register_blueprint(trends_bp)

import redis

limiter_storage = "memory://"
try:
    r = redis.Redis(host='localhost', port=6379, db=0, socket_connect_timeout=1)
    if r.ping():
        limiter_storage = "redis://localhost:6379"
except Exception:
    pass

limiter = Limiter(
    get_remote_address,
    app=app,
    storage_uri=limiter_storage,
    default_limits=["1000 per day", "100 per hour"]
)

from routes.system import system_bp
from routes.analytics import analytics_bp
from routes.profiles import profiles_bp
from routes.ai_search import ai_search_bp
from routes.reporting import reporting_bp
from routes.network import network_bp
from routes.tenders import tenders_bp
from routes.insights import insights_bp

app.register_blueprint(system_bp)
app.register_blueprint(analytics_bp)
app.register_blueprint(profiles_bp)
app.register_blueprint(ai_search_bp)
app.register_blueprint(reporting_bp)
app.register_blueprint(network_bp)
app.register_blueprint(tenders_bp)
app.register_blueprint(insights_bp)

@app.after_request
def set_security_headers(response):
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "worker-src 'self' blob:; child-src 'self' blob:; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; "
        "style-src 'self' 'unsafe-inline'; "
        "connect-src 'self' https://tender.darshi.app https://server.arcgisonline.com https://services.arcgisonline.com https://fonts.openmaptiles.org https://demotiles.maplibre.org https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com; "
        "img-src 'self' data: https://*;"
    )
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    return response

# ─────────────────────────────────────────────
# DB HELPERS — PostgreSQL connection (request-scoped)
# ─────────────────────────────────────────────
from core.db import get_pg_conn, close_db, rows_to_list

@app.teardown_appcontext
def teardown_db(error):
    close_db(error)

@app.before_request
def start_timer():
    g.start_time = time.time()

@app.after_request
def log_request(response):
    if request.path.startswith('/api/'):
        now = time.time()
        duration = round((now - getattr(g, 'start_time', now)) * 1000, 2)
        ip = get_remote_address()
        ipw_logger.info(f"{ip} | {request.method} {request.path} | {response.status_code} | {duration}ms")
    return response

@app.errorhandler(404)
def not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({"error": "Not Found"}), 404
    return send_from_directory(STATIC_DIR, 'index.html')

@app.errorhandler(Exception)
def handle_exception(e):
    from werkzeug.exceptions import HTTPException
    if isinstance(e, HTTPException):
        return e
    ip = get_remote_address()
    tb = traceback.format_exc()
    ipw_logger.error(f"{ip} | {request.method} {request.path} | 500 INTERNAL SERVER ERROR\n{tb}")
    return jsonify({"error": "Internal Server Error"}), 500

# ─────────────────────────────────────────────
# UI STATE ENDPOINTS
# ─────────────────────────────────────────────






# ─────────────────────────────────────────────
# API: DUMP FILES LIST
# ─────────────────────────────────────────────


# ─────────────────────────────────────────────
# API: VENDOR CORPORATE IDENTITY (MCA)
# ─────────────────────────────────────────────



# KPI and TRENDS routes have been moved to their respective Blueprint files in routes/

# ─────────────────────────────────────────────
# API: TOP ORGS
# ─────────────────────────────────────────────


# ─────────────────────────────────────────────
# API: TENDER TYPES
# ─────────────────────────────────────────────



# ─────────────────────────────────────────────
# API: SECTOR DISTRIBUTION
# ─────────────────────────────────────────────


# ─────────────────────────────────────────────
# API: PORTAL BREAKDOWN
# ─────────────────────────────────────────────


# ─────────────────────────────────────────────
# API: VALUE DISTRIBUTION
# ─────────────────────────────────────────────



# ─────────────────────────────────────────────
# API: SINGLE-BID CONTRACTS
# ─────────────────────────────────────────────


# ─────────────────────────────────────────────
# API: REPEAT WINNERS
# ─────────────────────────────────────────────






# ─────────────────────────────────────────────
# API: DEEP DIVE — ORG PROFILE
# ─────────────────────────────────────────────


# ─────────────────────────────────────────────
# API: DEEP DIVE — VENDOR PROFILE
# ─────────────────────────────────────────────


# ─────────────────────────────────────────────
# API: EXPORT — STANDALONE HTML REPORT
# ─────────────────────────────────────────────





# ─────────────────────────────────────────────
# API: SEARCH (FTS5 + LIKE fallback)
# ─────────────────────────────────────────────

def _sanitize_fts(q):
    q = _re.sub(r'["()*:\^\-]', ' ', q).strip()
    words = q.split()
    if not words:
        return None
    return ' '.join(f'"{w}"' for w in words)





# ─────────────────────────────────────────────
# API: NARRATIVE REPORT
# ─────────────────────────────────────────────


# ─────────────────────────────────────────────
# API: TENDER DETAIL
# ─────────────────────────────────────────────



# ─────────────────────────────────────────────
# API: COMPANY & DIRECTOR NETWORK GRAPH
# ─────────────────────────────────────────────






# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass
    if hasattr(sys.stderr, 'reconfigure'):
        try:
            sys.stderr.reconfigure(encoding='utf-8')
        except Exception:
            pass

    print("=" * 60)
    print("  India Procurement Watch — Power Analysis Tool")
    print("  http://localhost:5000")
    print("=" * 60)
    if not os.path.exists(SUM_DB):
        print("  ⚠  No analysis data found.")
        print(f"     Drop your .db file into: {DATA_DUMP}")
        print("     Then click 'Analyse Data' in the dashboard.")
    app.run(debug=False, host="0.0.0.0", port=5000, threaded=True)


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    if path.startswith('api/'):
        return jsonify({"error": "Endpoint not found"}), 404
    file_path = os.path.join(STATIC_DIR, path)
    if path != "" and os.path.exists(file_path):
        return send_from_directory(STATIC_DIR, path)
    return send_from_directory(STATIC_DIR, 'index.html')



