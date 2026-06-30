# India Procurement Watch — Power Analysis Tool (v3.0)

India Procurement Watch is a robust analytical dashboard designed for exploring public procurement data in India. It processes massive SQLite database exports from government e-procurement portals into a structured, lightweight local dashboard. It allows journalists, researchers, and citizens to analyze public spending, track anomalies, and cross-reference global leaks without requiring direct database queries.

## Key Features

*   **Machine Learning Risk Engine:** Uses `scikit-learn` Isolation Forests to flag highly anomalous contractors based on multi-dimensional behavioral data.
*   **Predictive "Pre-Crime" Alerts (Live Tenders):** Analyzes currently open tenders to catch anomalies *before* they are awarded. Uses NLP (`TfidfVectorizer`) to detect "Tailored Specs" (hyper-specific language designed to lock out competitors) and ML (`IsolationForest`) for financial anomalies.
*   **Cartel Ring Detection (Bid Rotation):** Uses Graph Theory (Union-Find algorithm) to automatically link corporate clusters (shared directors/emails) and flags them when multiple "competing" companies from the same cluster win contracts from the exact same department.
*   **Fuzzy PEP & Global Leaks Cross-Referencing:** Automatically streams and cross-references bidders against the **OpenSanctions** global database using fuzzy string matching to expose sanctioned entities and Politically Exposed Persons (PEPs)—even if they try to hide via slight misspellings.
*   **Offline Data Ingestion**: Place database files in the `data_dump/` directory and trigger the aggregation directly from your browser.
*   **Time-Series & Election Tracking:** An interactive timeline view allowing journalists to track spending spikes and rapid-award contracts leading up to state or national elections.
*   **Investigation Desk**: Dedicated tabular views to filter potential red flags:
    *   **Round-Number Contracts**: Awards ending in exact Lakh or Crore multiples.
    *   **Quick-Award Notices**: Contracts awarded within 24 hours of the bidding deadline.
    *   **Single-Bid Contracts**: Awards where only one bidder participated.
    *   **Repeat Winners**: Vendors winning multiple contracts from the same department.
    *   **Cartel Rings**: Confirmed instances of bid rotation.
    *   **Live Alerts (Pre-Crime)**: Highly anomalous live, open tenders.
*   **Risk Grading**: Assigns risk grades (A to F) to departments based on the percentage of single-bid awards and round-number contracts.
*   **Exportable Evidence:** Generate clean, watermarked PDF reports of Contractor Network graphs and Risk Grades for direct attachment in investigative journalism articles.
*   **Mobile-Responsive Field View:** A fully responsive UI layout allowing field reporters to seamlessly browse the Investigation Desk and Risk Cards on smartphones and tablets.
*   **Narrative Analysis Reports**: An automated rules engine that highlights unusual patterns, explains their implications, and suggests specific followup actions in plain English.
*   **Darshi AI Intelligence Desk:** An embedded, multi-agent AI chat interface built directly into the dashboard. Allows investigators to ask natural language questions (e.g., "Flag single bid contracts over 1 crore") and receive instant SQL-backed answers, data tables, and conversational summaries.
*   **Multi-Model LLM Orchestrator:** A powerful 3-phase ReAct pipeline that dynamically routes AI tasks:
    *   **Phase 1 (Planner):** Analyzes conversational intent and plans database queries.
    *   **Phase 2 (SQL Expert):** Writes and self-corrects SQLite queries directly against the `summary.db`.
    *   **Phase 3 (Interpreter):** Summarizes the raw data rows into a friendly, narrative response using your choice of advanced models (Gemini Flash, GPT-5.5, Claude Sonnet 4.6, DeepSeek V4).
*   **Geographical Analysis**: View contract distributions and total spending mapped across states on a fully interactive, zoomable map.
*   **Full-Text Search**: Instantly query tender titles and departments using an optimized SQLite FTS5 index.

## Project Structure

*   `app.py` — Flask API server that serves aggregate data and searches.
*   `analyse.py` — Master pipeline orchestrator that coordinates schema checks, data aggregation, ML risk scoring, Cartel detection, Sanctions matching, Live Alerts generation, and report building.
*   `build_summary.py` — Processes raw scraper logs to populate statistical tables.
*   `build_ml_risk.py` — The machine learning engine for computing Risk Scores.
*   `build_cartels.py` — Graph-based bid rotation and cartel ring detection.
*   `build_live_alerts.py` — Predictive ML and NLP on live/open tenders.
*   `src/analysis/ai_chat.py` — The multi-agent LLM orchestrator for the Darshi Intelligence Desk.
*   `build_sanctions.py` & `match_sanctions.py` — OpenSanctions ingestion and fuzzy matching pipeline.
*   `data_dump/` — The directory where raw SQLite files (`aoc_tenders.db`, etc.) should be placed.
*   `frontend/` — HTML, CSS, and Javascript dashboard files.

## Running Locally

1.  **Clone and Install**:
    ```bash
    git clone https://github.com/Eren-Jaeger-DEV/India-Procurement-Watch.git
    cd India-Procurement-Watch
    pip install -r requirements.txt
    ```
2.  **Configuration**:
    Create a `.env` file in the project root to enable the Darshi AI features:
    ```env
    ROUTING_RUN_API_KEY=your_api_key_here
    ```
3.  **Add Raw Data**:
    Drop your raw SQLite dumps (e.g., `aoc_tenders.db` and `tenders_vps.db`) into the `data_dump/` folder.
    *Note: For the Cartel Ring detection to work, you must also place your corporate linkage files (`nodes.csv` and `edges.csv`) in the `data_dump/` folder.*
3.  **Run the Server**:
    ```bash
    python app.py
    ```
4.  **Process and View**:
    Open `http://localhost:5000` in your web browser. Click **Analyse Data** on the import screen to run the aggregation pipeline.

## VPS Deployment (Production)

The tool is designed to be hosted publicly on a VPS (e.g., AWS EC2, DigitalOcean Droplet, Linode) to share with the public.

1.  **Install System Dependencies**:
    Ensure you have `python3`, `pip`, and `git` installed on your VPS.
    ```bash
    sudo apt update
    sudo apt install python3 python3-pip python3-venv git
    ```
2.  **Clone & Setup Environment**:
    ```bash
    git clone https://github.com/Eren-Jaeger-DEV/India-Procurement-Watch.git
    cd India-Procurement-Watch
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    ```
3.  **Transfer Data**:
    Upload your `data_dump/` files to the VPS (using `scp` or a cloud storage provider).
4.  **Production WSGI Server (Gunicorn)**:
    Do not use the built-in Flask development server in production. Install Gunicorn:
    ```bash
    pip install gunicorn
    ```
5.  **Run with Gunicorn**:
    Run the app on port 80 (requires root/sudo, or use a reverse proxy like Nginx to route port 80 to 5000):
    ```bash
    gunicorn -w 4 -b 0.0.0.0:5000 app:app
    ```
6.  **Reverse Proxy (Recommended)**:
    For best performance, configure Nginx to serve the `frontend/` static files directly and proxy API requests to Gunicorn.

## Offline Privacy

All processing is executed locally on your machine. No search queries or database files are uploaded to external servers.

## Credits & Contributions

**Data Sourcing & Scraping Pipeline**: 
This dashboard visualizes data scraped and provided by **[Sarthak Sidhant's India Procurement Watch](https://tender.sarthaksidhant.com)**. The immense SQLite databases containing millions of AOC notices and published tenders are generated by his scraping architecture.

The **Director Networks** graph feature matches bidder names to official corporate profiles (CIN) and extracts connections such as shared registration emails or physical addresses.
This dataset mapping, name normalization, and record-linkage architecture was designed and developed by:
*   [fireboy-dev/india-procurement-company-director](https://github.com/fireboy-dev/india-procurement-company-director)

The **V4 Statistical Rigor Update** was deeply inspired by the mathematical rigor and deep procurement models developed by:
*   [abcde-stack/tender-watch](https://github.com/abcde-stack/tender-watch)
Their use of the Herfindahl-Hirschman Index (HHI) for department concentration and their exact definitions for Deep Procurement Flags have been adapted and injected directly into our V4 engine.

The **V5 "Unbeatable" Anti-Corruption Suite** (including Predictive Live Alerts, Cartel Ring Detection via Graph Theory, and Fuzzy PEP matching) was implemented directly in this repository to provide an unmatched investigative intelligence tool.

## ⚠️ Disclaimer & Caution

*   **For Research & Investigation Only:** This tool is designed to assist journalists, researchers, and citizens in exploring public procurement data. It is **not** a judicial or legal tool.
*   **Anomalies Do Not Equal Guilt:** The machine learning risk models, cartel detection algorithms, and statistical flags highlight *anomalous patterns* (e.g., bid rotation, exact-match values). These are mathematical red flags requiring human investigation, not definitive proof of corruption, fraud, or legal wrongdoing.
*   **False Positives in Sanctions Matching:** The OpenSanctions cross-referencing—especially the Fuzzy Matching algorithms—can and will produce false positives due to shared names. You must **always verify identities** through official corporate registries (e.g., MCA in India) and legal channels before publishing accusations or reports.
*   **No Liability:** The developers, contributors, and data providers (including Sarthak Sidhant's India Procurement Watch) assume no liability or responsibility for how this tool or its generated reports are used, interpreted, or published.

## 🔒 Privacy Policy

*   **100% Local Processing:** When running this tool locally, all data ingestion, machine learning, graph processing, and search querying happens directly on your machine.
*   **No Data Exfiltration:** The application does not upload your search queries, generated narrative reports, or imported SQLite databases to any external servers.
*   **No Telemetry:** We do not use tracking cookies, analytics, or telemetry of any kind.
*   **VPS Deployment Caution:** If you choose to host this dashboard publicly on a VPS, you are solely responsible for securing the endpoint, managing user access, and complying with the data privacy laws (such as the DPDP Act in India) applicable to your jurisdiction.
