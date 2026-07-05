import sqlite3
import pandas as pd
from sqlalchemy import create_engine
import os
import sys

def sync_dbs():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL environment variable is missing!")
        sys.exit(1)
        
    engine = create_engine(db_url)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    sum_db = os.path.join(base_dir, "..", "databases", "summary.db")
    aoc_db = os.path.join(base_dir, "..", "databases", "aoc_tenders.db")
    search_db = os.path.join(base_dir, "..", "databases", "search.db")
    
    # Tables in summary.db
    sum_tables = [
        "kpi_stats", "yearly_trends", "monthly_trends", "top_orgs", 
        "tender_type_dist", "portal_breakdown", "value_brackets", 
        "tenders_status", "published_monthly", "top_published_orgs", 
        "single_bid_contracts", "repeat_winners", "org_report_cards", 
        "state_stats", "sector_distribution", "network_nodes", "network_edges"
    ]
    
    if os.path.exists(sum_db):
        print(f"Syncing {sum_db} to PostgreSQL...")
        with sqlite3.connect(sum_db) as conn:
            for table in sum_tables:
                try:
                    df = pd.read_sql_query(f"SELECT * FROM {table}", conn)
                    df.to_sql(table, engine, if_exists='replace', index=False)
                    print(f"  -> Synced {table} ({len(df)} rows)")
                except Exception as e:
                    print(f"  -> Error syncing {table}: {e}")
                    
    if os.path.exists(aoc_db):
        print(f"Syncing {aoc_db} to PostgreSQL...")
        with sqlite3.connect(aoc_db) as conn:
            try:
                # Chunked sync for large tables
                CHUNK_SIZE = 10_000
                
                # Get total count first
                total = pd.read_sql_query(
                    "SELECT COUNT(*) as cnt FROM aoc_tenders", conn
                ).iloc[0]['cnt']
                print(f"  -> {total:,} rows to sync")

                # Write in chunks
                for i, chunk in enumerate(pd.read_sql_query(
                    "SELECT * FROM aoc_tenders", conn, chunksize=CHUNK_SIZE
                )):
                    chunk.to_sql(
                        "aoc_tenders", engine,
                        if_exists='replace' if i == 0 else 'append',
                        index=False
                    )
                    if i % 10 == 0:
                        print(f"  -> {i * CHUNK_SIZE:,} rows synced...")

                print(f"  -> aoc_tenders sync complete")
                
                # Same chunking for aoc_details
                total_details = pd.read_sql_query(
                    "SELECT COUNT(*) as cnt FROM aoc_details", conn
                ).iloc[0]['cnt']
                print(f"  -> {total_details:,} rows to sync for aoc_details")

                for i, chunk in enumerate(pd.read_sql_query(
                    "SELECT * FROM aoc_details", conn, chunksize=CHUNK_SIZE
                )):
                    chunk.to_sql(
                        "aoc_details", engine,
                        if_exists='replace' if i == 0 else 'append',
                        index=False
                    )
                    if i % 10 == 0:
                        print(f"  -> {i * CHUNK_SIZE:,} rows synced (aoc_details)...")
                print(f"  -> aoc_details sync complete")
            except Exception as e:
                print(f"  -> Error syncing aoc_tenders/aoc_details: {e}")

    # No search_db sync yet unless needed

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    sync_dbs()
