from flask import Blueprint, jsonify, request
from core.db import get_pg_conn
from psycopg2.extras import RealDictCursor
from core.cache import cache

tenders_bp = Blueprint('tenders', __name__)

@tenders_bp.route("/api/tender/<internal_id>")
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

@tenders_bp.route('/api/sanctions')
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
