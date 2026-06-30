# The Data Guide — Running the dashboard with real data

This dashboard is designed to visualize data scraped by **[Sarthak Sidhant's India Procurement Watch](https://tender.sarthaksidhant.com)**. It pulls Award of Contract (AOC) notices and published tender records from GeM, CPPP, and over 30 state portals.

If you want the exact dataset we tested with, you'll need to reach out to the project at [tender.sarthaksidhant.com](https://tender.sarthaksidhant.com) and ask for the SQLite dump.

This guide walks you through importing your SQLite procurement databases and running the automated analysis pipeline.

## 1. Expected SQLite Files

The tool looks for two database files in the dump folder:

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

If you only have `aoc_tenders.db`, that is fine. The tool will leave the published tender metrics empty but function normally.

## 2. Drop the Files

Copy your database files and paste them directly into the `data_dump/` directory in your project root:

```text
India-Procurement-Watch/
├── data_dump/
│   ├── aoc_tenders.db    ← paste here
│   └── tenders_vps.db    ← paste here
├── app.py
├── analyse.py
└── ...
```

## 3. Run the Ingestion Pipeline

You can run the ingestion in two ways:

### Method A: From the Browser UI
1.  Start the local Flask server:
    ```bash
    python app.py
    ```
2.  Open `http://localhost:5000` in your browser.
3.  Go to the **Data Import** tab in the sidebar.
4.  Verify that your database files are listed under "Files Detected".
5.  Click **Analyse Data** to run the pipeline. You will see a progress bar tracking the current stage.

### Method B: From the Command Line
If you prefer running the pipeline directly from a terminal without launching the browser UI:
```bash
python analyse.py
```
This runs the file staging, schema validation, aggregation, indexing, and report generation scripts sequentially.

## 4. Hardware Requirements

Processing gigabytes of SQLite data requires minor system resources:
*   **Disk Space**: At least 25 GB free (to accommodate staging copy operations and search index storage).
*   **RAM**: 8 GB RAM is recommended for building SQLite FTS5 indices.
*   **Python**: Version 3.10 or newer.

## 5. Troubleshooting Windows File Locks

On Windows systems, SQLite databases can occasionally be locked by running processes.
*   The Flask web server uses request-scoped connection handlers, closing SQLite connections when request context terminates to prevent lockouts.
*   If `summary.db` or `search.db` is locked when rebuilding, the orchestrator automatically handles the warning and drops/clears database tables internally instead of crashing.
*   If you face persistent file lock warnings, stop `app.py` in your terminal, run `python analyse.py` manually, and restart the server afterwards.

## 6. API Configuration (Darshi AI)

To use the Darshi Intelligence Desk features, you must configure the LLM router API key.

1. Create a file named `.env` in the root of the project.
2. Add your routing API key:
   ```env
   ROUTING_RUN_API_KEY=your_api_key_here
   ```
3. Restart the Flask server.
