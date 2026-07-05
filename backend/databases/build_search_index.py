"""
build_search_index.py  (v2)
============================
Builds a fast FTS5 full-text search index from aoc_tenders.db into search.db.
v2 fixes:
  - Uses journal_mode=OFF + synchronous=OFF for maximum write throughput
  - Uses fetchmany() instead of cursor iteration (avoids long-running cursor issues)
  - Skips the optimize step (reduces peak memory)
  - Processes in 10K-row chunks with frequent commits

Estimated runtime: 4-8 minutes for 4.9M rows.
"""

import sqlite3
import os
import sys
import time
from datetime import datetime

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
AOC_DB    = os.path.join(BASE_DIR, "aoc_tenders.db")
SEARCH_DB = os.path.join(BASE_DIR, "search.db")

CHUNK_SIZE = 10_000   # smaller chunks → less WAL pressure

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)

def main():
    t0 = time.time()
    log("=" * 60)
    log("build_search_index.py  v2")
    log("=" * 60)

    if not os.path.exists(AOC_DB):
        print(f"ERROR: {AOC_DB} not found.", file=sys.stderr)
        sys.exit(1)

    # Remove old (possibly corrupted) search.db
    if os.path.exists(SEARCH_DB):
        log(f"Removing old {SEARCH_DB}...")
        os.remove(SEARCH_DB)
    for ext in ["-wal", "-shm"]:
        p = SEARCH_DB + ext
        if os.path.exists(p):
            os.remove(p)

    log("Opening source DB (read-only)...")
    src = sqlite3.connect(f"file:{AOC_DB}?mode=ro", uri=True)
    src.execute("PRAGMA query_only=1")

    log("Creating search.db...")
    dst = sqlite3.connect(SEARCH_DB)

    # Fastest possible write settings (acceptable since we rebuild on crash)
    dst.execute("PRAGMA journal_mode=OFF")
    dst.execute("PRAGMA synchronous=OFF")
    dst.execute("PRAGMA page_size=4096")
    dst.execute("PRAGMA cache_size=-32000")   # 32 MB cache

    log("Creating FTS5 virtual table...")
    dst.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS aoc_fts USING fts5(
            internal_id  UNINDEXED,
            org_name,
            title,
            year         UNINDEXED,
            portal_type  UNINDEXED,
            aoc_date     UNINDEXED,
            tokenize     = "unicode61 remove_diacritics 1"
        )
    """)
    dst.commit()

    # Get total row count for progress reporting
    cur_count = src.cursor()
    cur_count.execute("SELECT COUNT(*) FROM aoc_tenders")
    total_rows = cur_count.fetchone()[0]
    cur_count.close()
    log(f"Total rows to index: {total_rows:,}")

    log("Indexing rows (fetchmany mode)...")
    cur = src.cursor()
    cur.execute("""
        SELECT internal_id, org_name, title, year, portal_type, aoc_date
        FROM aoc_tenders
    """)

    total = 0
    t1 = time.time()

    while True:
        rows = cur.fetchmany(CHUNK_SIZE)
        if not rows:
            break

        # Clean None values before inserting
        cleaned = [
            (
                r[0] or '',
                r[1] or '',
                r[2] or '',
                str(r[3]) if r[3] else '',
                r[4] or '',
                r[5] or '',
            )
            for r in rows
        ]

        dst.executemany("INSERT INTO aoc_fts VALUES (?,?,?,?,?,?)", cleaned)
        dst.commit()
        total += len(rows)

        elapsed = time.time() - t1
        pct = (total / total_rows * 100) if total_rows else 0
        log(f"  Indexed {total:,} / {total_rows:,} rows ({pct:.1f}%) — {elapsed:.0f}s")

    cur.close()
    src.close()

    log(f"OK Indexed {total:,} rows total.")

    size_mb = os.path.getsize(SEARCH_DB) / (1024 * 1024)
    elapsed = time.time() - t0
    log("=" * 60)
    log(f"DONE in {elapsed/60:.1f} minutes.")
    log(f"search.db size: {size_mb:.1f} MB")
    log("=" * 60)

if __name__ == "__main__":
    main()
