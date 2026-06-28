import os
import sqlite3
import time
import json
from collections import defaultdict

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AOC_DB = os.path.join(BASE_DIR, "data_dump", "aoc_tenders.db")
SUM_DB = os.path.join(BASE_DIR, "summary.db")

def log(msg):
    print(f"[build_cartels] {msg}")

def parse_contract_value(val_str):
    if not val_str: return None
    v = str(val_str).replace(",", "").strip()
    if v.startswith("₹") or v.startswith("INR"):
        v = v.replace("₹", "").replace("INR", "").strip()
    try:
        return float(v)
    except Exception:
        return None

def main():
    if not os.path.exists(AOC_DB) or not os.path.exists(SUM_DB):
        log("Missing aoc_tenders.db or summary.db. Skipping cartel detection.")
        return

    sum_conn = sqlite3.connect(SUM_DB)
    sum_conn.row_factory = sqlite3.Row
    sum_cur = sum_conn.cursor()

    # 1. Check if network graph exists
    sum_cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='network_edges'")
    if not sum_cur.fetchone():
        log("No network graph data found (network_edges table missing). Skipping cartel detection.")
        return

    log("Phase 1: Loading Network Graph...")
    # Load connected components using a simple Union-Find
    parent = {}
    def find(i):
        if parent[i] == i: return i
        parent[i] = find(parent[i])
        return parent[i]
    def union(i, j):
        root_i = find(i)
        root_j = find(j)
        if root_i != root_j:
            parent[root_i] = root_j

    sum_cur.execute("SELECT source, target FROM network_edges")
    edges = sum_cur.fetchall()
    
    # Initialize disjoint set
    for r in edges:
        s, t = r['source'], r['target']
        if s not in parent: parent[s] = s
        if t not in parent: parent[t] = t

    for r in edges:
        union(r['source'], r['target'])
        
    # Build cluster map: cluster_id -> set of company names
    clusters = defaultdict(set)
    for node in parent.keys():
        root = find(node)
        clusters[root].add(node)
    
    # Filter for clusters that have more than 1 company (Cartel Rings)
    cartel_clusters = {k: v for k, v in clusters.items() if len(v) > 1}
    log(f"  Found {len(cartel_clusters)} potential corporate clusters (Cartel Rings).")

    # If no clusters, nothing to do
    if not cartel_clusters:
        return

    log("Phase 2: Scanning AOC Data for Bid Rotation...")
    aoc_conn = sqlite3.connect(AOC_DB)
    aoc_conn.row_factory = sqlite3.Row
    aoc_cur = aoc_conn.cursor()

    # We need to map org_name -> {bidder_name: total_value}
    # To save time, we will only map bidders that belong to a cartel cluster
    cartel_bidders = set()
    for c in cartel_clusters.values():
        cartel_bidders.update(c)

    log("  Loading AOC details...")
    aoc_cur.execute("SELECT internal_id, details_json FROM aoc_details")
    lookup = {}
    for row in aoc_cur:
        iid, djson = row['internal_id'], row['details_json']
        if not djson: continue
        try:
            d = json.loads(djson)
            bidder = str(d.get("Name of the selected bidder(s)", "") or "").strip()[:200]
            val = parse_contract_value(d.get("Contract Value"))
            if bidder in cartel_bidders:
                lookup[iid] = (bidder, val or 0.0)
        except Exception:
            pass

    log(f"  Matched {len(lookup)} contracts to cartel ring members.")

    log("  Correlating with Organizations...")
    org_cartel_wins = defaultdict(lambda: defaultdict(float)) # org_name -> {bidder: total_value}
    
    # Process in batches to avoid loading full aoc_tenders in memory
    aoc_cur.execute("SELECT internal_id, org_name FROM aoc_tenders")
    for row in aoc_cur:
        iid, org = row['internal_id'], row['org_name']
        if iid in lookup and org:
            bidder, val = lookup[iid]
            org_cartel_wins[org][bidder] += val

    # 3. Detect Bid Rotation
    # A bid rotation is flagged when multiple companies from the SAME cluster win contracts from the SAME organization
    
    # Reverse map: bidder -> cluster_id
    bidder_to_cluster = {}
    for cid, members in cartel_clusters.items():
        for m in members:
            bidder_to_cluster[m] = cid

    cartel_results = []
    
    for org, bidders in org_cartel_wins.items():
        # group winning bidders by cluster
        cluster_wins = defaultdict(list) # cluster_id -> [(bidder, value)]
        for b, v in bidders.items():
            cid = bidder_to_cluster.get(b)
            if cid:
                cluster_wins[cid].append((b, v))
                
        # If a cluster has > 1 distinct winning company in this org, it's a cartel!
        for cid, wins in cluster_wins.items():
            if len(wins) > 1:
                # We found a bid rotation ring
                companies = [w[0] for w in wins]
                total_val = sum(w[1] for w in wins)
                cartel_results.append((
                    cid, org, 
                    ", ".join(companies), 
                    len(companies), 
                    total_val
                ))

    log(f"Phase 3: Saving {len(cartel_results)} confirmed Cartel Rings to summary.db...")
    sum_cur.execute("DROP TABLE IF EXISTS cartel_rings")
    sum_cur.execute("""
        CREATE TABLE cartel_rings (
            cluster_id TEXT,
            org_name TEXT,
            companies TEXT,
            company_count INTEGER,
            total_value_crore REAL
        )
    """)
    
    insert_rows = []
    for r in cartel_results:
        insert_rows.append((r[0], r[1], r[2], r[3], round(r[4]/10000000, 4)))
        
    sum_cur.executemany(
        "INSERT INTO cartel_rings VALUES (?,?,?,?,?)",
        insert_rows
    )
    
    sum_conn.commit()
    log("✓ Cartel detection complete.")

if __name__ == "__main__":
    t0 = time.time()
    main()
    print(f"[build_cartels] Finished in {time.time() - t0:.1f}s")
