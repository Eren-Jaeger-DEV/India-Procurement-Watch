# India Procurement Watch (IPW) — Project Encyclopedia

Welcome to the comprehensive documentation for **India Procurement Watch (v6.0)**. This document serves as the master wiki, covering every aspect of the platform's optimized architecture, intelligence engines, server infrastructure, and monitoring systems.

---

## 1. Project Mission & Overview
India Procurement Watch is an advanced analytical intelligence platform designed to parse, aggregate, and investigate massive troves of public procurement data from the Indian government (GeM, CPPP, and state portals). 

It allows journalists, researchers, and citizens to track spending, identify corruption red flags (cartels, single-bids), and cross-reference global leaks without requiring direct database access.

---

## 2. Platform Architecture
The IPW platform is divided into a robust, decoupled architecture with a strict separation of concerns:

### 🎨 The Frontend (`frontend/`)
Built with **React and Vite**, this is the user-facing dashboard. 
*   **Lazy Loading:** The React application heavily utilizes `React.lazy()` and `Suspense`. This ensures the browser only downloads the code required for the current page, resulting in near-instant load times.
*   **Investigation Desk:** A tabbed interface to filter high-risk contracts (Single-Bid, Repeat Winners, Round Numbers).
*   **Network Graph Viewer:** Uses `vis-network` to visualize complex cartel rings and shared corporate directors.
*   **Mobile-First:** A fully responsive bottom-navigation design specifically tailored for field reporters using smartphones.

### ⚙️ The Backend (`backend/api/`)
The core API server built with **Python Flask** and structured using a modular **Blueprint architecture**.
*   **`app.py`:** The main entry point. It initializes CORS, Rate Limiting, and registers all blueprints.
*   **`routes/`:** Contains the Flask Blueprints. Heavy endpoints like `/api/kpis` and `/api/trends` have their own dedicated files (`kpi.py`, `trends.py`) for clean separation.
*   **`core/`:** Contains core backend utilities. `db.py` handles the request-scoped PostgreSQL connections, and `cache.py` initializes the in-memory cache.
*   **Distributed Caching (Redis):** Uses `Flask-Caching` and `Flask-Limiter` backed by **Redis**. This perfectly synchronizes API rate limits and cached dashboard results (like Trends) across all Gunicorn workers. It automatically falls back to `SimpleCache` (in-memory) if Redis is unavailable for local development.

### 🧠 The Intelligence Engine
*   **Machine Learning (Isolation Forests):** Assigns Risk Grades to government departments.
*   **Graph Theory (Union-Find):** Detects bid-rotation and cartel rings among competing companies.
*   **NLP & Live Alerts:** Uses `TfidfVectorizer` to scan live, open tenders for "Tailored Specs" (pre-crime alerts).
*   **Darshi Intelligence Desk:** A multi-agent ReAct pipeline (`ai_chat.py` & `nlp_router.py`) that translates natural language queries into SQL, runs them against the database, and streams the results back using Server-Sent Events (SSE).
*   **Fuzzy Sanctions Matching:** Fuzzy matches bidders against the **OpenSanctions** global database for PEP (Politically Exposed Persons) tracking.

---

## 3. Server Infrastructure
For production deployment, the platform is hosted across two dedicated Virtual Private Servers (VPS) to ensure security and performance.

### 🌐 Server 1: Dashboard VPS (`[REDACTED_DASHBOARD_IP]`)
The public-facing application server (4 Cores, 4GB RAM).
*   **Hosts:** The React Frontend (via Nginx/Static routing) and the Flask Backend (via Gunicorn and UNIX sockets).
*   **Network:** Open to the public internet (Ports 80/443).
*   **User:** `victor`

### 🗄️ Server 2: Database VPS (`[REDACTED_DATABASE_IP]`)
The secure, heavy-duty data fortress (8 Cores, 8GB RAM).
*   **Hosts:** PostgreSQL Database Server containing millions of rows of `aoc_tenders` and `mca_data`.
*   **Security (Tailscale):** This server is **not** exposed to the public internet. It is only accessible via the private Tailscale mesh network. The Dashboard VPS connects securely via `DATABASE_URL`.
*   **User:** `paan.day` / `victor`

---

## 4. Continuous Monitoring (Darshi Bot)
To ensure 24/7 uptime and visibility, a dedicated Discord bot runs permanently on the Dashboard VPS. 

*   **Location:** `/home/victor/darshi-bot` (VPS).
*   **Process Manager:** Kept alive indefinitely by **PM2** (`pm2 start bot.py`). It automatically boots on server restart via `systemd`.

### What it Monitors:
1.  **`#dashboard-logs`**: Tails the system `journalctl -u ipw` in real-time. Immediately streams web crashes, HTTP 500s, and worker restarts to Discord.
2.  **`#db-logs`**: Connects via `psycopg2` to the DB VPS. It polls for slow queries, idle connections, and memory efficiency.

---

## 5. Privacy & Security Policies
*   **Zero Telemetry:** The platform does not track user behavior or use analytics.
*   **Air-Gapped Data:** All PostgreSQL queries are executed locally on the secure Tailscale mesh. Only API queries to LLM providers (if configured) leave the network.
*   **Protected DB:** The production PostgreSQL database is completely inaccessible from the internet.
*   **No Hardcoded Secrets:** All API keys, Discord tokens, and database passwords are strictly managed via `.env` files.
