import urllib.request
import csv
import sqlite3
import os
import time

DB_PATH = 'data_dump/sanctions.db'
URL = 'https://data.opensanctions.org/datasets/latest/default/targets.simple.csv'

def main():
    print(f"Downloading OpenSanctions dataset from {URL}...")
    
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    cur.execute('''
        CREATE TABLE indian_entities (
            id TEXT PRIMARY KEY,
            schema TEXT,
            name TEXT,
            aliases TEXT,
            birth_date TEXT,
            countries TEXT,
            addresses TEXT,
            identifiers TEXT,
            sanctions TEXT,
            dataset TEXT
        )
    ''')
    conn.commit()
    
    try:
        req = urllib.request.urlopen(URL, timeout=30)
    except Exception as e:
        print(f"Error downloading OpenSanctions dataset: {e}")
        print("Please check your internet connection or try again later.")
        conn.close()
        return
        
    lines = (line.decode('utf-8') for line in req)
    reader = csv.reader(lines)
    
    headers = next(reader)
    # ["id","schema","name","aliases","birth_date","countries","addresses","identifiers","sanctions","phones","emails","program_ids","dataset","first_seen","last_seen","last_change"]
    
    col_idx = {h: i for i, h in enumerate(headers)}
    
    count = 0
    indian_count = 0
    batch = []
    
    t0 = time.time()
    for row in reader:
        count += 1
        countries = row[col_idx['countries']].lower()
        if 'in' in countries.split(';'):
            indian_count += 1
            batch.append((
                row[col_idx['id']],
                row[col_idx['schema']],
                row[col_idx['name']],
                row[col_idx['aliases']],
                row[col_idx['birth_date']],
                row[col_idx['countries']],
                row[col_idx['addresses']],
                row[col_idx['identifiers']],
                row[col_idx['sanctions']],
                row[col_idx['dataset']]
            ))
            
        if len(batch) >= 1000:
            cur.executemany('''
                INSERT OR REPLACE INTO indian_entities 
                (id, schema, name, aliases, birth_date, countries, addresses, identifiers, sanctions, dataset)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', batch)
            conn.commit()
            batch = []
            
        if count % 100000 == 0:
            print(f"Processed {count} records, found {indian_count} Indian entities... ({time.time()-t0:.1f}s)")
            
    if batch:
        cur.executemany('''
            INSERT OR REPLACE INTO indian_entities 
            (id, schema, name, aliases, birth_date, countries, addresses, identifiers, sanctions, dataset)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', batch)
        conn.commit()
        
    cur.execute("CREATE INDEX idx_name ON indian_entities(name);")
    conn.commit()
    conn.close()
    
    print(f"Finished! Total records processed: {count}")
    print(f"Total Indian entities saved: {indian_count}")

if __name__ == '__main__':
    main()
