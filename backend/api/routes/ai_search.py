import json
from flask import Blueprint, jsonify, request, Response
from core.db import get_pg_conn
from psycopg2.extras import RealDictCursor
from analysis.ai_chat import ask_database


ai_search_bp = Blueprint('ai_search', __name__)

@ai_search_bp.route("/api/agentic-search", methods=["POST"])
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
@ai_search_bp.route("/api/ai-chat", methods=["POST"])
def api_ai_chat():
    from analysis.ai_chat import ask_database
    from flask import Response
    data = request.get_json() or {}
    text = data.get("text", "")[:2000]
    model = data.get("model", "claude-opus-4-8")
    if not text.strip():
        return jsonify({"error": "No query provided"}), 400
        
    return Response(ask_database(text, model=model), mimetype="text/event-stream")

@ai_search_bp.route("/api/search")
def api_search():
    q          = request.args.get("q", "").strip()
    year       = request.args.get("year", "")
    portal     = request.args.get("portal", "")
    bidder     = request.args.get("bidder", "").strip()
    single_bid = request.args.get("single_bid", "").lower() in ("1", "true")
    page       = max(1, int(request.args.get("page", 1)))
    per_page   = 25
    offset     = (page - 1) * per_page

    conn = get_pg_conn()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    where_parts, params = [], []
    
    if single_bid:
        # Query single_bid_contracts table for fast single-bid searching
        if q:
            where_parts.append("(org_name ILIKE %s OR title ILIKE %s OR bidder_name ILIKE %s OR ref_no ILIKE %s)")
            params += [f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%"]
        if bidder:
            where_parts.append("bidder_name ILIKE %s")
            params.append(f"%{bidder}%")
        if portal:
            where_parts.append("portal_type = %s")
            params.append(portal)

        where_sql = "WHERE " + " AND ".join(where_parts) if where_parts else ""

        cur.execute(f"SELECT COUNT(*) as cnt FROM single_bid_contracts {where_sql}", params)
        total = cur.fetchone()["cnt"]

        cur.execute(f"""
            SELECT internal_id, org_name, title, contract_value, aoc_date, portal_type, bidder_name, ref_no, 1 as is_single_bid
            FROM single_bid_contracts {where_sql}
            ORDER BY contract_value DESC LIMIT %s OFFSET %s
        """, params + [per_page, offset])

    else:
        # Query main 4.9M aoc_tenders table
        if q:
            where_parts.append("(org_name ILIKE %s OR title ILIKE %s OR ref_no ILIKE %s OR tender_id ILIKE %s)")
            params += [f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%"]
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
            SELECT internal_id, org_name, title, year, portal_type, aoc_date, closing_date, ref_no, tender_id, detail_url
            FROM aoc_tenders {where_sql}
            ORDER BY year DESC, aoc_date DESC NULLS LAST LIMIT %s OFFSET %s
        """, params + [per_page, offset])

    return jsonify({
        "total": total, 
        "page": page, 
        "per_page": per_page,
        "results": [dict(r) for r in cur.fetchall()]
    })

