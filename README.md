# India Procurement Watch — Power Analysis Tool

This is a fast, offline-first analysis tool and dashboard for exploring public procurement data in India. 

It takes large SQLite database dumps from government e-procurement portals and processes them into a local dashboard, allowing journalists, researchers, and citizens to analyze public spending without needing database expertise.

## Key Features

*   **Offline Data Ingestion**: Place database files in the `data_dump/` directory and trigger the aggregation directly from your browser.
*   **Narrative Analysis Reports**: An automated rules engine highlights unusual patterns, explains their implications, and suggests specific follow-up actions.
*   **Risk Grading**: Assigns risk grades (A to F) to departments based on the percentage of single-bid awards and round-number contracts.
*   **Investigation Desk**: Dedicated tabular views to filter potential red flags:
    *   **Round-Number Contracts**: Awards ending in exact Lakh or Crore multiples.
    *   **Quick-Award Notices**: Contracts awarded within 24 hours of the bidding deadline.
    *   **Single-Bid Contracts**: Awards where only one bidder participated.
    *   **Repeat Winners**: Vendors winning multiple contracts from the same department.
*   **Full-Text Search**: Instantly query tender titles and departments using an optimized SQLite FTS5 index.
*   **Geographical Heatmap**: View contract distributions and total spending mapped across states.

## Quick Start (with Mock Data)

If you don't have the real dataset, you can generate mock data to test the workflow:

1.  **Clone and Install**:
    ```bash
    git clone https://github.com/Eren-Jaeger-DEV/India-Procurement-Watch.git
    cd India-Procurement-Watch
    pip install -r requirements.txt
    ```

2.  **Generate Test Data**:
    ```bash
    python create_sample_data.py
    ```
    This writes mock databases into the `data_dump/` folder.

3.  **Run the Server**:
    ```bash
    python app.py
    ```

4.  **Process and View**:
    *   Open `http://localhost:5000` in your browser.
    *   The app will open to the **Data Import** screen showing the mock files.
    *   Click **Analyse Data** to run the aggregation pipeline. Once finished, the dashboard will populate.

## Project Structure

*   `app.py` — Flask API server that serves aggregate data and searches. Uses request-scoped connections to avoid database file locks.
*   `analyse.py` — Pipeline orchestrator that coordinates schema checks, aggregation, indexing, and report generation.
*   `build_summary.py` — Processes raw scraper logs to populate statistical tables.
*   `build_search_index.py` — Builds the full-text search database.
*   `data_dump/` — The directory where you drop new SQLite files.
*   `src/analysis/` — Contains anomaly logic and narrative engines.
*   `frontend/` — HTML, CSS, and JS dashboard files.

## Technical Details

The tool runs a preprocessing step to avoid querying the giant raw databases directly:
1.  It compiles raw records into a structured `summary.db` (usually under 50 MB).
2.  It copies text values to a separate `search.db` utilizing SQLite FTS5 virtual tables.
3.  The Flask backend accesses these compiled databases read-only during active dashboard requests.

## Offline Privacy

All processing is done locally on your machine. No search queries or database files are uploaded to external servers.

## Credits & Contributions

The **Director Networks** graph feature matches bidder names to official corporate profiles (CIN) and extracts connections such as shared registration emails or physical addresses.

This dataset mapping, name normalization, and record-linkage architecture was designed and developed by:
*   [fireboy-dev/india-procurement-company-director](https://github.com/fireboy-dev/india-procurement-company-director)

If you run their matching pipeline, you can drop the generated `nodes.csv` and `edges.csv` files into the `data_dump/` folder. This tool will automatically detect and import them, allowing you to explore company and buyer connections directly in your browser.
