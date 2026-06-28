"""
app.py
======
Flask API backend for India Procurement Watch — Power Analysis Tool.
Serves pre-computed data from summary.db and live search from aoc_tenders.db.
Includes new endpoints for analysis triggering, progress polling, and narrative reports.
"""

import sqlite3
import json
import os
import re as _re
import threading
from flask import Flask, jsonify, request, send_from_directory, abort, g
from flask_cors import CORS

# ─────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
SUM_DB     = os.path.join(BASE_DIR, "summary.db")
AOC_DB     = os.path.join(BASE_DIR, "aoc_tenders.db")
VPS_DB     = os.path.join(BASE_DIR, "tenders_vps.db")
SEARCH_DB  = os.path.join(BASE_DIR, "search.db")
STATIC_DIR = os.path.join(BASE_DIR, "frontend")
STATE_FILE = os.path.join(BASE_DIR, "analysis_state.json")
REPORT_FILE= os.path.join(BASE_DIR, "narrative_report.json")
DATA_DUMP  = os.path.join(BASE_DIR, "data_dump")

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="")
CORS(app)

# ─────────────────────────────────────────────
# DB HELPERS — request-scoped database connections
# ─────────────────────────────────────────────

def _get_conn(attr, path, read_only=False):
    if not os.path.exists(path):
        return None
    conn = getattr(g, attr, None)
    if conn is None:
        if read_only:
            uri = f"file:{path}?mode=ro"
            conn = sqlite3.connect(uri, uri=True, check_same_thread=False)
            conn.execute("PRAGMA query_only=1")
            conn.execute("PRAGMA cache_size=-32000")
        else:
            conn = sqlite3.connect(path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        setattr(g, attr, conn)
    return conn

def get_sum_conn():
    conn = _get_conn('sum', SUM_DB)
    if conn is None:
        abort(503, description="summary.db not found. Run analysis first.")
    return conn

def get_aoc_conn():
    conn = _get_conn('aoc', AOC_DB, read_only=True)
    if conn is None:
        abort(503, description="aoc_tenders.db not found.")
    return conn

def get_search_conn():
    conn = _get_conn('search', SEARCH_DB, read_only=True)
    if conn is None:
        abort(503, description="search.db not found.")
    return conn

@app.teardown_appcontext
def close_db(error):
    for attr in ['sum', 'aoc', 'search']:
        conn = getattr(g, attr, None)
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass

def rows_to_list(cursor_result):
    return [dict(row) for row in cursor_result]

# ─────────────────────────────────────────────
# FRONTEND SERVE
# ─────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")

@app.route("/<path:path>")
def static_proxy(path):
    return send_from_directory(STATIC_DIR, path)

# ─────────────────────────────────────────────
# API: STATUS
# ─────────────────────────────────────────────

@app.route("/api/status")
def api_status():
    summary_ready  = os.path.exists(SUM_DB)
    search_ready   = os.path.exists(SEARCH_DB)
    report_ready   = os.path.exists(REPORT_FILE)
    aoc_in_dump    = False
    vps_in_dump    = False

    if os.path.exists(DATA_DUMP):
        files = [f.lower() for f in os.listdir(DATA_DUMP) if f.endswith(".db")]
        aoc_in_dump = any("aoc" in f or ("tender" in f and "vps" not in f) for f in files) or len(files) > 0
        vps_in_dump = any("vps" in f or "published" in f for f in files)

    return jsonify({
        "summary_db_ready":  summary_ready,
        "search_db_ready":   search_ready,
        "report_ready":      report_ready,
        "aoc_db_exists":     os.path.exists(AOC_DB),
        "vps_db_exists":     os.path.exists(VPS_DB),
        "aoc_in_dump":       aoc_in_dump,
        "vps_in_dump":       vps_in_dump,
        "data_dump_path":    DATA_DUMP,
    })

# ─────────────────────────────────────────────
# API: ANALYSIS CONTROL
# ─────────────────────────────────────────────

_analysis_lock = threading.Lock()

@app.route("/api/trigger-analysis", methods=["POST"])
def api_trigger_analysis():
    """Start the analysis pipeline in a background thread."""
    if not _analysis_lock.acquire(blocking=False):
        return jsonify({"error": "Analysis already running."}), 409

    def _run():
        try:
            from analyse import find_db_files, run_analysis, write_state
            aoc_src, vps_src = find_db_files()
            use_existing = (aoc_src is None)
            if use_existing and not os.path.exists(AOC_DB):
                write_state("error", 0, "No .db file found. Drop your file in the data_dump/ folder.", error="No data found", done=True)
                return
            run_analysis(aoc_src=aoc_src, vps_src=vps_src, use_existing=use_existing)
        except Exception as e:
            print(f"Analysis pipeline error: {e}")
        finally:
            _analysis_lock.release()

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    return jsonify({"status": "started", "message": "Analysis pipeline started."})


@app.route("/api/analysis-progress")
def api_analysis_progress():
    """Poll current analysis progress."""
    if not os.path.exists(STATE_FILE):
        # Check if we already have data (from a previous run)
        if os.path.exists(SUM_DB):
            return jsonify({
                "stage": "done", "progress": 100,
                "message": "Analysis data is ready.",
                "done": True
            })
        return jsonify({
            "stage": "idle", "progress": 0,
            "message": "Drop your .db file in the data_dump/ folder and click Analyse Data.",
            "done": False
        })
    try:
        with open(STATE_FILE, encoding="utf-8") as f:
            return jsonify(json.load(f))
    except Exception:
        return jsonify({"stage": "idle", "progress": 0, "message": "No analysis running.", "done": False})


@app.route("/api/narrative-report")
def api_narrative_report():
    """Return the full narrative analysis report."""
    if not os.path.exists(REPORT_FILE):
        return jsonify({"error": "Report not generated yet. Run analysis first."}), 404
    try:
        with open(REPORT_FILE, encoding="utf-8") as f:
            return jsonify(json.load(f))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
# API: KPIs
# ─────────────────────────────────────────────

@app.route("/api/kpis")
def api_kpis():
    if not os.path.exists(SUM_DB):
        return jsonify({"error": "summary.db not found. Run analysis first."}), 503
    conn = get_sum_conn()
    cur = conn.cursor()
    cur.execute("SELECT key, value FROM kpi_stats")
    data = {row["key"]: row["value"] for row in cur.fetchall()}
    return jsonify(data)

# ─────────────────────────────────────────────
# API: TRENDS
# ─────────────────────────────────────────────

MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

@app.route("/api/trends")
def api_trends():
    grain   = request.args.get("grain", "monthly")
    dataset = request.args.get("dataset", "aoc")

    conn = get_sum_conn()
    cur  = conn.cursor()

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

# ─────────────────────────────────────────────
# API: TOP ORGS
# ─────────────────────────────────────────────

@app.route("/api/top-orgs")
def api_top_orgs():
    by      = request.args.get("by", "count")
    limit   = min(int(request.args.get("limit", 25)), 100)
    dataset = request.args.get("dataset", "aoc")

    conn = get_sum_conn()
    cur  = conn.cursor()

    if dataset == "published":
        cur.execute(f"SELECT org_name, count FROM top_published_orgs ORDER BY count DESC LIMIT {limit}")
        rows = cur.fetchall()
        return jsonify({"labels": [r["org_name"] for r in rows],
                        "values": [r["count"] for r in rows], "metric": "count"})

    if by == "value":
        cur.execute(f"""
            SELECT org_name, total_value_crore, count FROM top_orgs
            WHERE total_value_crore > 0 ORDER BY total_value_crore DESC LIMIT {limit}
        """)
    else:
        cur.execute(f"SELECT org_name, count, total_value_crore FROM top_orgs ORDER BY count DESC LIMIT {limit}")

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
    conn = get_sum_conn()
    cur  = conn.cursor()
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
    conn = get_sum_conn()
    cur  = conn.cursor()
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
    conn = get_sum_conn()
    cur  = conn.cursor()
    cur.execute("SELECT portal_type, count FROM portal_breakdown ORDER BY count DESC")
    rows = cur.fetchall()
    return jsonify({"labels": [r["portal_type"] for r in rows],
                    "counts": [r["count"] for r in rows]})

# ─────────────────────────────────────────────
# API: VALUE DISTRIBUTION
# ─────────────────────────────────────────────

@app.route("/api/value-distribution")
def api_value_dist():
    conn = get_sum_conn()
    cur  = conn.cursor()
    cur.execute("SELECT bracket, count FROM value_brackets ORDER BY min_val")
    rows = cur.fetchall()
    return jsonify({"labels": [r["bracket"] for r in rows],
                    "counts": [r["count"] for r in rows]})

# ─────────────────────────────────────────────
# API: ANOMALIES
# ─────────────────────────────────────────────

@app.route("/api/anomalies")
def api_anomalies():
    atype    = request.args.get("type", "round_number")
    page     = max(1, int(request.args.get("page", 1)))
    per_page = 20
    offset   = (page - 1) * per_page

    conn = get_sum_conn()
    cur  = conn.cursor()

    cur.execute("SELECT COUNT(*) as cnt FROM anomalies WHERE anom_type=?", (atype,))
    total = cur.fetchone()["cnt"]

    cur.execute("""
        SELECT anom_type, internal_id, org_name, title,
               contract_value, aoc_date, portal_type, extra_info
        FROM anomalies WHERE anom_type=?
        ORDER BY contract_value DESC LIMIT ? OFFSET ?
    """, (atype, per_page, offset))

    rows = []
    for r in cur.fetchall():
        row = dict(r)
        if row.get("extra_info"):
            try:
                row["extra_info"] = json.loads(row["extra_info"])
            except Exception:
                pass
        rows.append(row)

    return jsonify({"total": total, "page": page, "per_page": per_page, "results": rows})

# ─────────────────────────────────────────────
# API: SINGLE-BID CONTRACTS
# ─────────────────────────────────────────────

@app.route("/api/single-bid-contracts")
def api_single_bid():
    page     = max(1, int(request.args.get("page", 1)))
    per_page = 20
    offset   = (page - 1) * per_page
    min_val  = float(request.args.get("min_val", 0))

    conn = get_sum_conn()
    cur  = conn.cursor()

    cur.execute("SELECT COUNT(*) as cnt FROM single_bid_contracts WHERE contract_value >= ?", (min_val,))
    total = cur.fetchone()["cnt"]

    cur.execute("""
        SELECT internal_id, org_name, title, contract_value,
               aoc_date, portal_type, bidder_name, ref_no
        FROM single_bid_contracts WHERE contract_value >= ?
        ORDER BY contract_value DESC LIMIT ? OFFSET ?
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

    conn = get_sum_conn()
    cur  = conn.cursor()

    cur.execute("SELECT COUNT(*) as cnt FROM repeat_winners WHERE wins >= ?", (min_wins,))
    total = cur.fetchone()["cnt"]

    cur.execute("""
        SELECT rank_n, bidder_name, org_name, wins, total_value_crore, first_win, last_win
        FROM repeat_winners WHERE wins >= ?
        ORDER BY wins DESC LIMIT ? OFFSET ?
    """, (min_wins, per_page, offset))

    return jsonify({"total": total, "page": page, "per_page": per_page,
                    "results": [dict(r) for r in cur.fetchall()]})

@app.route("/api/cartels")
def api_cartels():
    page     = max(1, int(request.args.get("page", 1)))
    per_page = 20
    offset   = (page - 1) * per_page

    conn = get_sum_conn()
    cur  = conn.cursor()

    try:
        cur.execute("SELECT COUNT(*) as cnt FROM cartel_rings")
        total = cur.fetchone()["cnt"]

        cur.execute("""
            SELECT cluster_id, org_name, companies, company_count, total_value_crore
            FROM cartel_rings
            ORDER BY total_value_crore DESC LIMIT ? OFFSET ?
        """, (per_page, offset))

        return jsonify({"total": total, "page": page, "per_page": per_page,
                        "results": [dict(r) for r in cur.fetchall()]})
    except sqlite3.OperationalError:
        return jsonify({"error": "No cartel data found. Make sure to generate nodes.csv and run the cartel detector."}), 404

@app.route("/api/live-alerts")
def api_live_alerts():
    page     = max(1, int(request.args.get("page", 1)))
    per_page = 20
    offset   = (page - 1) * per_page

    conn = get_sum_conn()
    cur  = conn.cursor()

    try:
        cur.execute("SELECT COUNT(*) as cnt FROM live_alerts")
        total = cur.fetchone()["cnt"]

        cur.execute("""
            SELECT tender_id, org_name, title, contract_value, ml_risk_score, nlp_flag
            FROM live_alerts
            ORDER BY ml_risk_score DESC LIMIT ? OFFSET ?
        """, (per_page, offset))

        return jsonify({"total": total, "page": page, "per_page": per_page,
                        "results": [dict(r) for r in cur.fetchall()]})
    except sqlite3.OperationalError:
        return jsonify({"error": "No live alerts data found. Run build_live_alerts.py."}), 404

# ─────────────────────────────────────────────
# API: REPORT CARDS & STATE STATS
# ─────────────────────────────────────────────

@app.route("/api/report-cards")
def api_report_cards():
    page     = max(1, int(request.args.get("page", 1)))
    per_page = 20
    offset   = (page - 1) * per_page
    sort_by  = request.args.get("sort", "score_asc")
    order_clause = "score ASC" if sort_by == "score_asc" else "total_value_crore DESC"

    conn = get_sum_conn()
    cur  = conn.cursor()

    cur.execute("SELECT COUNT(*) as cnt FROM org_report_cards")
    total = cur.fetchone()["cnt"]

    cur.execute(f"""
        SELECT org_name, total_contracts, total_value_crore, single_bid_pct, round_number_pct, score, grade, ml_risk_score, ml_flag
        FROM org_report_cards
        ORDER BY {order_clause}, total_contracts DESC
        LIMIT ? OFFSET ?
    """, (per_page, offset))

    return jsonify({"total": total, "page": page, "per_page": per_page,
                    "results": [dict(r) for r in cur.fetchall()]})

@app.route("/api/state-stats")
def api_state_stats():
    conn = get_sum_conn()
    cur  = conn.cursor()
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

    conn = get_sum_conn()
    cur  = conn.cursor()

    # Basic stats
    cur.execute("""
        SELECT org_name, total_contracts, total_value_crore, single_bid_pct, round_number_pct, score, grade
        FROM org_report_cards WHERE org_name = ?
    """, (org_name,))
    rc_row = cur.fetchone()
    report_card = dict(rc_row) if rc_row else {}

    # Anomalies for this org
    cur.execute("""
        SELECT anom_type, COUNT(*) as cnt, SUM(contract_value) as total_val
        FROM anomalies WHERE org_name = ?
        GROUP BY anom_type
    """, (org_name,))
    anomaly_summary = [dict(r) for r in cur.fetchall()]

    # Top vendors (repeat winners) for this org
    cur.execute("""
        SELECT bidder_name, wins, total_value_crore, first_win, last_win
        FROM repeat_winners WHERE org_name = ?
        ORDER BY wins DESC LIMIT 10
    """, (org_name,))
    top_vendors = [dict(r) for r in cur.fetchall()]

    # Single bid contracts for this org
    cur.execute("""
        SELECT COUNT(*) as cnt, SUM(contract_value) as total_val
        FROM single_bid_contracts WHERE org_name = ?
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

    conn = get_sum_conn()
    cur  = conn.cursor()

    cur.execute("""
        SELECT org_name, wins, total_value_crore, first_win, last_win
        FROM repeat_winners WHERE bidder_name = ?
        ORDER BY wins DESC
    """, (vendor_name,))
    department_wins = [dict(r) for r in cur.fetchall()]

    cur.execute("""
        SELECT org_name, title, contract_value, aoc_date, portal_type
        FROM single_bid_contracts WHERE bidder_name = ?
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

    findings_html = ""
    for f in findings:
        color = sev_colors.get(f["severity"], "#6b7280")
        emoji = f.get("severity_emoji", "")
        ns_html = "".join(f"<li>{ns}</li>" for ns in f.get("next_steps", []))
        findings_html += f"""
        <div class="finding" style="border-left: 4px solid {color};">
          <div class="finding-header">
            <span class="badge" style="background:{color}">{emoji} {f['severity']}</span>
            <h3>{f['title']}</h3>
          </div>
          <p class="summary">{f['summary']}</p>
          <p>{f['explanation']}</p>
          <div class="box"><strong>What This Could Mean:</strong><p>{f['what_it_means']}</p></div>
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

    findings_html = ""
    for f in findings:
        color = sev_colors.get(f["severity"], "#6b7280")
        emoji = f.get("severity_emoji", "")
        ns_html = "".join(f"<li>{ns}</li>" for ns in f.get("next_steps", []))
        findings_html += f"""
        <div class="finding" style="border-left: 4px solid {color};">
          <div class="finding-header">
            <span class="badge" style="background:{color}">{emoji} {f['severity']}</span>
            <h3>{f['title']}</h3>
          </div>
          <p class="summary">{f['summary']}</p>
          <p>{f['explanation']}</p>
          <div class="box"><strong>What This Could Mean:</strong><p>{f['what_it_means']}</p></div>
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

    if os.path.exists(SEARCH_DB) and q:
        fts_q = _sanitize_fts(q)
        if not fts_q:
            return jsonify({"total": 0, "results": [], "page": 1})

        conn = get_search_conn()
        cur  = conn.cursor()

        extra_where, extra_params = [], []
        if year:
            extra_where.append("year = ?")
            extra_params.append(str(year))
        if portal:
            extra_where.append("portal_type = ?")
            extra_params.append(portal)

        extra_sql = (" AND " + " AND ".join(extra_where)) if extra_where else ""

        try:
            cur.execute(
                f"""SELECT internal_id, org_name, title, year, portal_type, aoc_date, '' as closing_date
                FROM aoc_fts WHERE aoc_fts MATCH ?{extra_sql} LIMIT ? OFFSET ?""",
                [fts_q] + extra_params + [per_page + 1, offset]
            )
            all_rows = cur.fetchall()
        except Exception as e:
            return jsonify({"error": str(e), "total": 0, "results": [], "page": 1}), 400

        has_more = len(all_rows) > per_page
        results  = rows_to_list(all_rows[:per_page])
        total    = (offset + per_page + 1) if has_more else (offset + len(results))
        return jsonify({"total": total, "page": page, "per_page": per_page,
                        "has_more": has_more, "results": results})

    # LIKE fallback
    conn = get_aoc_conn()
    cur  = conn.cursor()

    where_parts, params = [], []
    if q:
        where_parts.append("(org_name LIKE ? OR title LIKE ?)")
        params += [f"%{q}%", f"%{q}%"]
    if year:
        where_parts.append("year = ?")
        params.append(int(year))
    if portal:
        where_parts.append("portal_type = ?")
        params.append(portal)

    where_sql = "WHERE " + " AND ".join(where_parts) if where_parts else ""

    cur.execute(f"SELECT COUNT(*) as cnt FROM aoc_tenders {where_sql}", params)
    total = cur.fetchone()["cnt"]
    cur.execute(f"""
        SELECT internal_id, org_name, title, year, portal_type, aoc_date, closing_date
        FROM aoc_tenders {where_sql}
        ORDER BY year DESC, aoc_date DESC LIMIT ? OFFSET ?
    """, params + [per_page, offset])

    return jsonify({"total": total, "page": page, "per_page": per_page,
                    "results": rows_to_list(cur.fetchall())})

# ─────────────────────────────────────────────
# API: TENDER DETAIL
# ─────────────────────────────────────────────

@app.route("/api/tender/<internal_id>")
def api_tender_detail(internal_id):
    conn = get_aoc_conn()
    cur  = conn.cursor()
    cur.execute("""
        SELECT t.*, d.details_json, d.scraped_at as details_scraped_at
        FROM aoc_tenders t LEFT JOIN aoc_details d ON t.internal_id = d.internal_id
        WHERE t.internal_id = ?
    """, (internal_id,))
    row = cur.fetchone()
    if not row:
        abort(404)
    result = dict(row)
    if result.get("details_json"):
        try:
            result["details"] = json.loads(result.pop("details_json"))
        except Exception:
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
    
    conn = get_sum_conn()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, label, kind, state, email, value, n_contracts, n_buyers
            FROM network_nodes
            WHERE label LIKE ? OR id LIKE ? OR email LIKE ?
            ORDER BY n_contracts DESC LIMIT 30
        """, (f"%{q}%", f"%{q}%", f"%{q}%"))
        results = [dict(row) for row in cur.fetchall()]
        return jsonify({"results": results})
    except sqlite3.OperationalError:
        return jsonify({"error": "No network analysis data available. Place nodes.csv and edges.csv in data_dump/ and re-analyse."}), 404


@app.route("/api/network/ego/<node_id>")
def api_network_ego(node_id):
    """Fetch 1-hop ego network around a specific node (nodes and links)."""
    conn = get_sum_conn()
    cur = conn.cursor()
    try:
        # Get edges
        cur.execute("""
            SELECT source, target, relationship, weight, total_value, label
            FROM network_edges
            WHERE source = ? OR target = ?
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
            ph = ",".join(["?"] * len(node_ids))
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
    except sqlite3.OperationalError:
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
    conn = get_sum_conn()
    cur = conn.cursor()
    cur.execute('''
        SELECT s.bidder_name, s.sanction_id, s.schema, s.matched_name, s.dataset, n.value, n.n_contracts 
        FROM sanction_matches s 
        LEFT JOIN network_nodes n ON s.bidder_name = n.label 
        ORDER BY n.value DESC
    ''')
    rows = cur.fetchall()
    return jsonify([dict(r) for r in rows])

