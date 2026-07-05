# The Data Guide — Connecting the Dashboard

This dashboard visualizes data scraped by **[Sarthak Sidhant's India Procurement Watch](https://tender.sarthaksidhant.com)**. It pulls Award of Contract (AOC) notices and published tender records from GeM, CPPP, and over 30 state portals.

This guide walks you through connecting your application to the dataset.

## 1. The PostgreSQL Requirement

In Version 6.0, the backend was migrated from local SQLite processing to a robust **PostgreSQL** architecture to handle millions of rows simultaneously without locking.

You must have a PostgreSQL database available (either locally on your machine, or hosted remotely/on a VPS).

The backend expects the following tables to exist in your PostgreSQL database:
*   `aoc_tenders` (Award of Contract notices)
*   `aoc_details` (Extended JSON metadata for AOCs)
*   `tenders` (Published tender notices - Optional)
*   `mca_data` (Corporate registry data for Director matching - Optional)

## 2. Connecting the Backend

The Flask backend connects to PostgreSQL entirely via the `DATABASE_URL` environment variable.

1. Create a `.env` file inside the `backend/api/` directory.
2. Add your PostgreSQL connection string:
   ```env
   DATABASE_URL=postgresql://username:password@host:port/database_name
   ```
3. If you are using the AI Intelligence Desk features, you must also add your LLM API key here:
   ```env
   ROUTING_RUN_API_KEY=your_api_key_here
   ```

## 3. Migrating Old SQLite Data

If you have requested and received a raw `.db` (SQLite) dump from the project maintainers, you can easily migrate this data into your local PostgreSQL instance using the provided migration script.

1. Place the raw SQLite files (e.g., `aoc_tenders.db`) into the `backend/databases/` directory.
2. Ensure your `.env` file has the `DATABASE_URL` pointing to an empty PostgreSQL database.
3. Run the migration script:
   ```bash
   cd backend/databases
   python migrate_to_local_pg.py
   ```
This script will automatically create the necessary schemas in your PostgreSQL database and stream the millions of rows from SQLite into Postgres in heavy batches.

## 4. Running the Pipelines

Once connected to Postgres, the application works entirely out of the box. The frontend and backend communicate instantly without any required local indexing steps.

### Running Locally (Windows)
We provide two batch scripts in the project root to instantly launch the environments:
- `run_backend.bat` (Starts the Flask server on port 5000)
- `run_frontend.bat` (Starts the React server on port 3000)
