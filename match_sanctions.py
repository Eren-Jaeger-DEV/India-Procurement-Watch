import sqlite3
import re
import time
import difflib
import os

SUM_DB = 'summary.db'
SANCTIONS_DB = 'data_dump/sanctions.db'

def normalize_name(name):
    if not name:
        return ""
    name = str(name).lower()
    # Remove common corporation suffixes for broader matching
    name = re.sub(r'\b(pvt|ltd|limited|private|inc|llc|co|corp|corporation)\b', '', name)
    # Remove all non-alphanumeric chars
    name = re.sub(r'[^a-z0-9]', '', name)
    return name

def main():
    print("Loading Sanctions Database...")
    try:
        s_conn = sqlite3.connect(SANCTIONS_DB)
        s_cur = s_conn.cursor()
        s_cur.execute("SELECT id, schema, name, aliases, dataset FROM indian_entities")
        sanctions_data = s_cur.fetchall()
    except sqlite3.OperationalError:
        print(f"Error: {SANCTIONS_DB} not found. Run build_sanctions.py first.")
        return

    # Build lookup
    # mapping normalized_name -> list of sanction records (id, schema, original_name, dataset)
    lookup = {}
    for row in sanctions_data:
        sid, schema, name, aliases, dataset = row
        
        # Add primary name
        norm_name = normalize_name(name)
        if norm_name and len(norm_name) > 3: # Ignore very short matches
            if norm_name not in lookup:
                lookup[norm_name] = []
            lookup[norm_name].append((sid, schema, name, dataset))
            
        # Add aliases
        if aliases:
            for alias in aliases.split(';'):
                norm_alias = normalize_name(alias)
                if norm_alias and len(norm_alias) > 3:
                    if norm_alias not in lookup:
                        lookup[norm_alias] = []
                    lookup[norm_alias].append((sid, schema, name, dataset)) # keep original name

    print(f"Loaded {len(lookup)} unique normalized names/aliases from OpenSanctions.")

    print("Fetching bidders from summary.db network_nodes...")
    conn = sqlite3.connect('summary.db')
    cur = conn.cursor()
    
    cur.execute("SELECT label FROM network_nodes WHERE kind='COMPANY'")
    all_bidders = set([r[0] for r in cur.fetchall()])
    
    print(f"Found {len(all_bidders)} unique bidders to cross-reference.")
    
    # Create matches table in summary.db
    sum_conn = conn
    sum_cur = cur
    sum_cur.execute("DROP TABLE IF EXISTS sanction_matches")
    sum_cur.execute('''
        CREATE TABLE sanction_matches (
            bidder_name TEXT,
            sanction_id TEXT,
            schema TEXT,
            matched_name TEXT,
            dataset TEXT
        )
    ''')
    
    matches = set() # (bidder_name, sanction_id, schema, matched_name, dataset)
    
    t0 = time.time()
    lookup_keys = list(lookup.keys())
    
    for bidder in all_bidders:
        norm_bidder = normalize_name(bidder)
        if not norm_bidder or len(norm_bidder) <= 3:
            continue
            
        # 1. Exact Match
        if norm_bidder in lookup:
            for s_rec in lookup[norm_bidder]:
                sid, schema, s_name, dataset = s_rec
                matches.add((bidder, sid, schema, s_name, dataset))
        else:
            # 2. Fuzzy Match (Only for strings > 10 chars to avoid false positives)
            if len(norm_bidder) > 10:
                # We use a strict cutoff of 0.90 to find near-perfect matches (e.g. typos)
                close = difflib.get_close_matches(norm_bidder, lookup_keys, n=1, cutoff=0.90)
                if close:
                    best_match = close[0]
                    for s_rec in lookup[best_match]:
                        sid, schema, s_name, dataset = s_rec
                        # Mark as fuzzy match in dataset field
                        matches.add((bidder, sid, schema, s_name, dataset + " (Fuzzy)"))
                
    if matches:
        sum_cur.executemany("INSERT INTO sanction_matches VALUES (?, ?, ?, ?, ?)", list(matches))
        sum_conn.commit()
        
    print(f"Finished in {time.time()-t0:.2f}s")
    print(f"Found {len(matches)} total matches!")
    
    sum_cur.execute("CREATE INDEX idx_match_bidder ON sanction_matches(bidder_name);")
    sum_conn.commit()
    conn.close()
    sum_conn.close()
    s_conn.close()

if __name__ == '__main__':
    main()
