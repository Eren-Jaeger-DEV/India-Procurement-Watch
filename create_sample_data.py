"""
create_sample_data.py
======================
Generates lightweight fake SQLite databases (aoc_tenders.db + aoc_details.db
+ tenders_vps.db) so you can test the dashboard without the real 12 GB data dump.

Produces ~5,000 synthetic tender records covering 2015–2026.

Usage:
    python create_sample_data.py
    python build_summary.py
    python build_search_index.py
    python optimize_fts.py   # optional but recommended
    python app.py
"""

import sqlite3, os, random, json, hashlib, string
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Config ────────────────────────────────────────────────
N_TENDERS  = 5_000   # awarded contracts
N_PUBLISHED = 3_000  # published tenders
SEED = 42
random.seed(SEED)

# ── Sample data pools ─────────────────────────────────────
ORGS = [
    "Maharashtra PWD", "West Bengal PWD", "Kerala PWD",
    "Madhya Pradesh Roads", "NHAI - National Highways Authority of India",
    "BHEL EDN", "Indian Railways - Central Railway",
    "Municipal Corporation of Delhi", "Punjab PWD",
    "Rajasthan Urban Development", "Tamil Nadu Highways",
    "Andhra Pradesh Roads", "Telangana PWD", "Gujarat Infrastructure",
    "Karnataka Roads and Bridges", "ONGC", "BPCL",
    "IHQ of MoD (Army)-(OSCC)", "DRDO", "HAL Bangalore",
]
PORTAL_TYPES = ["state"] * 7 + ["central"] * 3  # 70% state, 30% central
TENDER_TYPES = ["Works"] * 6 + ["Goods"] * 2 + ["Services"] * 2
WORKS = [
    "Construction of Road", "Repair of Bridge", "Supply of Equipment",
    "Development of Park", "Construction of Hospital Building",
    "Solar Panel Installation", "Water Supply Pipeline",
    "Widening of Highway NH-{}", "Construction of Police Station",
    "Renovation of Government Office", "Supply of Computers",
    "Construction of School Building", "Drainage System Improvement",
    "Smart City Infrastructure", "Construction of Check Dam",
    "Road Safety Measures", "Manpower Supply Contract",
    "Security Services", "Housekeeping Services",
    "Construction of Railway Overbridge",
]

def rand_date(start_year=2015, end_year=2026):
    start = datetime(start_year, 1, 1)
    end   = datetime(end_year, 12, 31)
    delta = end - start
    return (start + timedelta(days=random.randint(0, delta.days))).strftime("%d-%b-%Y %I:%M %p")

def rand_value():
    """Realistic contract value distribution (log-normal)."""
    # Most contracts are small; a few are huge
    bracket = random.random()
    if bracket < 0.40:   return round(random.uniform(50_000,    1_000_000),   2)
    if bracket < 0.65:   return round(random.uniform(1_000_000,  10_000_000),  2)
    if bracket < 0.85:   return round(random.uniform(10_000_000, 100_000_000), 2)
    if bracket < 0.95:   return round(random.uniform(1e8,         1e9),        2)
    return round(random.uniform(1e9, 2e10), 2)  # mega contracts

def make_id(seed_str):
    return hashlib.md5(seed_str.encode()).hexdigest()

def rand_ref():
    prefix = random.choice(["PWD", "NHAI", "PWC", "GEM", "TENDER", "DNIT"])
    return f"{prefix}/{random.randint(2015,2026)}/{random.randint(1,999):03d}"

def rand_title():
    tmpl = random.choice(WORKS)
    return tmpl.format(random.randint(1, 99))

# ─────────────────────────────────────────────────────────────
print("Creating aoc_tenders.db (awarded contracts)...")
aoc_path = os.path.join(BASE_DIR, "aoc_tenders.db")
if os.path.exists(aoc_path):
    os.remove(aoc_path)

aoc = sqlite3.connect(aoc_path)
aoc.execute("PRAGMA journal_mode=WAL")
aoc.execute("""
    CREATE TABLE aoc_tenders (
        internal_id   TEXT PRIMARY KEY,
        tender_id     TEXT,
        org_name      TEXT,
        title         TEXT,
        year          INTEGER,
        portal_type   TEXT,
        tender_type   TEXT,
        aoc_date      TEXT,
        closing_date  TEXT
    )
""")
aoc.execute("""
    CREATE TABLE aoc_details (
        internal_id  TEXT PRIMARY KEY,
        details_json TEXT
    )
""")

aoc_rows = []
det_rows = []

for i in range(N_TENDERS):
    org   = random.choice(ORGS)
    ptype = random.choice(PORTAL_TYPES)
    ttype = random.choice(TENDER_TYPES)
    year  = random.randint(2015, 2026)
    aoc_dt = rand_date(year, year)
    close_dt = rand_date(year, year)
    title = rand_title()
    ref   = rand_ref()
    val   = rand_value()
    bids  = random.randint(1, 15)
    iid   = make_id(f"{i}_{org}_{ref}_{val}")

    aoc_rows.append((iid, ref, org, title, year, ptype, ttype, aoc_dt, close_dt))

    details = {
        "Tender Ref. No.": ref,
        "Tender Description": title,
        "Organisation Name": org,
        "Contract Value": str(val),
        "Number of bids received": str(bids),
        "Tender Type": ttype,
        "AOC Published Date": aoc_dt,
        "Bid Submission Closing Date": close_dt,
    }
    det_rows.append((iid, json.dumps(details)))

aoc.executemany("INSERT INTO aoc_tenders VALUES (?,?,?,?,?,?,?,?,?)", aoc_rows)
aoc.executemany("INSERT INTO aoc_details VALUES (?,?)", det_rows)
aoc.execute("CREATE INDEX idx_org  ON aoc_tenders(org_name)")
aoc.execute("CREATE INDEX idx_year ON aoc_tenders(year)")
aoc.commit()
aoc.close()
print(f"  -> {N_TENDERS:,} records written.")

# ─────────────────────────────────────────────────────────────
print("Creating tenders_vps.db (published tenders)...")
vps_path = os.path.join(BASE_DIR, "tenders_vps.db")
if os.path.exists(vps_path):
    os.remove(vps_path)

vps = sqlite3.connect(vps_path)
vps.execute("""
    CREATE TABLE tenders (
        tender_id    TEXT PRIMARY KEY,
        org_name     TEXT,
        title        TEXT,
        portal_type  TEXT,
        tender_type  TEXT,
        e_published_date TEXT,
        tender_value TEXT
    )
""")
vps.execute("""
    CREATE TABLE tender_details (
        tender_id    TEXT PRIMARY KEY,
        details_json TEXT
    )
""")

pub_rows = []
pdet_rows = []

for i in range(N_PUBLISHED):
    org   = random.choice(ORGS)
    ptype = random.choice(PORTAL_TYPES)
    ttype = random.choice(TENDER_TYPES)
    year  = random.randint(2015, 2026)
    pub_dt = rand_date(year, year)
    title  = rand_title()
    tid    = f"TEND/{year}/{i:05d}"
    val    = rand_value()

    pub_rows.append((tid, org, title, ptype, ttype, pub_dt, str(val)))
    pdet_rows.append((tid, json.dumps({
        "Tender ID": tid,
        "Title": title,
        "Organisation": org,
        "Tender Value": str(val),
        "Published Date": pub_dt,
    })))

vps.executemany("INSERT INTO tenders VALUES (?,?,?,?,?,?,?)", pub_rows)
vps.executemany("INSERT INTO tender_details VALUES (?,?)", pdet_rows)
vps.commit()
vps.close()
print(f"  -> {N_PUBLISHED:,} records written.")

print()
print("=" * 55)
print("Sample data ready! Now run:")
print("  python build_summary.py")
print("  python build_search_index.py")
print("  python app.py")
print("  -> http://localhost:5000")
print("=" * 55)
