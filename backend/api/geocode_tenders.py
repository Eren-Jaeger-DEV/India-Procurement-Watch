#!/usr/bin/env python3
"""
geocode_tenders.py
------------------
Geocodes tenders from the aoc_tenders / single_bid_contracts tables
using the private Nominatim instance at nominatim.satviks.dev.

Strategy:
  - Use org_name as the primary geocoding signal (state/org names map well)
  - Cache results per unique org_name to minimise API calls
  - Insert into aoc_geocoded table

Run:  python3 geocode_tenders.py [--limit N] [--batch_size N]
"""

import argparse
import time
import requests
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values

NOMINATIM_BASE = "https://nominatim.satviks.dev"
API_KEY        = "4ec7ecc992cbd862b27fae04790e6796c97c91d64158f57f"
HEADERS        = {"X-API-Key": API_KEY, "User-Agent": "IPW-Dashboard/1.0"}


def get_db_conn():
    import os
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return psycopg2.connect(db_url)
    return psycopg2.connect(
        host=os.getenv("PG_HOST", "localhost"),
        dbname=os.getenv("PG_DB", "ipw"),
        user=os.getenv("PG_USER", "ipw"),
        password=os.getenv("PG_PASS", ""),
        port=int(os.getenv("PG_PORT", "5432"))
    )

def ensure_table(conn):
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS aoc_geocoded (
                internal_id     TEXT PRIMARY KEY,
                lat             DOUBLE PRECISION NOT NULL,
                lon             DOUBLE PRECISION NOT NULL,
                resolved_address TEXT,
                geocoded_at     TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        # Add geocode_source column if not present (migration for older table)
        cur.execute("""
            ALTER TABLE aoc_geocoded
            ADD COLUMN IF NOT EXISTS geocode_source TEXT DEFAULT 'nominatim'
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_geocoded_lat_lon ON aoc_geocoded(lat, lon)")
        conn.commit()
    print("✅ aoc_geocoded table ready")

def nominatim_geocode(query: str) -> tuple | None:
    """Call the Nominatim /search endpoint. Returns (lat, lon, display_name) or None."""
    try:
        url = f"{NOMINATIM_BASE}/search"
        params = {
            "q": query,
            "format": "jsonv2",
            "limit": 1,
            "addressdetails": 1,
            "countrycodes": "in",   # restrict to India
            "key": API_KEY,          # pass key as query param (more reliable)
        }
        r = requests.get(url, headers=HEADERS, params=params, timeout=10)
        r.raise_for_status()
        results = r.json()
        if results:
            top = results[0]
            return float(top["lat"]), float(top["lon"]), top.get("display_name", query)
    except Exception as e:
        print(f"  ⚠️  Nominatim error for '{query}': {e}")
    return None


def geocode_batch(conn, limit: int, batch_size: int):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Pull tenders not yet geocoded, prioritise single-bid high-value ones first
        cur.execute("""
            SELECT t.internal_id, t.org_name, t.title, t.portal_type
            FROM aoc_tenders t
            LEFT JOIN aoc_geocoded g ON t.internal_id = g.internal_id
            WHERE g.internal_id IS NULL
              AND t.org_name IS NOT NULL
            ORDER BY
                (CASE WHEN EXISTS (
                    SELECT 1 FROM single_bid_contracts s WHERE s.internal_id = t.internal_id
                ) THEN 0 ELSE 1 END),
                t.internal_id
            LIMIT %s
        """, (limit,))
        rows = cur.fetchall()

    print(f"📋 {len(rows)} tenders to geocode (limit={limit})")

    # Build org_name cache to save API calls
    org_cache: dict[str, tuple] = {}
    inserted = 0
    failed = 0

    batch_rows = []

    for i, row in enumerate(rows):
        raw_org = row["org_name"].strip()
        # org_name often has hierarchy like "Punjab||District||Sub-office"
        # Reverse the hierarchy to get the deepest level address (Sub-office, District, Punjab)
        parts = [p.strip() for p in raw_org.split("||") if p.strip()]
        org = ", ".join(reversed(parts)) if parts else raw_org

        if raw_org in org_cache:
            cached_val = org_cache[raw_org]
            if cached_val is None:
                failed += 1
                continue
            lat, lon, addr = cached_val
            source = "cache"
        else:
            # Progressive fallback: try deepest first, if fails drop the most specific part
            result = None
            for attempt_idx in range(len(parts)):
                query_parts = parts[::-1][attempt_idx:]  # reversed parts, dropping front
                attempt_str = ", ".join(query_parts)
                result = nominatim_geocode(f"{attempt_str}, India")
                if result:
                    break
                time.sleep(0.2) # be polite on misses too

            if result:
                lat, lon, addr = result
                source = "nominatim"
                org_cache[raw_org] = (lat, lon, addr)
                print(f"  [{i+1}/{len(rows)}] {raw_org[:50]} → ({lat:.4f}, {lon:.4f}) [{source}]")
            else:
                print(f"  ❌ No coords for: {raw_org}")
                org_cache[raw_org] = None
                failed += 1
                continue

        batch_rows.append((row["internal_id"], lat, lon, addr, source))

        if len(batch_rows) >= batch_size:
            _flush(conn, batch_rows)
            inserted += len(batch_rows)
            batch_rows = []

    if batch_rows:
        _flush(conn, batch_rows)
        inserted += len(batch_rows)

    print(f"\n✅ Done! Inserted/updated {inserted} rows. Failed: {failed}")

def _flush(conn, rows):
    with conn.cursor() as cur:
        execute_values(cur, """
            INSERT INTO aoc_geocoded (internal_id, lat, lon, resolved_address, geocode_source)
            VALUES %s
            ON CONFLICT (internal_id) DO UPDATE
                SET lat = EXCLUDED.lat,
                    lon = EXCLUDED.lon,
                    resolved_address = EXCLUDED.resolved_address,
                    geocode_source = EXCLUDED.geocode_source,
                    geocoded_at = NOW()
        """, rows)
        conn.commit()
    print(f"  💾 Flushed {len(rows)} rows to DB")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit",      type=int, default=500000,  help="Max tenders to geocode")
    parser.add_argument("--batch_size", type=int, default=100,   help="DB write batch size")
    args = parser.parse_args()

    conn = get_db_conn()
    ensure_table(conn)
    geocode_batch(conn, args.limit, args.batch_size)
    conn.close()

if __name__ == "__main__":
    main()
