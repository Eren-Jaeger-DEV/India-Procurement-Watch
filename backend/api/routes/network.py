from flask import Blueprint, jsonify, request
from core.db import get_pg_conn
from psycopg2.extras import RealDictCursor

network_bp = Blueprint('network', __name__)

@network_bp.route("/api/network/search")
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

@network_bp.route("/api/network/ego/<node_id>")
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
