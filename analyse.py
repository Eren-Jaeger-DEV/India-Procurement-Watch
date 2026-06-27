"""
analyse.py
==========
Master analysis orchestrator for India Procurement Watch.

Usage:
  python analyse.py

This script:
  1. Looks for .db files in the data_dump/ folder
  2. Runs build_summary.py and build_search_index.py with live progress tracking
  3. Generates the narrative analysis report
  4. Writes analysis_state.json so the frontend can track progress

Can also be triggered via the Flask API endpoint POST /api/trigger-analysis
"""

import os
import sys
import json
import time
import shutil
import sqlite3
import subprocess
import threading
from datetime import datetime

# Reconfigure stdout/stderr to handle Unicode characters on Windows
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
if hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
DATA_DUMP   = os.path.join(BASE_DIR, "data_dump")
STATE_FILE  = os.path.join(BASE_DIR, "analysis_state.json")
REPORT_FILE = os.path.join(BASE_DIR, "narrative_report.json")
SUM_DB      = os.path.join(BASE_DIR, "summary.db")
SEARCH_DB   = os.path.join(BASE_DIR, "search.db")
AOC_DB      = os.path.join(BASE_DIR, "aoc_tenders.db")
VPS_DB      = os.path.join(BASE_DIR, "tenders_vps.db")

# ─────────────────────────────────────────────
# STATE MANAGEMENT
# ─────────────────────────────────────────────

def write_state(stage, progress, message, error=None, done=False):
    """Write current analysis state to JSON file for frontend polling."""
    state = {
        "stage": stage,
        "progress": progress,         # 0–100
        "message": message,
        "error": error,
        "done": done,
        "timestamp": datetime.now().isoformat(),
    }
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def read_state():
    """Read current analysis state."""
    if not os.path.exists(STATE_FILE):
        return {"stage": "idle", "progress": 0, "message": "No analysis running.", "done": False}
    try:
        with open(STATE_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"stage": "idle", "progress": 0, "message": "No analysis running.", "done": False}


# ─────────────────────────────────────────────
# DATA DUMP DETECTION
# ─────────────────────────────────────────────

def find_db_files():
    """Scan data_dump/ for .db files and return what was found."""
    if not os.path.exists(DATA_DUMP):
        return None, None

    files = [f for f in os.listdir(DATA_DUMP) if f.lower().endswith(".db")]
    aoc_file = None
    vps_file = None

    for f in files:
        fl = f.lower()
        if "aoc" in fl or "tender" in fl and "vps" not in fl and "summary" not in fl:
            aoc_file = os.path.join(DATA_DUMP, f)
        elif "vps" in fl or "published" in fl:
            vps_file = os.path.join(DATA_DUMP, f)
        elif aoc_file is None:
            # First .db found becomes aoc if nothing else matched
            aoc_file = os.path.join(DATA_DUMP, f)

    return aoc_file, vps_file


def validate_db_schema(db_path):
    """
    Check if a .db file has the expected tables.
    Returns (is_valid, table_list, message).
    """
    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cur.fetchall()]
        conn.close()

        # Check for expected tables
        expected = {"aoc_tenders", "aoc_details"}
        found = set(tables)
        if expected.issubset(found):
            return True, tables, "Schema validated: required tables found."
        else:
            missing = expected - found
            # Still try — maybe partial data
            if "aoc_tenders" in found:
                return True, tables, f"Partial schema: missing {missing}. Will proceed with available data."
            return False, tables, f"Missing required tables: {missing}. Found: {found}"
    except Exception as e:
        return False, [], f"Cannot open database: {e}"


# ─────────────────────────────────────────────
# PIPELINE STAGES
# ─────────────────────────────────────────────

def stage_copy_data(aoc_src, vps_src):
    """Copy .db files from data_dump/ to project root."""
    write_state("copying", 5, "Copying data files to working directory...")

    if aoc_src and os.path.exists(aoc_src):
        shutil.copy2(aoc_src, AOC_DB)
        print(f"  Copied: {os.path.basename(aoc_src)} → aoc_tenders.db")

    if vps_src and os.path.exists(vps_src):
        shutil.copy2(vps_src, VPS_DB)
        print(f"  Copied: {os.path.basename(vps_src)} → tenders_vps.db")
    elif os.path.exists(VPS_DB):
        # Keep existing VPS db if no new one provided
        pass


def stage_build_summary():
    """Run build_summary.py and track progress."""
    write_state("summary", 10, "Building summary database (this takes a few minutes for large files)...")

    script = os.path.join(BASE_DIR, "build_summary.py")
    proc = subprocess.Popen(
        [sys.executable, script],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=BASE_DIR
    )

    progress = 10
    for line in proc.stdout:
        line = line.strip()
        if line:
            print(f"  [build_summary] {line}")
            # Rough progress tracking based on log output
            if "Phase 1a" in line:
                progress = 15
            elif "Phase 1b" in line:
                progress = 25
            elif "Phase 1c" in line:
                progress = 50
            elif "Phase 2" in line:
                progress = 60
            elif "Phase 3" in line:
                progress = 70
            elif "COMPLETE" in line or "build_summary.py COMPLETE" in line:
                progress = 75
            write_state("summary", progress, f"Building summary: {line[:80]}")

    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError(f"build_summary.py failed with exit code {proc.returncode}")

    write_state("summary", 75, "Summary database built successfully.")


def stage_build_search():
    """Run build_search_index.py."""
    write_state("search_index", 76, "Building full-text search index...")

    script = os.path.join(BASE_DIR, "build_search_index.py")
    if not os.path.exists(script):
        write_state("search_index", 85, "Search index script not found, skipping.")
        return

    proc = subprocess.Popen(
        [sys.executable, script],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=BASE_DIR
    )

    for line in proc.stdout:
        line = line.strip()
        if line:
            print(f"  [build_search] {line}")
            write_state("search_index", 82, f"Building search index: {line[:80]}")

    proc.wait()
    write_state("search_index", 85, "Search index built.")


def stage_generate_narrative():
    """Query summary.db and generate the narrative report."""
    write_state("narrative", 86, "Generating analysis report and findings...")

    # Import here to avoid circular issues
    sys.path.insert(0, BASE_DIR)
    from src.analysis.narrative_engine import generate_full_report

    if not os.path.exists(SUM_DB):
        raise RuntimeError("summary.db not found after build stage.")

    conn = sqlite3.connect(SUM_DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    def q(sql, params=()):
        cur.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]

    def q1(sql, params=()):
        cur.execute(sql, params)
        row = cur.fetchone()
        return dict(row) if row else {}

    # Fetch all the data needed for narrative
    kpis_rows = q("SELECT key, value FROM kpi_stats")
    kpis = {r["key"]: r["value"] for r in kpis_rows}

    # Anomalies
    anom_types = ["round_number", "quick_award", "high_value_state"]
    anomalies_by_type = {}
    for atype in anom_types:
        cur.execute("SELECT COUNT(*) as cnt FROM anomalies WHERE anom_type=?", (atype,))
        row = cur.fetchone()
        anomalies_by_type[atype] = {"total": dict(row)["cnt"] if row else 0}

    total_contracts = int(kpis.get("total_aoc_tenders", 0) or 0)
    anomalies_by_type["_total_contracts"] = total_contracts

    # Top orgs
    top_orgs = q("SELECT org_name, count, total_value_crore FROM top_orgs ORDER BY count DESC LIMIT 25")

    # Single bid
    cur.execute("SELECT COUNT(*) as cnt FROM single_bid_contracts")
    sb_row = cur.fetchone()
    single_bid_data = {"total": dict(sb_row)["cnt"] if sb_row else 0, "results": []}

    # Repeat winners
    rw = q("SELECT bidder_name, org_name, wins, total_value_crore, first_win, last_win FROM repeat_winners ORDER BY wins DESC LIMIT 20")
    repeat_winners_data = {"results": rw}

    # Report cards
    rc = q("SELECT org_name, total_contracts, total_value_crore, single_bid_pct, round_number_pct, score, grade FROM org_report_cards ORDER BY score ASC LIMIT 50")
    report_cards = {"results": rc}

    # Yearly trends
    try:
        rows = q("SELECT year, SUM(count) as count, SUM(total_value_crore) as total_value_crore FROM yearly_trends WHERE year BETWEEN 2015 AND 2030 GROUP BY year ORDER BY year")
        yearly_data = {
            "labels": [str(r["year"]) for r in rows],
            "counts": [r["count"] for r in rows],
            "values": [round(r["total_value_crore"] or 0, 2) for r in rows],
        }
    except Exception:
        yearly_data = {}

    conn.close()

    write_state("narrative", 93, "Running narrative analysis engine...")

    report = generate_full_report(
        kpis=kpis,
        anomalies_by_type=anomalies_by_type,
        top_orgs=top_orgs,
        single_bid_data=single_bid_data,
        repeat_winners_data=repeat_winners_data,
        report_cards=report_cards,
        yearly_data=yearly_data,
        total_contracts=total_contracts,
    )

    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"  Narrative report written: {REPORT_FILE}")
    print(f"  Total findings generated: {len(report['findings'])}")
    write_state("narrative", 98, f"Narrative report complete: {len(report['findings'])} findings generated.")


# ─────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────

def run_analysis(aoc_src=None, vps_src=None, use_existing=False):
    """
    Run the full analysis pipeline.
    
    Args:
        aoc_src: Path to AOC .db file in data_dump (or None to use existing)
        vps_src: Path to VPS .db file in data_dump (or None to use existing)
        use_existing: If True, skip copy stage and use already-placed .db files
    """
    start_time = time.time()
    print("=" * 60)
    print("  India Procurement Watch — Analysis Pipeline")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    try:
        write_state("starting", 1, "Analysis started...")

        # Stage 1: Copy data files (if from data_dump)
        if not use_existing and aoc_src:
            stage_copy_data(aoc_src, vps_src)
        else:
            write_state("copying", 5, "Using existing database files...")
            time.sleep(0.5)

        # Validate
        write_state("validating", 8, "Validating database schema...")
        if os.path.exists(AOC_DB):
            is_valid, tables, msg = validate_db_schema(AOC_DB)
            print(f"  Schema check: {msg}")
            if not is_valid:
                raise RuntimeError(f"Database validation failed: {msg}")
        else:
            raise RuntimeError("aoc_tenders.db not found. Please drop your .db file in the data_dump/ folder.")

        # Stage 2: Build summary
        stage_build_summary()

        # Stage 3: Build search index
        stage_build_search()

        # Stage 4: Generate narrative
        stage_generate_narrative()

        elapsed = time.time() - start_time
        write_state("done", 100, f"Analysis complete in {elapsed/60:.1f} minutes.", done=True)
        print("=" * 60)
        print(f"  Analysis COMPLETE in {elapsed/60:.1f} minutes.")
        print("=" * 60)

    except Exception as e:
        error_msg = str(e)
        print(f"  ERROR: {error_msg}", file=sys.stderr)
        write_state("error", 0, f"Analysis failed: {error_msg}", error=error_msg, done=True)
        raise


def run_analysis_background(aoc_src=None, vps_src=None, use_existing=False):
    """Run analysis in a background thread (for Flask API use)."""
    t = threading.Thread(
        target=run_analysis,
        kwargs={"aoc_src": aoc_src, "vps_src": vps_src, "use_existing": use_existing},
        daemon=True
    )
    t.start()
    return t


# ─────────────────────────────────────────────
# CLI ENTRY POINT
# ─────────────────────────────────────────────

if __name__ == "__main__":
    # Detect data dump files
    aoc_src, vps_src = find_db_files()

    if aoc_src:
        print(f"Found AOC database: {aoc_src}")
        if vps_src:
            print(f"Found VPS database: {vps_src}")
        else:
            print("No VPS database found in data_dump/ — proceeding with AOC only.")
        run_analysis(aoc_src=aoc_src, vps_src=vps_src)
    elif os.path.exists(AOC_DB):
        print("No new files in data_dump/ — using existing aoc_tenders.db")
        run_analysis(use_existing=True)
    else:
        print("ERROR: No .db file found in data_dump/ and no existing aoc_tenders.db.")
        print("  → Drop your SQLite .db file into the data_dump/ folder, then run this script.")
        sys.exit(1)
