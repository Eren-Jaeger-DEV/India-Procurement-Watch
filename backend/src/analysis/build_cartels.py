import os
import re
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ENV_FILE = os.path.join(BASE_DIR, ".env")
load_dotenv(ENV_FILE)

def normalize_address(address):
    """Normalize address to find exact matches for bidding rings."""
    if not address:
        return ""
    # Lowercase
    addr = str(address).lower()
    # Remove generic words that might cause false positives
    generic_words = ["road", "street", "st", "rd", "floor", "building", "bldg", "shop", "no", "plot", "phase", "sector", "block", "near", "opp", "opposite"]
    for w in generic_words:
        addr = re.sub(r'\b' + w + r'\b', '', addr)
    # Remove all non-alphanumeric
    addr = re.sub(r'[^a-z0-9]', '', addr)
    return addr

def build_cartels():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found in .env")
        return

    print("Connecting to PostgreSQL...")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1. Create Tables
    print("Creating network tables...")
    cur.execute("""
        DROP TABLE IF EXISTS network_nodes CASCADE;
        DROP TABLE IF EXISTS network_edges CASCADE;
        
        CREATE TABLE network_nodes (
            id TEXT PRIMARY KEY,
            label TEXT,
            kind TEXT,
            state TEXT,
            email TEXT,
            value NUMERIC,
            n_contracts INTEGER,
            n_buyers INTEGER
        );
        
        CREATE TABLE network_edges (
            source TEXT,
            target TEXT,
            relationship TEXT,
            weight INTEGER,
            total_value NUMERIC,
            label TEXT
        );
    """)

    # 2. Extract Data
    print("Extracting AOC details for network analysis...")
    cur.execute("""
        SELECT t.internal_id, t.org_name, d.details_json
        FROM aoc_tenders t
        JOIN aoc_details d ON t.internal_id = d.internal_id
        WHERE d.details_json IS NOT NULL
    """)
    rows = cur.fetchall()

    nodes = {}  # id -> dict
    edges = {}  # (source, target) -> dict

    def add_node(nid, label, kind, value=0, email=''):
        if nid not in nodes:
            nodes[nid] = {
                'id': nid, 'label': label[:100], 'kind': kind,
                'state': 'Unknown', 'email': email, 'value': 0,
                'n_contracts': 0, 'buyers': set()
            }
        nodes[nid]['value'] += float(value or 0)

    def add_edge(source, target, relationship, val=0, label=''):
        pair = tuple(sorted([source, target]))
        key = (pair[0], pair[1], relationship)
        if key not in edges:
            edges[key] = {
                'source': source, 'target': target,
                'relationship': relationship,
                'weight': 0, 'total_value': 0, 'label': label
            }
        edges[key]['weight'] += 1
        edges[key]['total_value'] += float(val or 0)

    print(f"Processing {len(rows)} tenders...")
    for r in rows:
        org_name = r['org_name'] or "Unknown Org"
        org_id = "ORG_" + re.sub(r'[^A-Z0-9]', '', org_name.upper())[:30]
        details = r['details_json']

        # Parse value
        val_str = str(details.get('Contract Value', '0'))
        val_str = re.sub(r'[^\d\.]', '', val_str)
        try:
            val = float(val_str) if val_str else 0.0
        except:
            val = 0.0

        bidder_name = details.get('Name of the selected bidder(s)', '')
        if not bidder_name:
            continue

        bidder_id = "BID_" + re.sub(r'[^A-Z0-9]', '', str(bidder_name).upper())[:30]
        address = details.get('Address of the selected bidder(s)', '')
        
        # Track Organization
        add_node(org_id, org_name, 'buyer', value=val)
        nodes[org_id]['n_contracts'] += 1

        # Track Bidder
        add_node(bidder_id, str(bidder_name), 'supplier', value=val)
        nodes[bidder_id]['n_contracts'] += 1
        nodes[bidder_id]['buyers'].add(org_id)

        # Edge: Org -> Bidder
        add_edge(org_id, bidder_id, 'awarded_to', val, 'Awarded To')

        # Cartel Tracking: Track Shared Address
        norm_addr = normalize_address(address)
        if len(norm_addr) > 15: # Ignore very short/empty addresses
            addr_id = "ADDR_" + norm_addr[:30]
            add_node(addr_id, str(address), 'address', value=0)
            add_edge(bidder_id, addr_id, 'located_at', val, 'Located At')

    # Convert sets to counts
    for n in nodes.values():
        n['n_buyers'] = len(n['buyers'])

    # 3. Insert into Database
    print(f"Inserting {len(nodes)} nodes and {len(edges)} edges into Postgres...")
    
    # Bulk insert nodes
    node_data = [
        (n['id'], n['label'], n['kind'], n['state'], n['email'], n['value'], n['n_contracts'], n['n_buyers'])
        for n in nodes.values()
    ]
    from psycopg2.extras import execute_values
    execute_values(cur, """
        INSERT INTO network_nodes (id, label, kind, state, email, value, n_contracts, n_buyers)
        VALUES %s
    """, node_data)

    # Bulk insert edges
    edge_data = [
        (e['source'], e['target'], e['relationship'], e['weight'], e['total_value'], e['label'])
        for e in edges.values()
    ]
    execute_values(cur, """
        INSERT INTO network_edges (source, target, relationship, weight, total_value, label)
        VALUES %s
    """, edge_data)

    # 4. Create Indexes for API performance
    cur.execute("CREATE INDEX idx_network_nodes_id ON network_nodes(id);")
    cur.execute("CREATE INDEX idx_network_nodes_label ON network_nodes(label);")
    cur.execute("CREATE INDEX idx_network_edges_source ON network_edges(source);")
    cur.execute("CREATE INDEX idx_network_edges_target ON network_edges(target);")

    conn.commit()
    conn.close()
    print("Cartel Network Database built successfully!")

if __name__ == "__main__":
    build_cartels()
