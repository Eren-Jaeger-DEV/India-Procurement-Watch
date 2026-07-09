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
API_KEY        = "4ec7ecc992cbd862b27fae04790e6796c97c97c91d64158f57f"
HEADERS        = {"X-API-Key": API_KEY, "User-Agent": "IPW-Dashboard/1.0"}

# Known state/org → (lat, lon) fallback cache so we don't hammer the API
# for results that will always resolve the same way.
INDIA_STATE_COORDS = {
    "andhra pradesh":       (15.9129, 79.7400),
    "arunachal pradesh":    (28.2180, 94.7278),
    "assam":                (26.2006, 92.9376),
    "bihar":                (25.0961, 85.3131),
    "chhattisgarh":         (21.2787, 81.8661),
    "goa":                  (15.2993, 74.1240),
    "gujarat":              (22.2587, 71.1924),
    "haryana":              (29.0588, 76.0856),
    "himachal pradesh":     (31.1048, 77.1734),
    "jharkhand":            (23.6102, 85.2799),
    "karnataka":            (15.3173, 75.7139),
    "kerala":               (10.8505, 76.2711),
    "madhya pradesh":       (22.9734, 78.6569),
    "maharashtra":          (19.7515, 75.7139),
    "manipur":              (24.6637, 93.9063),
    "meghalaya":            (25.4670, 91.3662),
    "mizoram":              (23.1645, 92.9376),
    "nagaland":             (26.1584, 94.5624),
    "odisha":               (20.9517, 85.0985),
    "punjab":               (31.1471, 75.3412),
    "rajasthan":            (27.0238, 74.2179),
    "sikkim":               (27.5330, 88.5122),
    "tamil nadu":           (11.1271, 78.6569),
    "telangana":            (18.1124, 79.0193),
    "tripura":              (23.9408, 91.9882),
    "uttar pradesh":        (26.8467, 80.9462),
    "uttarakhand":          (30.0668, 79.0193),
    "west bengal":          (22.9868, 87.8550),
    "chandigarh":           (30.7333, 76.7794),
    "delhi":                (28.6139, 77.2090),
    "nct of delhi":         (28.6139, 77.2090),
    "jammu and kashmir":    (34.0837, 74.7973),
    "ladakh":               (34.1526, 77.5770),
    "lakshadweep":          (10.5667, 72.6417),
    "puducherry":           (11.9416, 79.8083),
    "andaman and nicobar":  (11.7401, 92.6586),
    "dadra and nagar haveli": (20.1809, 73.0169),
    "daman and diu":        (20.4283, 72.8397),
    "food corporation":     (28.6139, 77.2090),
    "bhel":                 (28.6139, 77.2090),
    "ntpc":                 (28.6139, 77.2090),
    "ongc":                 (28.6139, 77.2090),
    "railways":             (28.6139, 77.2090),
    "nhai":                 (28.6139, 77.2090),
    "cpwd":                 (28.6139, 77.2090),
}

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

def fallback_coords(org_name: str):
    """Try state-name fallback from org_name."""
    lower = org_name.lower()
    for key, coords in INDIA_STATE_COORDS.items():
        if key in lower:
            return coords[0], coords[1], f"{org_name} (fallback)"
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
        # Use the first segment (state/top-level org) for best geocode results
        parts = [p.strip() for p in raw_org.split("||") if p.strip()]
        org = parts[0] if parts else raw_org

        if org in org_cache:
            lat, lon, addr = org_cache[org]
            source = "cache"
        else:
            # 1. Try Nominatim API
            result = nominatim_geocode(f"{org}, India")
            if result:
                lat, lon, addr = result
                source = "nominatim"
                time.sleep(0.3)  # be polite to the API
            else:
                # 2. Try state fallback
                fb = fallback_coords(org)
                if fb:
                    lat, lon, addr = fb
                    source = "fallback"
                else:
                    print(f"  ❌ No coords for: {org}")
                    failed += 1
                    continue

            org_cache[org] = (lat, lon, addr)
            print(f"  [{i+1}/{len(rows)}] {org[:50]} → ({lat:.4f}, {lon:.4f}) [{source}]")

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
    parser.add_argument("--limit",      type=int, default=5000,  help="Max tenders to geocode")
    parser.add_argument("--batch_size", type=int, default=100,   help="DB write batch size")
    args = parser.parse_args()

    conn = get_db_conn()
    ensure_table(conn)
    geocode_batch(conn, args.limit, args.batch_size)
    conn.close()

if __name__ == "__main__":
    main()
