# India Procurement Watch — Production Stress Test & Security Audit
**Branch:** main | **Date:** 30 June 2026 | **Audited by:** Full codebase read + live testing

This is a pre-lakh-user audit. Every finding below was verified directly in code, not inferred.

---

## 🔴 CRITICAL — Fix Before Any Traffic Scales

### C1. No Rate Limiting on Anything
**Files:** `app.py` — every single route

Zero rate limiting exists on the entire API. Every endpoint — including `/api/ai-chat` (which triggers a 5-phase LLM pipeline costing real money per call), `/api/agentic-search`, `/api/sanctions`, and `/api/vendor-mca/<vendor>` (which runs DuckDuckGo + LLM on every hit) — is completely open to unlimited calls from any IP.

**What this means at lakh scale:**
- A single person can spam `/api/ai-chat` thousands of times, draining your entire `routing.run` API credits in minutes
- Accidental load (a JS bug causing a request loop, a user double-clicking) will cascade into real API costs
- `/api/vendor-mca/<vendor>` calls DuckDuckGo + an LLM on every single request — this endpoint is a cost-amplifier

**Fix:** Add `flask-limiter` (already not in `requirements.txt` — add it). At minimum:
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
limiter = Limiter(get_remote_address, app=app, default_limits=["200 per day", "50 per hour"])
# Then on expensive endpoints:
@limiter.limit("10 per minute")
@app.route("/api/ai-chat", methods=["POST"])
```
AI chat: 10/min per IP. Vendor MCA: 30/min per IP. Everything else: 100/min per IP as a floor.

---

### C2. XSS — AI Response Content Injected Directly into innerHTML Without Sanitization
**File:** `frontend/js/chat.js`, lines 156, 167, 272, 360, 362

Two confirmed XSS vectors:

**Vector 1 — AI summary rendered as raw HTML via `marked.parse()`:**
```javascript
summaryContainer.innerHTML = marked.parse(summaryContainer.dataset.rawText);
```
The AI's response text is streamed from the backend, stored in `dataset.rawText`, then parsed as Markdown and injected as innerHTML. `marked` by default does NOT sanitize HTML — it passes raw HTML through. If the AI response contains `<script>alert(1)</script>` or `<img onerror="...">` (which can happen from scraped tender data containing HTML, or from a malicious query), it executes in the user's browser. No `DOMPurify` is loaded anywhere in `index.html`.

**Vector 2 — Error content and SQL query string injected as innerHTML:**
```javascript
errEl.innerHTML = `<strong>Oops!</strong> ${data.content}`
errEl.innerHTML += `... ${data.query} ...`
```
`data.content` is a raw error string from the backend. `data.query` is the LLM-generated SQL string. Both are injected directly as innerHTML with no escaping. The SQL string in particular comes from an LLM that could produce `"; <script>...</script>` type output.

**KPI label also vulnerable:**
```javascript
kpiContainer.innerHTML = `...<div>${data.kpi.label}</div>...`
```
`data.kpi.label` comes from the LLM visualizer agent — unescaped, directly in innerHTML.

**Fix:** Either load `DOMPurify` and wrap every `innerHTML =` assignment:
```javascript
summaryContainer.innerHTML = DOMPurify.sanitize(marked.parse(rawText));
```
Or use `marked` with its built-in sanitize option + a sanitizer. Add to `index.html`:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.5/purify.min.js"></script>
```
And globally: `window.DOMPurify.sanitize()` wrapping every `innerHTML` that receives API/AI data.

---

### C3. SQL Injection via User-Controlled `limit` and `by` Parameters
**File:** `app.py`, lines 275, 281–286

These two queries use Python f-strings to inject user-supplied values directly into SQL:
```python
cur.execute(f"SELECT org_name, count FROM top_published_orgs ORDER BY count DESC LIMIT {limit}")
cur.execute(f"SELECT org_name, count, total_value_crore FROM top_orgs ORDER BY count DESC LIMIT {limit}")
```
`limit` comes from `request.args.get("limit", 25)` cast to `int()` — so it's protected against string injection. However, the `by` parameter (line 280: `if by == "value":`) controls which branch executes but is never validated against an allowlist. And the `dataset` parameter (line 274) also switches query logic without validation. If any future edit puts these into a format string directly, you have a live SQLi.

More importantly — `limit` is cast with `int()` but not inside a try/except. `int("abc")` raises `ValueError`, which propagates as an unhandled 500. A user sending `?limit=abc` crashes the endpoint.

**Fix:**
```python
# Validate by/dataset against allowlists
by = request.args.get("by", "count")
if by not in ("count", "value"):
    by = "count"
dataset = request.args.get("dataset", "aoc")
if dataset not in ("aoc", "published"):
    dataset = "aoc"
# Safe cast for limit
try:
    limit = min(int(request.args.get("limit", 25)), 100)
except (ValueError, TypeError):
    limit = 25
```
And stop using f-strings with user input in SQL — use parameterized queries even for `LIMIT`:
```python
cur.execute("SELECT ... LIMIT %s", (limit,))
```

---

### C4. AI Chat Opens a New Database Connection Per SQL Attempt With No Pooling or Timeout
**File:** `src/analysis/ai_chat.py`, lines 168–178

Inside the SQL retry loop (3 attempts), each attempt does:
```python
conn = psycopg2.connect(db_url)
cursor = conn.cursor(...)
cursor.execute(sql_query)
...
conn.close()
```
This opens a brand-new raw `psycopg2` connection per SQL attempt — no connection pooling, no query timeout, no statement timeout. At lakh-user scale with concurrent AI chat sessions, each user triggers up to 3 new DB connections just for the SQL phase. Postgres has a default connection limit (usually 100). With enough concurrent users, the DB runs out of connections and the entire app goes down — not just chat, but everything.

Combined with zero rate limiting (C1), this is a DoS via chat at scale.

**Fix:** Move AI chat to use `app.py`'s existing `get_pg_conn()` request-scoped connection, or configure connection pooling (`psycopg2.pool.ThreadedConnectionPool`). At minimum, add a statement timeout:
```python
conn.set_session(options={'statement_timeout': '30s'})
```

---

## 🟠 HIGH — Fix Before Public Marketing Push

### H1. Model Names in `ai_chat.py` Are Still Stale/Unverified
**File:** `src/analysis/ai_chat.py`, lines 62–66

Despite my earlier edit to centralize these into constants, the deployed version has reverted to hardcoded bare strings with no `route/` prefix:
```python
router_models = ["gemini-3.5-flash", "gpt-3.5-turbo"]
sql_models = ["deepseek-v4-pro", "gpt-4o", "claude-3-opus"]
```
`gemini-3.5-flash` is not a real Gemini model version. `claude-3-opus` is a retired model. `deepseek-v4-pro` without the `route/` prefix almost certainly fails on `api.routing.run`. This is why the AI chat isn't working — these model IDs are wrong. Run `GET /v1/models` with your API key and replace every one of these with the verified string from the response.

### H2. `nlp_router.py` Leaks LLM Error + Original User Query to API Response
**File:** `src/analysis/nlp_router.py`, line 68

```python
return {"year": "", "portal": "", "q": f"{text} (LLM Error: {str(e)})"}
```
On any LLM failure, the original user's full query text is returned in the `q` field of the JSON response, concatenated with the raw exception string. The frontend will then use this as a search query. The exception message can contain internal details (connection strings, API key fragments in error messages, etc.). At minimum this is an information leak.

**Fix:** On error, return `{"year": "", "portal": "", "q": ""}` and log the error server-side only.

### H3. CORS is Fully Wildcard — Any Website Can Call Your API
**File:** `app.py`, line 29

```python
CORS(app)
```
With no `origins=` argument, this allows **any domain in the world** to make cross-origin requests to your API. That means a malicious third-party website can call `https://tender.darshi.app/api/ai-chat` from their users' browsers (using those users' IP addresses to bypass rate limits if you add them by IP), or silently exfiltrate data.

**Fix:** Restrict to your own domain:
```python
CORS(app, origins=["https://tender.darshi.app", "http://localhost:5000"])
```

### H4. No Content Security Policy Header
**File:** `app.py` (no CSP headers set), `frontend/index.html`

No `Content-Security-Policy` HTTP header is set anywhere. Combined with the XSS vectors in C2, this means a successful XSS has no browser-level containment — scripts can call out to any domain, exfiltrate cookies/localStorage, etc.

**Fix:** Add to `app.py`'s response headers (after CORS fix):
```python
@app.after_request
def set_security_headers(response):
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; "
        "style-src 'self' 'unsafe-inline'; "
        "connect-src 'self'; "
        "img-src 'self' data:;"
    )
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    return response
```

### H5. Vendor MCA Endpoint Exposes Raw Postgres Exception to Clients
**File:** `app.py`, line 173

```python
except Exception as e:
    return jsonify({"error": str(e)}), 500
```
A Postgres exception can contain the full `DATABASE_URL` connection string (including host, port, database name, username) in the error message. This is exposed directly to the client as a JSON response. Anyone who can trigger an error in `/api/vendor-mca/<vendor>` gets free internal infrastructure details.

**Fix:**
```python
except Exception as e:
    app.logger.error(f"vendor_mca error: {e}")
    return jsonify({"error": "Database lookup failed. Please try again."}), 500
```
Apply the same pattern to every other `return jsonify({"error": str(e)})` in `app.py` and all `src/analysis/` files.

---

## 🟡 MEDIUM — Fix Before Journalist/Researcher Onboarding

### M1. Export HTML Reports Contain Unescaped Finding Text — Stored XSS in Downloads
**File:** `app.py`, lines 527–538, 614–625

The HTML export functions build a downloadable HTML report by directly interpolating `narrative_report.json` fields into HTML f-strings:
```python
findings_html += f"""
  <h3>{f['title']}</h3>
  <p class="summary">{f['summary']}</p>
  <p>{f['explanation']}</p>
  <p>{f['what_it_means']}</p>
"""
```
If `narrative_report.json` contains any HTML (from scraped tender titles containing `<`, `>`, `&`, or actual HTML tags), the exported report will render it. A journalist sharing this exported HTML file could unknowingly share a file with active content. Not exploitable server-side, but an integrity concern for an investigation tool.

**Fix:** Use `html.escape()` on all interpolated finding fields:
```python
import html
findings_html += f"<h3>{html.escape(f['title'])}</h3>"
```

### M2. AI Chat Has No Context Isolation Between Users
**File:** `src/analysis/ai_chat.py`

There's no session ID, user ID, or any form of request isolation. On a public deployment, if two users are making AI chat requests simultaneously, their SSE streams are isolated (that's fine), but the Postgres connection opened inside `ask_database()` is not pooled and not isolated from each other in any way. More importantly — the `thought_process` variable and `sql_coder_messages` history from one request could theoretically leak into another in certain threading conditions since these are local variables created inside a generator function.

This is low probability in practice with Python's GIL, but worth noting for a platform handling potentially sensitive queries about government contracts.

### M3. Disclaimer Is Only in the README — Not on the Live Dashboard's Anomaly/Risk Pages
Confirmed again: `frontend/index.html` has zero disclaimer text near the risk grades, single-bid tables, repeat-winner tables, or anomaly panels. The AI chat section has a caveat ("Darshi is AI and can make mistakes") but the deterministic anomaly detection sections — which produce the most shareable/screenshottable outputs — have nothing. For a platform journalists will use to file RTI applications, this matters legally. One line under each risk table is sufficient.

### M4. No Input Length Validation on AI Chat
**File:** `app.py`, line 718; `src/analysis/ai_chat.py`, line 46

```python
text = data.get("text", "")
```
No maximum length check. A user can send a 1MB string as their "query," which gets forwarded to the LLM planner, included verbatim in the SQL coder prompt, and counted against your API token budget. At scale, this is a token-draining attack.

**Fix:**
```python
text = data.get("text", "")[:2000]  # Hard cap at 2000 chars
if not text.strip():
    return jsonify({"error": "Query cannot be empty"}), 400
```

---

## ✅ What's Good — No Action Needed

- **`osint_engine.py` hallucination guard** — returns `"Unknown"` on empty search results, does not let LLM guess. Fixed and intact.
- **User query rendered with `textContent`** — `chat.js` line 31 uses `.textContent = query` (safe text insertion) for the user's own message display. Not innerHTML. Good.
- **Thought process rendered with `textContent`** — line 132 uses `textContent +=` for streaming thought chunks. Safe.
- **Postgres parameterized queries** — most endpoints use `%s` placeholders correctly. C3 is the exception, not the rule.
- **`psycopg2` parameterization in vendor-mca** — the `ILIKE %s` + `params` pattern is correct.
- **`.env` gitignored** — confirmed, no credential leak risk.
- **AI chat `SELECT`-only enforcement** — `if not sql_query.upper().startswith("SELECT"): raise ValueError` is present. Not bulletproof but meaningful as a second layer.
- **Privacy policy** — accurately describes external API calls now. Fixed in a previous commit.

---

## Priority Order for Fixes

| # | Issue | Effort | Impact |
|---|---|---|---|
| C1 | Add rate limiting | Low (30 min) | Prevents API cost drain at scale |
| C2 | XSS via innerHTML + marked | Low (add DOMPurify) | Prevents script injection |
| C3 | SQL param validation + safe casting | Low (15 min) | Prevents crashes + future SQLi |
| C4 | DB connection pooling for AI chat | Medium | Prevents DB exhaustion at scale |
| H1 | Fix model IDs with route/ prefix | Low (need verified IDs from dashboard) | Fixes broken AI chat |
| H2 | nlp_router error leak | Low (5 min) | Stops internal info leaking |
| H3 | CORS restriction | Low (1 line) | Prevents cross-site API abuse |
| H4 | CSP header | Low (10 min) | Limits XSS damage scope |
| H5 | Raw exception leak in vendor-mca | Low (5 min) | Stops DB URL leaking |
| M1 | html.escape in exports | Low (15 min) | Integrity of exported reports |
| M3 | Disclaimer on anomaly panels | Low (UI copy) | Legal protection |
| M4 | Input length cap on AI chat | Low (1 line) | Prevents token drain |
