"""
MCA Bulk Extractor (mca_bulk_extractor.py)
=========================================
A standalone side-project script to process Ministry of Corporate Affairs (MCA) 
"Company Master Data" CSVs downloaded from data.gov.in.

This script parses the CSV files, normalizes the data, and stores it in an 
optimized SQLite database (`mca_companies.db`) for extremely fast lookups 
and fuzzy matching by the main dashboard.

Usage:
    python mca_bulk_extractor.py --csv /path/to/mca_data.csv
    python mca_bulk_extractor.py --dir /path/to/csv_folder
"""

import os
import sys
import csv
import glob
import sqlite3
import argparse
import urllib.request
from datetime import datetime

# ─────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────
DB_NAME = "mca_companies.db"

# Expected column mappings (data.gov.in CSVs can sometimes vary slightly)
# We will do fuzzy column matching if needed, but these are standard:
COL_CIN = "CIN"
COL_NAME = "COMPANY_NAME"
COL_ROC = "ROC_CODE"
COL_REG_DATE = "DATE_OF_REGISTRATION"
COL_CAPITAL = "PAIDUP_CAPITAL"
COL_STATUS = "COMPANY_STATUS"
COL_STATE = "REGISTERED_STATE"

def init_db(db_path):
    """Initialize the SQLite database with the optimal schema for fast text lookup."""
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    cur.execute('''
        CREATE TABLE IF NOT EXISTS companies (
            cin TEXT PRIMARY KEY,
            company_name TEXT,
            normalized_name TEXT,
            roc_code TEXT,
            registration_date TEXT,
            paid_up_capital REAL,
            company_status TEXT,
            registered_state TEXT
        )
    ''')
    
    # Create indexes for rapid searching
    cur.execute('CREATE INDEX IF NOT EXISTS idx_company_name ON companies(company_name)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_normalized_name ON companies(normalized_name)')
    
    conn.commit()
    return conn

def normalize_name(name):
    """Normalize company name for fuzzy matching (e.g. remove PRIVATE LIMITED, LTD)."""
    if not name:
        return ""
    name = name.upper().strip()
    name = name.replace("PRIVATE LIMITED", "PVT LTD")
    name = name.replace(" LIMITED", " LTD")
    # Remove special characters
    name = ''.join(e for e in name if e.isalnum() or e.isspace())
    return " ".join(name.split())

def parse_capital(val):
    try:
        return float(str(val).replace(',', '').strip())
    except ValueError:
        return 0.0

def process_csv(csv_path, conn):
    """Parse a single CSV file and insert into the database."""
    print(f"Processing: {csv_path}")
    cur = conn.cursor()
    
    with open(csv_path, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        
        # Standardize headers (lowercase for easier matching)
        headers = {h.strip().upper(): h for h in reader.fieldnames if h}
        
        # Find actual column names in this specific CSV
        cin_key = headers.get(COL_CIN) or headers.get("CORPORATE_IDENTIFICATION_NUMBER")
        name_key = headers.get(COL_NAME) or headers.get("COMPANY NAME")
        roc_key = headers.get(COL_ROC) or headers.get("ROC")
        reg_date_key = headers.get(COL_REG_DATE) or headers.get("DATE OF REGISTRATION")
        cap_key = headers.get(COL_CAPITAL) or headers.get("PAIDUP CAPITAL")
        status_key = headers.get(COL_STATUS) or headers.get("COMPANY STATUS")
        state_key = headers.get(COL_STATE) or headers.get("STATE")
        
        if not cin_key or not name_key:
            print(f"  [ERROR] Missing required CIN or COMPANY_NAME columns in {csv_path}")
            return
            
        rows_to_insert = []
        count = 0
        
        for row in reader:
            cin = row.get(cin_key, "").strip()
            name = row.get(name_key, "").strip()
            
            if not cin or not name:
                continue
                
            norm_name = normalize_name(name)
            roc = row.get(roc_key, "").strip() if roc_key else ""
            reg_date = row.get(reg_date_key, "").strip() if reg_date_key else ""
            cap = parse_capital(row.get(cap_key, 0)) if cap_key else 0.0
            status = row.get(status_key, "").strip() if status_key else ""
            state = row.get(state_key, "").strip() if state_key else ""
            
            rows_to_insert.append((cin, name, norm_name, roc, reg_date, cap, status, state))
            count += 1
            
            # Batch insert every 10,000 rows
            if len(rows_to_insert) >= 10000:
                cur.executemany('''
                    INSERT OR REPLACE INTO companies 
                    (cin, company_name, normalized_name, roc_code, registration_date, paid_up_capital, company_status, registered_state)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', rows_to_insert)
                rows_to_insert = []
                print(f"  Inserted {count} rows...")
                
        # Insert remaining
        if rows_to_insert:
            cur.executemany('''
                INSERT OR REPLACE INTO companies 
                (cin, company_name, normalized_name, roc_code, registration_date, paid_up_capital, company_status, registered_state)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', rows_to_insert)
            
        conn.commit()
        print(f"  [SUCCESS] Completed {csv_path}. Total records inserted/updated: {count}")

def main():
    parser = argparse.ArgumentParser(description="Extract and Load MCA Bulk Data from CSV into SQLite.")
    parser.add_argument("--csv", help="Path to a single MCA CSV file")
    parser.add_argument("--dir", help="Path to a directory containing multiple MCA CSV files")
    parser.add_argument("--url", help="Direct URL to download an MCA CSV file")
    args = parser.parse_args()
    
    if not args.csv and not args.dir and not args.url:
        parser.print_help()
        print("\nNote: Please download the Company Master Data CSVs from data.gov.in and pass the path.")
        sys.exit(1)
        
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), DB_NAME)
    print(f"Initializing database at: {db_path}")
    conn = init_db(db_path)
    
    if args.csv:
        if os.path.exists(args.csv):
            process_csv(args.csv, conn)
        else:
            print(f"File not found: {args.csv}")
            
    if args.dir:
        if os.path.exists(args.dir) and os.path.isdir(args.dir):
            csv_files = glob.glob(os.path.join(args.dir, "*.csv"))
            print(f"Found {len(csv_files)} CSV files in directory.")
            for f in csv_files:
                process_csv(f, conn)
        else:
            print(f"Directory not found: {args.dir}")
            
    if args.url:
        print(f"Downloading dataset from URL: {args.url}")
        tmp_file = "temp_mca_download.csv"
        try:
            urllib.request.urlretrieve(args.url, tmp_file)
            print("Download complete. Processing...")
            process_csv(tmp_file, conn)
        except Exception as e:
            print(f"Failed to download or process URL: {e}")
        finally:
            if os.path.exists(tmp_file):
                os.remove(tmp_file)
            
    conn.close()
    print("All processing complete!")

if __name__ == "__main__":
    main()
