import os
from flask import Blueprint, jsonify, current_app
from core.db import get_pg_conn
from psycopg2.extras import RealDictCursor
# Remove circular import, use current_app or just omit if unused, or import inside function

MCA_DB = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'databases', 'mca.db'))

profiles_bp = Blueprint('profiles', __name__)


@profiles_bp.route("/api/vendor-mca/<path:vendor_name>")
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

@profiles_bp.route("/api/org-profile/<path:org_name>")
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

@profiles_bp.route("/api/vendor-profile/<path:vendor_name>")
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
