# India Procurement Watch (IPW) — Project Encyclopedia

Welcome to the comprehensive documentation for **India Procurement Watch (v6.0)**. This document serves as the master wiki, covering every aspect of the platform's architecture, intelligence engines, server infrastructure, and monitoring systems.

---

## 1. Project Mission & Overview
India Procurement Watch is an advanced analytical intelligence platform designed to parse, aggregate, and investigate massive troves of public procurement data from the Indian government (GeM, CPPP, and state portals). 

It allows journalists, researchers, and citizens to track spending, identify corruption red flags (cartels, single-bids), and cross-reference global leaks without requiring direct database access.

---

## 2. Platform Architecture
The IPW platform is divided into a robust, decoupled architecture:

### 🎨 The Frontend (React + Vite)
Located in `frontend_v2/`, the user interface is a modern, mobile-responsive React application built with Vite.
*   **Investigation Desk:** A tabbed interface to filter high-risk contracts (Single-Bid, Repeat Winners, Round Numbers).
*   **Network Graph Viewer:** Uses `vis-network` to visualize complex cartel rings and shared corporate directors.
*   **Data Import Status:** A clean UI to trigger local data pipelines and check ingestion progress.
*   **Mobile-First:** A fully responsive bottom-navigation design specifically tailored for field reporters using smartphones.

### ⚙️ The Backend (Python Flask)
Located at `app.py`, this is the core API server that serves data to the React frontend.
*   **Stateless API:** Connects securely to the database to serve aggregate metrics, search results, and node graphs.
*   **Lightweight:** Designed to be run in production using `Gunicorn` with multiple worker processes.

### 🧠 The Analysis Engine (`src/analysis/`)
The brain of the platform. A collection of Python modules that perform heavy lifting:
*   `build_ml_risk.py`: Uses **Machine Learning (Isolation Forests)** to assign Risk Grades to government departments.
*   `build_cartels.py`: Uses **Graph Theory (Union-Find)** to detect bid-rotation and cartel rings among competing companies.
*   `build_live_alerts.py`: Uses **NLP (`TfidfVectorizer`)** to scan live, open tenders for "Tailored Specs" (pre-crime alerts).
*   `ai_chat.py` & `nlp_router.py`: The **Darshi Intelligence Desk** — a multi-agent ReAct pipeline that translates natural language queries into SQL, runs them, and streams the results back using Server-Sent Events (SSE).
*   `match_sanctions.py`: Fuzzy matches bidders against the **OpenSanctions** global database for PEP (Politically Exposed Persons) tracking.

---

## 3. Server Infrastructure
For production deployment, the platform is hosted across two dedicated Virtual Private Servers (VPS) to ensure security and performance.

### 🌐 Server 1: Dashboard VPS (`[REDACTED_DASHBOARD_IP]`)
The public-facing application server (4 Cores, 4GB RAM).
*   **Hosts:** The React Frontend (via Nginx/Static routing) and the Flask Backend (via Gunicorn).
*   **Network:** Open to the public internet (Ports 80/443).
*   **User:** `victor`

### 🗄️ Server 2: Database VPS (`[REDACTED_DATABASE_IP]`)
The secure, heavy-duty data fortress (8 Cores, 8GB RAM).
*   **Hosts:** PostgreSQL Database Server containing millions of rows of `aoc_tenders` and `mca_data`.
*   **Security (Tailscale):** This server is **not** exposed to the public internet. It is only accessible via the private Tailscale mesh network. The Dashboard VPS queries this database securely over Tailscale.
*   **User:** `paan.day` / `victor`

---

## 4. Continuous Monitoring (Darshi Bot)
To ensure 24/7 uptime and visibility, a dedicated Discord bot runs permanently on the Dashboard VPS. 

*   **Location:** `F:\projects\Darshi bot\` (Local) / `/home/victor/darshi-bot` (VPS).
*   **Process Manager:** Kept alive indefinitely by **PM2** (`pm2 start bot.py`). It automatically boots on server restart via `systemd`.
*   **Architecture:** It does **not** use slow SSH loops. It runs natively on the Dashboard VPS and talks directly to the DB VPS over Tailscale.

### What it Monitors:
1.  **`#dashboard-logs`**: Tails the system `journalctl -u ipw` in real-time. Immediately streams web crashes, HTTP 500s, and worker restarts to Discord.
2.  **`#db-logs`**: Connects via `psycopg2` to the DB VPS every 30 seconds. It polls for:
    *   **Slow Queries:** Any SQL query taking longer than 5 seconds.
    *   **Connection Counts:** Idle vs Active Postgres connections to prevent connection starvation.
    *   **Cache Hit %**: Memory efficiency.
    *   **Database Size**: Storage tracking.

---

## 5. The Data Pipeline (Ingestion)
When dealing with massive local datasets, the ingestion pipeline safely builds the intelligence layer.

1.  **Drop Raw Files:** Raw SQLite dumps (`aoc_tenders.db`, `tenders_vps.db`) are placed in `data_dump/`.
2.  **Trigger `analyse.py`:** Can be triggered via terminal or the React UI.
3.  **Pipeline Steps:**
    *   *Validate Schemas:* Ensures the dropped DBs match expected structures.
    *   *Build Summaries:* Pre-aggregates millions of rows into a fast `summary.db` for the frontend.
    *   *Index Search:* Builds a high-speed FTS5 (Full Text Search) index for instant keyword lookups.
    *   *Run ML/AI:* Triggers the Cartel, NLP, and Risk algorithms to flag anomalies.

---

## 6. Privacy & Security Policies
*   **Zero Telemetry:** The platform does not track user behavior or use analytics.
*   **Air-Gapped Data:** All SQLite aggregations happen locally. Only API queries to LLM providers (if configured) leave the network.
*   **Protected DB:** The production PostgreSQL database is inaccessible from the internet, heavily guarded behind Tailscale.
*   **No Hardcoded Secrets:** All API keys, Discord tokens, and database passwords are strictly managed via `.env` files and `.gitignore`.
