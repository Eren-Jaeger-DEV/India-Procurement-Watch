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

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="")
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

@app.after_request
def set_security_headers(response):
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; "
        "style-src 'self' 'unsafe-inline'; "
        "connect-src 'self' https://tender.darshi.app; "
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

@app.errorhandler(Exception)
def handle_exception(e):
    ip = get_remote_address()
    tb = traceback.format_exc()
    ipw_logger.error(f"{ip} | {request.method} {request.path} | 500 INTERNAL SERVER ERROR\n{tb}")
    return jsonify({"error": "Internal Server Error"}), 500

# ─────────────────────────────────────────────
# UI STATE ENDPOINTS
# ─────────────────────────────────────────────

@app.route("/api/status")
def api_status():
    return jsonify({
        "summary_db_ready": True,
        "search_db_ready": True,
        "aoc_in_dump": False,
        "message": "Connected to PostgreSQL"
    })

@app.route("/api/analysis-progress")
def api_analysis_progress():
    return jsonify({"status": "completed", "progress": 100})




# ─────────────────────────────────────────────
# API: DUMP FILES LIST
# ─────────────────────────────────────────────

@app.route("/api/dump-files")
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

# ─────────────────────────────────────────────
# API: VENDOR CORPORATE IDENTITY (MCA)
# ─────────────────────────────────────────────

@limiter.limit("30 per minute")
@app.route("/api/vendor-mca/<path:vendor_name>")
def api_vendor_mca(vendor_name):
    """Fuzzy match a vendor name against the MCA dataset to fetch corporate identity."""
    if not os.path.exists(MCA_DB):
        return jsonify({"error": "MCA database not available"}), 404
        
    conn = get_pg_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    import re
    try:
        from rapidfuzz import fuzz, process
    except ImportError:
        return jsonify({"error": "rapidfuzz not installed"}), 500
    
    clean_name = re.sub(r'[^a-zA-Z0-9\s]', '', vendor_name).upper()
    words = clean_name.split()
    if not words:
        return jsonify({"error": "Invalid vendor name"}), 400
        
    # Use longest words for the initial SQL LIKE search to cast a wide but efficient net
    words.sort(key=len, reverse=True)
    top_words = words[:2]
    
    query = "SELECT CIN, CompanyName, CompanyStatus, PaidupCapital, CompanyRegistrationdate_date, Registered_Office_Address, CompanyStateCode FROM records WHERE "
    conditions = []
    params = []
    for w in top_words:
        if len(w) > 2:
            conditions.append("CompanyName ILIKE %s")
            params.append(f"%{w}%")
            
    if not conditions:
        return jsonify({"match": None})
        
    query += " OR ".join(conditions) + " LIMIT 200"
    
    try:
        cur.execute(query, params)
        rows = [dict(r) for r in cur.fetchall()]
    except Exception as e:
        app.logger.error(f"vendor_mca error: {e}")
        return jsonify({"error": "Database lookup failed. Please try again."}), 500
        
    if not rows:
        return jsonify({"match": None})
        
    # Fuzzy match to find the best candidate
    choices = [r['CompanyName'].upper() for r in rows]
    best_match = process.extractOne(clean_name, choices, scorer=fuzz.token_sort_ratio)
    
    if best_match and best_match[1] >= 65:  # 65% threshold for token match
        idx = best_match[2]
        return jsonify({"match": rows[idx], "score": best_match[1]})
        
    return jsonify({"match": None})


# KPI and TRENDS routes have been moved to their respective Blueprint files in routes/

# ─────────────────────────────────────────────
# API: TOP ORGS
# ─────────────────────────────────────────────

@app.route("/api/top-orgs")
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

# ─────────────────────────────────────────────
# API: TENDER TYPES
# ─────────────────────────────────────────────

@app.route("/api/tender-types")
def api_tender_types():
    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT tender_type, count, total_value_crore FROM tender_type_dist ORDER BY count DESC LIMIT 20")
    rows = cur.fetchall()
    return jsonify({"labels": [r["tender_type"] for r in rows],
                    "counts": [r["count"] for r in rows],
                    "values": [round(r["total_value_crore"] or 0, 2) for r in rows]})


# ─────────────────────────────────────────────
# API: SECTOR DISTRIBUTION
# ─────────────────────────────────────────────

@app.route("/api/sector-distribution")
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

# ─────────────────────────────────────────────
# API: PORTAL BREAKDOWN
# ─────────────────────────────────────────────

@app.route("/api/portal-breakdown")
def api_portal_breakdown():
    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT portal_type, count FROM portal_breakdown ORDER BY count DESC")
    rows = cur.fetchall()
    return jsonify({"labels": [r["portal_type"] for r in rows],
                    "counts": [r["count"] for r in rows]})

# ─────────────────────────────────────────────
# API: VALUE DISTRIBUTION
# ─────────────────────────────────────────────

@app.route("/api/value-distribution")
def api_value_dist():
    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT bracket, count FROM value_brackets ORDER BY min_val")
    rows = cur.fetchall()
    return jsonify({"labels": [r["bracket"] for r in rows],
                    "counts": [r["count"] for r in rows]})


# ─────────────────────────────────────────────
# API: SINGLE-BID CONTRACTS
# ─────────────────────────────────────────────

@app.route("/api/single-bid-contracts")
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

# ─────────────────────────────────────────────
# API: REPEAT WINNERS
# ─────────────────────────────────────────────

@app.route("/api/repeat-winners")
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




@app.route("/api/state-stats")
def api_state_stats():
    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT state_name, total_contracts, total_value_crore FROM state_stats")
    return jsonify([dict(r) for r in cur.fetchall()])

# ─────────────────────────────────────────────
# API: DEEP DIVE — ORG PROFILE
# ─────────────────────────────────────────────

@app.route("/api/org-profile/<path:org_name>")
def api_org_profile(org_name):
    """Return a full profile for a specific organisation."""
    if not os.path.exists(SUM_DB):
        return jsonify({"error": "No data available"}), 404

    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    # Basic stats
    cur.execute("""
        SELECT org_name, total_contracts, total_value_crore, single_bid_pct, round_number_pct, hhi_score
        FROM org_report_cards WHERE org_name = %s
    """, (org_name,))
    rc_row = cur.fetchone()
    report_card = dict(rc_row) if rc_row else {}

    anomaly_summary = []

    # Top vendors (repeat winners) for this org
    cur.execute("""
        SELECT bidder_name, wins, total_value_crore, first_win, last_win
        FROM repeat_winners WHERE org_name = %s
        ORDER BY wins DESC LIMIT 10
    """, (org_name,))
    top_vendors = [dict(r) for r in cur.fetchall()]

    # Single bid contracts for this org
    cur.execute("""
        SELECT COUNT(*) as cnt, SUM(contract_value) as total_val
        FROM single_bid_contracts WHERE org_name = %s
    """, (org_name,))
    sb_row = cur.fetchone()
    single_bid_stats = dict(sb_row) if sb_row else {}

    return jsonify({
        "org_name": org_name,
        "report_card": report_card,
        "anomaly_summary": anomaly_summary,
        "top_vendors": top_vendors,
        "single_bid_stats": single_bid_stats,
    })

# ─────────────────────────────────────────────
# API: DEEP DIVE — VENDOR PROFILE
# ─────────────────────────────────────────────

@app.route("/api/vendor-profile/<path:vendor_name>")
def api_vendor_profile(vendor_name):
    """Return all contracts/wins for a specific vendor."""
    if not os.path.exists(SUM_DB):
        return jsonify({"error": "No data available"}), 404

    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT org_name, wins, total_value_crore, first_win, last_win
        FROM repeat_winners WHERE bidder_name = %s
        ORDER BY wins DESC
    """, (vendor_name,))
    department_wins = [dict(r) for r in cur.fetchall()]

    cur.execute("""
        SELECT org_name, title, contract_value, aoc_date, portal_type
        FROM single_bid_contracts WHERE bidder_name = %s
        ORDER BY contract_value DESC LIMIT 20
    """, (vendor_name,))
    single_bid_wins = [dict(r) for r in cur.fetchall()]

    total_wins = sum(d.get("wins", 0) for d in department_wins)
    total_value = sum(d.get("total_value_crore", 0) for d in department_wins)

    return jsonify({
        "vendor_name": vendor_name,
        "total_wins": total_wins,
        "total_value_crore": round(total_value, 2),
        "departments": department_wins,
        "single_bid_contracts": single_bid_wins,
    })

# ─────────────────────────────────────────────
# API: EXPORT — STANDALONE HTML REPORT
# ─────────────────────────────────────────────

@app.route("/api/export/html")
def api_export_html():
    """Generate and return a standalone HTML investigation report."""
    if not os.path.exists(REPORT_FILE):
        return jsonify({"error": "No report available. Run analysis first."}), 404

    with open(REPORT_FILE, encoding="utf-8") as f:
        report = json.load(f)

    summary = report.get("executive_summary", {})
    findings = report.get("findings", [])

    sev_colors = {
        "CRITICAL": "#ef4444", "HIGH": "#f97316",
        "MEDIUM": "#eab308", "LOW": "#22c55e", "INFO": "#6b7280"
    }

    import html
    findings_html = ""
    for f in findings:
        color = sev_colors.get(f.get("severity"), "#6b7280")
        emoji = f.get("severity_emoji", "")
        ns_html = "".join(f"<li>{html.escape(str(ns))}</li>" for ns in f.get("next_steps", []))
        findings_html += f"""
        <div class="finding" style="border-left: 4px solid {color};">
          <div class="finding-header">
            <span class="badge" style="background:{color}">{html.escape(emoji)} {html.escape(str(f.get('severity', '')))}</span>
            <h3>{html.escape(str(f.get('title', '')))}</h3>
          </div>
          <p class="summary">{html.escape(str(f.get('summary', '')))}</p>
          <p>{html.escape(str(f.get('explanation', '')))}</p>
          <div class="box"><strong>What This Could Mean:</strong><p>{html.escape(str(f.get('what_it_means', '')))}</p></div>
          <div class="box"><strong>Next Steps for Investigation:</strong><ul>{ns_html}</ul></div>
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>India Procurement Watch — Analysis Report</title>
<style>
  body {{ font-family: Georgia, serif; max-width: 900px; margin: 40px auto; padding: 20px; color: #1a1a2e; background: #fafafa; }}
  h1 {{ color: #1a1a2e; border-bottom: 3px solid #f97316; padding-bottom: 10px; }}
  h2 {{ color: #f97316; margin-top: 40px; }}
  .meta {{ color: #666; font-size: 0.9em; margin-bottom: 30px; }}
  .exec-summary {{ background: #1a1a2e; color: white; padding: 25px; border-radius: 8px; margin-bottom: 40px; }}
  .exec-summary p {{ color: #d1d5db; line-height: 1.7; }}
  .counts {{ display: flex; gap: 20px; margin-top: 15px; }}
  .count-box {{ text-align: center; padding: 10px 20px; border-radius: 6px; }}
  .finding {{ background: white; padding: 25px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
  .finding-header {{ display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }}
  .finding-header h3 {{ margin: 0; font-size: 1.1em; }}
  .badge {{ color: white; padding: 3px 10px; border-radius: 20px; font-size: 0.75em; font-weight: bold; white-space: nowrap; }}
  .summary {{ font-weight: bold; color: #374151; margin-bottom: 12px; }}
  .box {{ background: #f9fafb; border-radius: 6px; padding: 15px; margin-top: 15px; }}
  .box strong {{ color: #1a1a2e; }}
  ul {{ margin: 8px 0; padding-left: 20px; line-height: 1.8; }}
  @media print {{ body {{ background: white; }} .finding {{ box-shadow: none; border: 1px solid #eee; }} }}
</style>
</head>
<body>
<h1>🏛️ India Procurement Watch</h1>
<p class="meta">Analysis Report — Generated: {summary.get('generated_at', 'N/A')} &nbsp;|&nbsp; <strong>PUBLIC DATA FOR PUBLIC SCRUTINY</strong></p>

<div class="exec-summary">
  <h2 style="color:white;margin-top:0">{summary.get('headline', 'Analysis Report')}</h2>
  <p>{summary.get('paragraph_1', '')}</p>
  <p>{summary.get('paragraph_2', '')}</p>
  <p>{summary.get('paragraph_3', '')}</p>
  <div class="counts">
    <div class="count-box" style="background:#ef4444">🔴<br><strong>{summary.get('critical_count',0)}</strong><br>CRITICAL</div>
    <div class="count-box" style="background:#f97316">🟠<br><strong>{summary.get('high_count',0)}</strong><br>HIGH</div>
    <div class="count-box" style="background:#eab308">🟡<br><strong>{summary.get('medium_count',0)}</strong><br>MEDIUM</div>
  </div>
</div>

<h2>Findings ({len(findings)} total)</h2>
{findings_html}

<hr style="margin-top:40px">
<p style="color:#999;font-size:0.8em;text-align:center">
  India Procurement Watch | Data sourced from CPPP (eprocure.gov.in) | Public data for public scrutiny.
</p>
</body></html>"""

    from flask import Response
    return Response(html, mimetype="text/html",
                    headers={"Content-Disposition": "attachment; filename=procurement_report.html"})


@app.route("/api/export/print")
def api_export_print():
    """Generate and return a print-friendly HTML report with auto-print trigger."""
    if not os.path.exists(REPORT_FILE):
        return jsonify({"error": "No report available. Run analysis first."}), 404

    with open(REPORT_FILE, encoding="utf-8") as f:
        report = json.load(f)

    summary = report.get("executive_summary", {})
    findings = report.get("findings", [])

    sev_colors = {
        "CRITICAL": "#ef4444", "HIGH": "#f97316",
        "MEDIUM": "#eab308", "LOW": "#22c55e", "INFO": "#6b7280"
    }

    import html
    findings_html = ""
    for f in findings:
        color = sev_colors.get(f.get("severity"), "#6b7280")
        emoji = f.get("severity_emoji", "")
        ns_html = "".join(f"<li>{html.escape(str(ns))}</li>" for ns in f.get("next_steps", []))
        findings_html += f"""
        <div class="finding" style="border-left: 4px solid {color};">
          <div class="finding-header">
            <span class="badge" style="background:{color}">{html.escape(emoji)} {html.escape(str(f.get('severity', '')))}</span>
            <h3>{html.escape(str(f.get('title', '')))}</h3>
          </div>
          <p class="summary">{html.escape(str(f.get('summary', '')))}</p>
          <p>{html.escape(str(f.get('explanation', '')))}</p>
          <div class="box"><strong>What This Could Mean:</strong><p>{html.escape(str(f.get('what_it_means', '')))}</p></div>
          <div class="box"><strong>Next Steps for Investigation:</strong><ul>{ns_html}</ul></div>
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>India Procurement Watch — Analysis Report</title>
<style>
  body {{ font-family: Georgia, serif; max-width: 900px; margin: 40px auto; padding: 20px; color: #1a1a2e; background: #fafafa; }}
  h1 {{ color: #1a1a2e; border-bottom: 3px solid #f97316; padding-bottom: 10px; }}
  h2 {{ color: #f97316; margin-top: 40px; }}
  .meta {{ color: #666; font-size: 0.9em; margin-bottom: 30px; }}
  .exec-summary {{ background: #1a1a2e; color: white; padding: 25px; border-radius: 8px; margin-bottom: 40px; }}
  .exec-summary p {{ color: #d1d5db; line-height: 1.7; }}
  .counts {{ display: flex; gap: 20px; margin-top: 15px; }}
  .count-box {{ text-align: center; padding: 10px 20px; border-radius: 6px; }}
  .finding {{ background: white; padding: 25px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
  .finding-header {{ display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }}
  .finding-header h3 {{ margin: 0; font-size: 1.1em; }}
  .badge {{ color: white; padding: 3px 10px; border-radius: 20px; font-size: 0.75em; font-weight: bold; white-space: nowrap; }}
  .summary {{ font-weight: bold; color: #374151; margin-bottom: 12px; }}
  .box {{ background: #f9fafb; border-radius: 6px; padding: 15px; margin-top: 15px; }}
  .box strong {{ color: #1a1a2e; }}
  ul {{ margin: 8px 0; padding-left: 20px; line-height: 1.8; }}
  @media print {{ body {{ background: white; margin: 0; padding: 0; }} .finding {{ box-shadow: none; border: 1px solid #eee; page-break-inside: avoid; }} }}
</style>
<script>
  window.onload = function() {{
    setTimeout(function() {{
      window.print();
    }}, 500);
  }}
</script>
</head>
<body>
<h1>🏛️ India Procurement Watch</h1>
<p class="meta">Analysis Report — Generated: {summary.get('generated_at', 'N/A')} &nbsp;|&nbsp; <strong>PUBLIC DATA FOR PUBLIC SCRUTINY</strong></p>

<div class="exec-summary">
  <h2 style="color:white;margin-top:0">{summary.get('headline', 'Analysis Report')}</h2>
  <p>{summary.get('paragraph_1', '')}</p>
  <p>{summary.get('paragraph_2', '')}</p>
  <p>{summary.get('paragraph_3', '')}</p>
  <div class="counts">
    <div class="count-box" style="background:#ef4444">🔴<br><strong>{summary.get('critical_count',0)}</strong><br>CRITICAL</div>
    <div class="count-box" style="background:#f97316">🟠<br><strong>{summary.get('high_count',0)}</strong><br>HIGH</div>
    <div class="count-box" style="background:#eab308">🟡<br><strong>{summary.get('medium_count',0)}</strong><br>MEDIUM</div>
  </div>
</div>

<h2>Findings ({len(findings)} total)</h2>
{findings_html}

<hr style="margin-top:40px">
<p style="color:#999;font-size:0.8em;text-align:center">
  India Procurement Watch | Data sourced from CPPP (eprocure.gov.in) | Public data for public scrutiny.
</p>
</body></html>"""

    from flask import Response
    return Response(html, mimetype="text/html")


# ─────────────────────────────────────────────
# API: SEARCH (FTS5 + LIKE fallback)
# ─────────────────────────────────────────────

def _sanitize_fts(q):
    q = _re.sub(r'["()*:\^\-]', ' ', q).strip()
    words = q.split()
    if not words:
        return None
    return ' '.join(f'"{w}"' for w in words)


@app.route("/api/agentic-search", methods=["POST"])
def api_agentic_search():
    from analysis.nlp_router import parse_natural_query
    
    data = request.get_json() or {}
    text = data.get("text", "")
    
    constraints = parse_natural_query(text)
    
    return jsonify({
        "success": True,
        "constraints": constraints
    })

@limiter.limit("10 per minute")
@app.route("/api/ai-chat", methods=["POST"])
def api_ai_chat():
    from analysis.ai_chat import ask_database
    from flask import Response
    data = request.get_json() or {}
    text = data.get("text", "")[:2000]
    model = data.get("model", "claude-opus-4-8")
    if not text.strip():
        return jsonify({"error": "No query provided"}), 400
        
    return Response(ask_database(text, model=model), mimetype="text/event-stream")

@app.route("/api/search")
def api_search():
    q        = request.args.get("q", "").strip()
    year     = request.args.get("year", "")
    portal   = request.args.get("portal", "")
    page     = max(1, int(request.args.get("page", 1)))
    per_page = 20
    offset   = (page - 1) * per_page

    if not q and not year and not portal:
        return jsonify({"total": 0, "results": [], "page": 1})

    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    where_parts, params = [], []
    if q:
        # Using PostgreSQL ILIKE for fuzzy trigram matching
        where_parts.append("(org_name ILIKE %s OR title ILIKE %s)")
        params += [f"%{q}%", f"%{q}%"]
    if year:
        where_parts.append("year = %s")
        params.append(int(year))
    if portal:
        where_parts.append("portal_type = %s")
        params.append(portal)

    where_sql = "WHERE " + " AND ".join(where_parts) if where_parts else ""

    cur.execute(f"SELECT COUNT(*) as cnt FROM aoc_tenders {where_sql}", params)
    total = cur.fetchone()["cnt"]
    
    cur.execute(f"""
        SELECT internal_id, org_name, title, year, portal_type, aoc_date, closing_date
        FROM aoc_tenders {where_sql}
        ORDER BY year DESC, aoc_date DESC LIMIT %s OFFSET %s
    """, params + [per_page, offset])

    return jsonify({"total": total, "page": page, "per_page": per_page,
                    "results": [dict(r) for r in cur.fetchall()]})

# ─────────────────────────────────────────────
# API: NARRATIVE REPORT
# ─────────────────────────────────────────────

@app.route("/api/narrative-report")
def api_narrative_report():
    if os.path.exists(REPORT_FILE):
        try:
            with open(REPORT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Generate markdown formatting if not already attached
            if "markdown" not in data:
                md_lines = []
                exec_sum = data.get("executive_summary", {})
                md_lines.append(f"# {exec_sum.get('title', 'Data Analysis Summary')}\n")
                if exec_sum.get("paragraph_1"): md_lines.append(f"{exec_sum['paragraph_1']}\n")
                if exec_sum.get("paragraph_2"): md_lines.append(f"{exec_sum['paragraph_2']}\n")
                if exec_sum.get("paragraph_3"): md_lines.append(f"{exec_sum['paragraph_3']}\n")
                
                md_lines.append("\n## Key Audit Findings\n")
                for item in data.get("findings", []):
                    sev = item.get("severity", "INFO")
                    title = item.get("title", "Finding")
                    md_lines.append(f"### [{sev}] {title}\n")
                    if item.get("summary"): md_lines.append(f"**Summary:** {item['summary']}\n")
                    if item.get("explanation"): md_lines.append(f"**Explanation:** {item['explanation']}\n")
                    if item.get("what_it_means"): md_lines.append(f"**What It Means:** {item['what_it_means']}\n")
                    if item.get("next_steps"):
                        md_lines.append("**Recommended Next Steps:**")
                        for step in item["next_steps"]:
                            md_lines.append(f"- {step}")
                        md_lines.append("")
                data["markdown"] = "\n".join(md_lines)
            
            return jsonify(data)
        except Exception as e:
            return jsonify({"error": f"Error loading report: {str(e)}"}), 500

    # Fallback: Generate dynamic summary from PostgreSQL if narrative_report.json not found
    try:
        conn = get_pg_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT COUNT(*) as total_contracts, SUM(contract_value)/10000000.0 as total_value_cr FROM aoc_tenders")
        row = cur.fetchone() or {}
        conn.close()
        
        c_count = row.get("total_contracts", 0)
        c_val = round(row.get("total_value_cr", 0) or 0, 2)
        
        md_text = f"""# Executive Procurement Analysis Report

This analysis covers **{c_count:,}** awarded contracts with a total spending value of **₹{c_val:,.2f} Crore**.

## Summary Highlights
- **Contract Coverage:** Automated profiling active across central and state portals.
- **Single-Bid Flagging:** High-value tenders with single bidder participation are monitored in the Investigation Desk.
- **Repeat Winner Audit:** Vendor department concentration is indexed for structural risk analysis.
"""
        return jsonify({
          "executive_summary": {
            "title": "Executive Procurement Analysis Report",
            "paragraph_1": f"This analysis covers {c_count:,} awarded contracts worth ₹{c_val:,.2f} Crore.",
            "total_findings": 3
          },
          "findings": [],
          "markdown": md_text
        })
    except Exception as e:
        return jsonify({"error": f"Failed to generate dynamic report: {str(e)}"}), 500

# ─────────────────────────────────────────────
# API: TENDER DETAIL
# ─────────────────────────────────────────────

@app.route("/api/tender/<internal_id>")
def api_tender_detail(internal_id):
    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT t.*, d.details_json, d.scraped_at as details_scraped_at
        FROM aoc_tenders t LEFT JOIN aoc_details d ON t.internal_id = d.internal_id
        WHERE t.internal_id = %s
    """, (internal_id,))
    row = cur.fetchone()
    if not row:
        abort(404)
    result = dict(row)
    if result.get("details_json"):
        result["details"] = result.pop("details_json")
    else:
        result["details"] = {}
    return jsonify(result)


# ─────────────────────────────────────────────
# API: COMPANY & DIRECTOR NETWORK GRAPH
# ─────────────────────────────────────────────

@app.route("/api/network/search")
def api_network_search():
    """Search for corporate entities or buyers inside the network graph."""
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"results": []})
    
    conn = get_pg_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT id, label, kind, state, email, value, n_contracts, n_buyers
            FROM network_nodes
            WHERE label ILIKE %s OR id ILIKE %s OR email ILIKE %s
            ORDER BY n_contracts DESC LIMIT 30
        """, (f"%{q}%", f"%{q}%", f"%{q}%"))
        results = [dict(row) for row in cur.fetchall()]
        return jsonify({"results": results})
    except Exception:
        return jsonify({"error": "No network analysis data available. Place nodes.csv and edges.csv in data_dump/ and re-analyse."}), 404


@app.route("/api/network/ego/<node_id>")
def api_network_ego(node_id):
    """Fetch 1-hop ego network around a specific node (nodes and links)."""
    conn = get_pg_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Get edges
        cur.execute("""
            SELECT source, target, relationship, weight, total_value, label
            FROM network_edges
            WHERE source = %s OR target = %s
        """, (node_id, node_id))
        edges = [dict(row) for row in cur.fetchall()]
        
        # Collect unique node IDs in this ego subgraph
        node_ids = {node_id}
        for e in edges:
            node_ids.add(e["source"])
            node_ids.add(e["target"])
            
        # Retrieve details for all connected nodes
        nodes = []
        if node_ids:
            ph = ",".join(["%s"] * len(node_ids))
            cur.execute(f"""
                SELECT id, label, kind, state, email, value, n_contracts, n_buyers
                FROM network_nodes
                WHERE id IN ({ph})
            """, list(node_ids))
            nodes = [dict(row) for row in cur.fetchall()]
            
        return jsonify({
            "focus": node_id,
            "nodes": nodes,
            "edges": edges
        })
    except Exception:
        return jsonify({"error": "No network analysis data available."}), 404



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

@app.route('/api/sanctions')
def api_sanctions():
    conn = get_pg_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('''
        SELECT s.bidder_name, s.sanction_id, s.schema, s.matched_name, s.dataset, n.value, n.n_contracts 
        FROM sanction_matches s 
        LEFT JOIN network_nodes n ON s.bidder_name = n.label 
        ORDER BY n.value DESC
    ''')
    rows = cur.fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    if path.startswith('api/'):
        return jsonify({"error": "Endpoint not found"}), 404
    file_path = os.path.join(STATIC_DIR, path)
    if path != "" and os.path.exists(file_path):
        return send_from_directory(STATIC_DIR, path)
    return send_from_directory(STATIC_DIR, 'index.html')



