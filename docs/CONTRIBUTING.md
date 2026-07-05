# Contributing to India Procurement Watch

First off, thank you for considering contributing to India Procurement Watch (IPW)! It's people like you that make this analytical tool powerful enough to uncover corruption and bring transparency to public procurement.

## How Can I Contribute?

### 1. Reporting Bugs
If you find a bug in the dashboard, the data aggregation pipeline, or the AI integrations, please open an issue on GitHub.
*   **Check existing issues** to make sure the bug hasn't already been reported.
*   **Include steps to reproduce** the bug.
*   **Attach screenshots** if the bug is UI-related (e.g., in the Darshi AI interface).

### 2. Suggesting Enhancements
Have an idea for a new data aggregation algorithm, a new AI feature, or a UI improvement?
*   Open an issue clearly detailing the enhancement.
*   Explain *why* this enhancement would be useful to investigators or journalists.

### 3. Submitting Pull Requests (PRs)
1.  **Fork the repository** and create your branch from `main`.
2.  If you've added new Python scripts, ensure they are integrated smoothly into the main `analyse.py` orchestrator.
3.  If you've modified the AI/LLM logic (e.g., in `ai_chat.py`), ensure you test the prompt changes against both conversational and data-driven intents.
4.  Make sure your code follows standard PEP 8 styling for Python and clean, commented Javascript.
5.  Issue a Pull Request!

## Development Setup

To set up your local development environment:
1. Clone your fork: `git clone https://github.com/YOUR_USERNAME/India-Procurement-Watch.git`
2. Install dependencies: `pip install -r requirements.txt`
3. Add your `ROUTING_RUN_API_KEY` to a `.env` file to enable AI features.
4. Drop sample SQLite data into `data_dump/`.
5. Run the server: `python app.py`

## Data Privacy
**CRITICAL:** India Procurement Watch is designed as an offline-first tool for sensitive investigations. When submitting code changes, do not include any logic that phones home, tracks analytics, or uploads the user's SQLite databases to external servers. All data processing must remain localized to the user's machine, except for explicit LLM API calls which are documented.

Thank you for helping us keep public procurement transparent!
