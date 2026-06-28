# India Procurement Watch — Power Analysis Tool (v3.0)

India Procurement Watch is a robust analytical dashboard designed for exploring public procurement data in India. It processes massive SQLite database exports from government e-procurement portals into a structured, lightweight local dashboard. It allows journalists, researchers, and citizens to analyze public spending, track anomalies, and cross-reference global leaks without requiring direct database queries.

## Key Features

*   **Machine Learning Risk Engine:** Uses `scikit-learn` Isolation Forests to flag highly anomalous contractors based on multi-dimensional behavioral data.
*   **Global Leaks & PEP Cross-Referencing:** Automatically streams and cross-references bidders against the **OpenSanctions** global database to expose sanctioned entities and Politically Exposed Persons (PEPs) participating in Indian tenders.
*   **Time-Series & Election Tracking:** An interactive timeline view allowing journalists to track spending spikes and rapid-award contracts leading up to state or national elections.
*   **Exportable Evidence:** Generate clean, watermarked PDF reports of Contractor Network graphs and Risk Grades for direct attachment in investigative journalism articles.
*   **Mobile-Responsive Field View:** A fully responsive UI layout allowing field reporters to seamlessly browse the Investigation Desk and Risk Cards on smartphones and tablets.
*   **Narrative Analysis Reports**: An automated rules engine that highlights unusual patterns, explains their implications, and suggests specific follow-up actions in plain English.
*   **Geographical Analysis**: View contract distributions and total spending mapped across states on a fully interactive, zoomable map.

## Project Structure

*   `app.py` — Flask API server that serves aggregate data and searches.
*   `analyse.py` — Master pipeline orchestrator that coordinates schema checks, data aggregation, ML risk scoring, Sanctions matching, and report generation.
*   `build_summary.py` — Processes raw scraper logs to populate statistical tables.
*   `build_ml_risk.py` — The machine learning engine for computing Risk Scores.
*   `build_sanctions.py` & `match_sanctions.py` — OpenSanctions ingestion and matching pipeline.
*   `data_dump/` — The directory where raw SQLite files (`aoc_tenders.db`, etc.) should be placed.
*   `frontend/` — HTML, CSS, and Javascript dashboard files.

## Running Locally

1.  **Clone and Install**:
    ```bash
    git clone https://github.com/Eren-Jaeger-DEV/India-Procurement-Watch.git
    cd India-Procurement-Watch
    pip install -r requirements.txt
    ```
2.  **Add Raw Data**:
    Drop your raw SQLite dumps (e.g., `aoc_tenders.db` and `tenders_vps.db`) into the `data_dump/` folder.
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
