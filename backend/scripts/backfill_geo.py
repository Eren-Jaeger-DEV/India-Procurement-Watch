import os
import psycopg2
import time

DB_URL = os.getenv("DATABASE_URL", "postgresql://darshi2026:srwo4ubGB3EQeaxy26hi05Nj@100.112.20.56:5432/darshi")

STATES = [
    "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", 
    "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", 
    "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", 
    "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", 
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", 
    "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", 
    "Uttar Pradesh", "Uttarakhand", "West Bengal"
]

def extract_location(address_str):
    if not address_str:
        return None, None
    
    parts = [p.strip() for p in address_str.split(",")]
    if len(parts) < 3:
        return None, None
        
    country = parts[-1]
    if country.lower() != "india":
        return None, None
        
    # Check if second to last is a postal code
    offset = 2
    if parts[-2].isdigit():
        offset = 3
        
    if len(parts) < offset + 1:
        return None, None
        
    state = parts[-offset]
    city = parts[-(offset + 1)] if len(parts) >= offset + 1 else None
    
    if city and " district" in city.lower() and len(parts) >= offset + 2:
        city = parts[-(offset + 2)]
        
    if city:
        city = city.replace(" Division", "").replace(" District", "")
        
    # Normalize state name if possible
    for s in STATES:
        if s.lower() in state.lower():
            state = s
            break
            
    return state, city

def run_backfill():
    print(f"Connecting to DB...")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    
    with conn.cursor() as cur:
        # 1. Ensure columns exist
        print("Adding columns...")
        cur.execute("ALTER TABLE aoc_geocoded ADD COLUMN IF NOT EXISTS state TEXT;")
        cur.execute("ALTER TABLE aoc_geocoded ADD COLUMN IF NOT EXISTS city TEXT;")
        conn.commit()
        
        # 2. Fetch records that need backfilling
        print("Fetching records to update (RE-RUN)...")
        cur.execute("SELECT internal_id, resolved_address FROM aoc_geocoded WHERE resolved_address IS NOT NULL")
        rows = cur.fetchall()
        print(f"Found {len(rows)} records to update.")
        
        if not rows:
            print("No records need backfilling.")
            return

        # 3. Batch update
        batch_size = 5000
        updates = []
        
        start_time = time.time()
        from psycopg2.extras import execute_values
        
        for idx, (internal_id, address) in enumerate(rows):
            state, city = extract_location(address)
            
            if state or city:
                updates.append((state, city, internal_id))
                
            if len(updates) >= batch_size:
                query = "UPDATE aoc_geocoded SET state = data.state, city = data.city FROM (VALUES %s) AS data (state, city, internal_id) WHERE aoc_geocoded.internal_id = data.internal_id"
                execute_values(cur, query, updates)
                conn.commit()
                updates = []
                print(f"Processed {idx + 1}/{len(rows)} rows... ({(idx+1)/len(rows)*100:.1f}%)")
        
        # flush remaining
        if updates:
            query = "UPDATE aoc_geocoded SET state = data.state, city = data.city FROM (VALUES %s) AS data (state, city, internal_id) WHERE aoc_geocoded.internal_id = data.internal_id"
            execute_values(cur, query, updates)
            conn.commit()
            
        print(f"✅ Backfill complete in {time.time() - start_time:.1f} seconds")

        print("Adding indexes...")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_geocoded_state ON aoc_geocoded(state);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_geocoded_city ON aoc_geocoded(city);")
        conn.commit()
        print("✅ Indexes created")

if __name__ == "__main__":
    run_backfill()
