# Darshi V6 AI Architecture & Pipeline Specification
**Author:** AI Engineering Team  
**Target Audience:** Amogh & Core Development Team

This document outlines the technical architecture of the V6 Darshi Intelligence Desk, focusing on the new Python Generator streaming, the Auto-Rotational Fallback wrapper, the Visualizer sub-agent, and the Frontend DOM injection logic.

---

## 1. The 4-Phase ReAct Pipeline (Server-Side)

The `ai_chat.py` orchestrator handles all AI inference using a 4-phase ReAct (Reason + Act) architecture. To support True Real-Time SSE Streaming, the entire orchestrator is now a Python Generator function (`yield` statements) rather than a monolithic `return` function.

### Phase 1: Planner (Reasoning)
- **Goal:** Analyze the user's intent and formulate a plan of action.
- **Mechanism:** Streams tokens using `stream=True` via OpenAI compatible endpoints.
- **Yields:** `thought_start`, `thought_chunk`, `status`.

### Phase 2: SQL Coder (Action)
- **Goal:** Generate a strictly Read-Only SQLite query based on the schema of `summary.db`.
- **Mechanism:** Executes internally. No tokens are streamed to the user to prevent prompt injection or SQL leak confusion.
- **Execution & Validation:** Runs the query against `summary.db`. If an `OperationalError` occurs, the Coder enters a self-correction loop (max 3 retries).
- **Yields:** `data` (containing the SQL string and the fetched JSON rows).

### Phase 3: Visualizer Engine (Evaluation)
- **Goal:** Determine if the data shape warrants a graphical chart or a KPI card.
- **Mechanism:** A high-speed, low-parameter model is fed the first 10 rows of the dataset. It outputs a strict JSON configuration.
- **Yields:** `kpi_box` (if aggregate metric) or `chart_data` (if distribution/trend).

### Phase 4: Interpreter (Synthesis)
- **Goal:** Convert the raw rows into a conversational, narrative response.
- **Mechanism:** Streams tokens using `stream=True`.
- **Yields:** `summary_start`, `summary_chunk`, `end`.

---

## 2. Auto-Rotational Fallback Wrapper (`create_chat_completion_with_fallback`)

To achieve enterprise-grade resilience against aggregator rate limits (e.g., `api.routing.run`), model downtime, or context window overflow, all API calls are routed through `create_chat_completion_with_fallback`.

**Logic Flow:**
1. Accepts a `models` list in order of priority (e.g., `["user_selected_model", "gpt-4o", "deepseek-v4-pro"]`).
2. Attempts `client.chat.completions.create` on index 0.
3. If an `Exception` is caught (HTTP error, connection reset, timeout), it logs the failure and immediately retries the exact same prompt with index 1.
4. Prevents the frontend stream from silently dying and dropping the connection.

---

## 3. Server-Sent Events (SSE) Streaming Over Flask

In `app.py`, the `/api/ai-chat` endpoint returns a native Flask `Response` object piped directly to the `process_chat()` generator:

```python
return Response(stream_with_context(process_chat(messages, selected_model)), mimetype='text/event-stream')
```

Chunks are yielded in a strict JSON format prefixed with `data: `, ensuring standard EventSource compatibility.

---

## 4. Frontend DOM Architecture (`chat.js`)

The frontend completely abandons the standard `res.json()` fetch architecture in favor of a `ReadableStream` decoder.

### Stream Parsing
We use `TextDecoderStream` to parse chunks as they arrive. `\n\n` delimiters are used to split incoming SSE envelopes.

### Event Handling & DOM Injection Order
- `thought_start`: Creates a `<details open>` accordion box (`max-height: 200px; overflow-y: auto; overflow-x: hidden; word-break: break-word;`).
- `thought_chunk`: Appends to `.thought-text` and auto-scrolls the internal box.
- `status`: Strips the `open` attribute from the `<details>` accordion, cleanly collapsing the reasoning process, and prints a status string.
- `data`: 
  - **Truncation:** Renders a maximum of 5 rows in the inline HTML table to save vertical space.
  - **Export Action Bar:** Injects dynamic `Export Full Markdown` and `Export Full PDF` buttons beneath the table preview.
- `summary_start`: Creates a `summaryContainer` div and explicitly injects it via `aiMsg.appendChild()` so it appears chronologically *after* the data table.
- `summary_chunk`: Accumulates markdown text in a `data` attribute and parses it via `marked.js` on every chunk to render live HTML styling (bolding, lists, headers).

### In-Browser Data Exports
- **Markdown:** Converts the raw JSON rows into standard MD table syntax, creates a Blob, and clicks a hidden `<a>` tag.
- **PDF:** Uses `html2pdf.js` to render a hidden DOM element containing the full un-truncated HTML table into a downloadable `.pdf` file. Zero server communication is required for exports.
