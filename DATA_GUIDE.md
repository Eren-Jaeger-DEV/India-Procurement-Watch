# The Data Guide — Running the dashboard with real data

So you want to analyze the actual 12GB dataset of India's procurement data? You're in the right place. This guide walks you through getting the raw SQLite files and hooking them up to the dashboard.

---

## 1. The origin story

This dashboard is designed to visualize data scraped by **[Sarthak Sidhant's India Procurement Watch](https://tender.sarthaksidhant.com)**. 
It pulls Award of Contract (AOC) notices and published tender records from:
- **GeM** (Government e-Marketplace)
- **CPPP** (Central Public Procurement Portal)
- Over 30 different **state portals** (like Punjab, Maharashtra, Kerala, etc.)

In total, you're looking at nearly **50 lakh (5 million) awarded contracts** from 2011 to 2026.

---

## 2. Get the SQLite files

If you want the exact dataset we tested with, you'll need to reach out to the project at [tender.sarthaksidhant.com](https://tender.sarthaksidhant.com) and ask for the SQLite dump. 

You're looking for two files:
- `aoc_tenders.db` (~6.6 GB) — The awarded contracts
- `tenders_vps.db` (~6.3 GB) — The published tenders

*(Building your own scraper? Just make sure your SQLite output matches the schema described in the README).*

---

## 3. Check your specs

Before you start crunching 12GB of data, make sure your machine can handle it:
- **Disk space:** Make sure you have at least 25GB free (the raw data + search indexes take up space).
- **RAM:** 4GB is okay, but 8GB is better for the search index build.
- **Python:** Needs to be 3.9 or newer.

---

## 4. Drop the databases in

First, grab the code:
```bash
git clone https://github.com/Eren-Jaeger-DEV/India-Procurement-Watch.git
cd India-Procurement-Watch
pip install -r requirements.txt
```

Now, take those massive `.db` files and just drop them straight into the main project folder. Your folder should look like this:

```text
India-Procurement-Watch/
├── aoc_tenders.db        ← drop it here
├── tenders_vps.db        ← drop it here
├── app.py
├── build_summary.py
└── ...
```

*(Note: If you only have `aoc_tenders.db`, that's completely fine. The dashboard will just leave the published tenders charts empty).*

---

## 5. Crunch the numbers

We don't want the dashboard querying 12GB of data every time you click a button. So, we pre-compute all the chart data into a tiny `summary.db` file.

Run this:
```bash
python build_summary.py
```

Grab a coffee. It takes about **3–4 minutes** on a decent SSD. You'll see a bunch of terminal output tracking the progress, ending with "DONE".

---

## 6. Build the search engine

Next up, we need to build the full-text search index so you can instantly search through 5 million tender titles.

Run these two commands:
```bash
python build_search_index.py
python optimize_fts.py
```

This takes another **2–3 minutes**. 

*(Don't care about search? You can skip this step entirely. The dashboard will still work, the search bar will just be a bit slower).*

---

## 7. Fire it up

That's it. The heavy lifting is done. Start the web server:

```bash
python app.py
```

Head over to **http://localhost:5000** in your browser. The dashboard should load instantly.

---

## Running it 24/7

If you want to leave this running on a server or in the background:

**On Windows:** Just open a dedicated PowerShell window, run `python app.py`, and minimize it.

**On macOS / Linux:**
```bash
nohup python app.py &> dashboard.log &
echo "Dashboard running at http://localhost:5000"
```

---

## Updating data later

If you download fresh `.db` files later, you just need to re-run the build scripts to update the dashboard:

```bash
python build_summary.py
python build_search_index.py
python optimize_fts.py
python app.py
```

---

## Things that might go wrong

- **Dashboard is stuck on "Building Summary Database…"**
  You probably forgot to run `build_summary.py`, or it crashed. Check the terminal.
  
- **Search returns nothing**
  You need to run `build_search_index.py`.
  
- **`build_summary.py` throws a "no such table" error**
  Your database schema doesn't match what the scripts expect. Check the README for the exact table names required.
  
- **Port 5000 is already in use**
  Open `app.py`, scroll to the very bottom, and change `port=5000` to `port=5001`.
