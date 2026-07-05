import json
from flask import Blueprint, jsonify, request, Response
from core.db import get_pg_conn
from psycopg2.extras import RealDictCursor
from analysis.ai_chat import ask_database
from app import limiter

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
