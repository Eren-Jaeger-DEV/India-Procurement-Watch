# India Procurement Watch — Power Analysis Tool (v6.0)

India Procurement Watch is a robust analytical dashboard designed for exploring public procurement data in India. It processes massive database exports from government e-procurement portals into a structured, lightweight local dashboard. It allows journalists, researchers, and citizens to analyze public spending, track anomalies, and cross-reference global leaks.

## Key Features
*   **Machine Learning Risk Engine:** Flags highly anomalous contractors based on multi-dimensional behavioral data.
*   **Cartel Ring Detection:** Uses Graph Theory to automatically link corporate clusters (shared directors/emails) and flags bid rotation.
*   **Fuzzy PEP & Global Leaks:** Automatically cross-references bidders against the **OpenSanctions** global database.
*   **Investigation Desk**: Dedicated tabular views to filter potential red flags (Single-Bid Contracts, Repeat Winners, Round-Number Contracts).
*   **Darshi AI Intelligence Desk:** An embedded, multi-agent AI chat interface that translates natural language queries into SQL, runs them, and streams the results back in real-time.
*   **Buttery Smooth UI:** Built with React + Vite, leveraging lazy loading and a highly optimized Flask backend with in-memory caching.

## Project Layout

The repository is cleanly split into two main environments:

*   **`frontend/`** — The React application (UI/UX).
*   **`backend/`** — The Flask API server, data extraction logic, and local database storage.
*   **`docs/`** — Deep-dive architectural documentation and data setup guides.

## Running Locally (Windows)

We have provided simple batch scripts in the root directory to instantly spin up the application on your local machine.

1. **Start the Backend:**
   Run the backend batch script (this activates the virtual environment and starts the Flask server on port 5000).
   ```bash
   run_backend.bat
   ```

2. **Start the Frontend:**
   Run the frontend batch script (this starts the Vite development server on port 3000).
   ```bash
   run_frontend.bat
   ```

## Deep-Dive Documentation

For detailed technical specifications, API architecture, and VPS deployment instructions, please refer to the `docs/` folder:

*   📘 **[The Encyclopedia (Architecture & Deployment)](docs/ENCYCLOPEDIA.md)**: Master wiki covering the Flask Blueprints, React architecture, and our Tailscale VPS setup.
*   📊 **[The Data Guide (Database Connection)](docs/DATA_GUIDE.md)**: Guide on how to connect your PostgreSQL database and migrate old SQLite files.
*   🤝 **[Contributing Guide](docs/CONTRIBUTING.md)**: Developer onboarding rules and guidelines.

## ⚠️ Disclaimer & Caution

*   **For Research & Investigation Only:** This tool is designed to assist journalists, researchers, and citizens. It is **not** a judicial or legal tool.
*   **Anomalies Do Not Equal Guilt:** The machine learning risk models flag *anomalous patterns*. These are mathematical red flags requiring human investigation, not definitive proof of corruption.
*   **False Positives:** Name-matching algorithms can produce false positives. You must **always verify identities** through official corporate registries before publishing accusations.

## 🔒 Privacy Policy

*   **Local Processing:** All processing happens directly against your connected database.
*   **AI API Requests:** If you use the Darshi Intelligence Desk, natural language queries are sent to the configured LLM API. 
*   **No Telemetry:** We do not use tracking cookies, analytics, or telemetry of any kind.
