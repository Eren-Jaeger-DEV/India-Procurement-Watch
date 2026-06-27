# The Data Guide — Running the dashboard with real data

This guide walks you through importing your raw SQLite procurement databases and running the automated analysis pipeline.

---

## 1. Get the SQLite Files

You will need the raw SQLite databases scraped from the public procurement portals. The tool looks for two database files:

1.  **`aoc_tenders.db`** (Required) — Contains the Award of Contract (AOC) notices.
    *   `aoc_tenders` table schema:
        ```sql
        CREATE TABLE aoc_tenders (
            internal_id TEXT PRIMARY KEY,
            tender_id TEXT,
            org_name TEXT,
            title TEXT,
            year INTEGER,
            portal_type TEXT,
            tender_type TEXT,
            aoc_date TEXT,
            closing_date TEXT
        );
        ```
    *   `aoc_details` table schema:
        ```sql
        CREATE TABLE aoc_details (
            internal_id TEXT PRIMARY KEY,
            details_json TEXT
        );
        ```
2.  **`tenders_vps.db`** (Optional) — Contains published tender notice alerts (allows published vs awarded contract volume comparisons).
    *   `tenders` table schema:
        ```sql
        CREATE TABLE tenders (
            tender_id TEXT PRIMARY KEY,
            org_name TEXT,
            title TEXT,
            portal_type TEXT,
            tender_type TEXT,
            e_published_date TEXT,
            tender_value TEXT
        );
        ```
    *   `tender_details` table schema:
        ```sql
        CREATE TABLE tender_details (
            tender_id TEXT PRIMARY KEY,
            details_json TEXT
        );
        ```

*(Note: If you only have `aoc_tenders.db`, that is completely fine. The tool will leave published stats charts blank but function fully.)*

---

## 2. Drop the Files

Copy your database files and paste them directly into the **`data_dump/`** directory in your project root:

```text
India-Procurement-Watch/
├── data_dump/
│   ├── aoc_tenders.db    ← paste here
│   └── tenders_vps.db    ← paste here
├── app.py
├── analyse.py
└── ...
```

---

## 3. Trigger the Ingestion

You can trigger the ingestion pipeline in two ways:

### Method A: Browser UI (Recommended)
1.  Start the local server:
    ```bash
    python app.py
    ```
2.  Open **`http://localhost:5000`** in your browser.
3.  Go to the **Data Import** sidebar tab.
4.  Verify that your database files are listed under "Files Detected".
5.  Click **Analyse Data** to start the pipeline. A real-time progress bar will update you on the current processing stage.

### Method B: Command Line (For Headless Run)
If you prefer running the pipeline directly from a terminal:
```bash
python analyse.py
```
This runs the copy, database schema check, aggregation, FTS indexing, and narrative report generation as a sequential pipeline in your shell.

---

## 4. Hardware Recommendations

Crunching gigabytes of SQLite data requires minor system resources:
*   **Disk Space**: Ensure at least 25 GB free (to store copy buffers and search index databases).
*   **RAM**: 8 GB RAM is recommended for building FTS5 indices efficiently.
*   **Python**: Version 3.10 or newer.

---

## 5. Troubleshooting Windows Lock Warnings

On Windows systems, SQLite files can occasionally be locked by running processes.
*   **Server lock**: The web server uses request-scoped connection handlers, closing connections instantly when pages finish loading to avoid lockouts.
*   **Pipeline recovery**: If `summary.db` or `search.db` is locked when rebuilding, the orchestrator automatically detects this, warns you, and drops SQL tables directly inside the existing files instead of crashing.
*   If you face persistent file lock warnings, stop `app.py` in your console, run `python analyse.py` in your shell, and restart the server afterwards.
