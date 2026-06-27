# 🏛️ India Procurement Watch — Power Analysis Tool

A fast, offline-first investigative analysis dashboard for India's public procurement data.

This tool turns massive, gigabyte-sized SQLite database dumps from government e-procurement portals into a powerful investigative analysis workshop in your browser.

**Perfect for data journalists, corruption researchers, auditors, or citizens demanding transparency in public spending.**

---

## 🚀 Key Features

*   📥 **Simple Data Import**: Just copy-paste your database files into the `data_dump/` folder and trigger the analysis with one click from the browser.
*   📝 **Interactive Narrative Reports**: A built-in rule-based narrative engine automatically detects procurement anomalies, drafts plain-English executive summaries, and ranks investigation priorities.
*   📊 **Risk Grading (A–F)**: Departments are graded based on single-bid rates and round-number contract rates.
*   🕵️ **Investigation Desk**: Deep dive into filterable tables for:
    *   **Round-Number Contracts**: Tender values ending in exact Lakh multiples.
    *   **Quick-Award Anomalies**: Contracts awarded suspiciously fast (within 24 hours of bidding close).
    *   **Single-Bid Contracts**: Procurement where only one bid was received.
    *   **Repeat Winners**: Vendors winning multiple contracts from the same department.
*   🔎 **Full-Text Search**: Instantly query millions of tender titles and departments using an optimized SQLite FTS5 index.
*   🗺️ **Geographical Heatmap**: Visualize contract volume and spending values across Indian states.

---

## ⚡ Quick Start (with Sample Data)

If you don't have the 12 GB dataset yet, you can test drive the entire pipeline using synthetic data:

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/Eren-Jaeger-DEV/India-Procurement-Watch.git
    cd India-Procurement-Watch
    pip install -r requirements.txt
    ```

2.  **Generate Mock Data**:
    ```bash
    python create_sample_data.py
    ```
    This generates mock databases in your `data_dump/` folder.

3.  **Run the Server**:
    ```bash
    python app.py
    ```

4.  **Analyze**:
    *   Open **http://localhost:5000** in your browser.
    *   You will see the **Data Import** panel showing the detected mock databases.
    *   Click **Analyse Data** and watch the real-time progress bar process the files and generate the reports.

---

## 📂 Project Structure

*   `app.py` — Flask API server (delivering request-scoped SQLite connections to prevent file locks).
*   `analyse.py` — Orchestrates the full analysis pipeline (copying, schema validation, summarizing, and reporting).
*   `build_summary.py` — Aggregates millions of rows into a tiny database.
*   `build_search_index.py` — Generates the FTS5 search index.
*   `data_dump/` — Target folder for placing database files.
*   `src/analysis/` — Narrative engine rules and anomaly detection scripts.
*   `frontend/` — CSS (premium dark theme), HTML structure, and JS components.

---

## 💡 How it Works Under the Hood

To avoid querying 12 GB of raw database files directly, this tool performs one-time pre-aggregation:
1.  Moves data from `data_dump/` and builds a highly compressed `summary.db` (~50 MB).
2.  Creates a dedicated virtual search index in `search.db`.
3.  Serves dashboard views instantly using request-scoped read-only connections.

---

## 🏛️ Transparency & Accountability

*"Government has the power, but citizens must have the transparency."*

This tool runs **entirely offline** on your local machine to keep your investigative queries private.
