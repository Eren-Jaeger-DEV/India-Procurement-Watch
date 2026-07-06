import os
import sqlite3
import json
from openai import OpenAI

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE = os.path.join(BASE_DIR, ".env")

# Accurate PostgreSQL schema (verified against live DB)
DB_SCHEMA = """
PostgreSQL Database — India Procurement Watch

## SUMMARY / ANALYTICS TABLES (fast, pre-aggregated — prefer these)

1. single_bid_contracts(internal_id, org_name, title, contract_value FLOAT, aoc_date TEXT, portal_type TEXT, bidder_name, ref_no)
   — 2000 rows of contracts awarded with only one bidder (high corruption risk)
   — contract_value is in INR (not crore)

2. repeat_winners(rank_n INT, bidder_name, org_name, wins INT, total_value_crore FLOAT, first_win TEXT, last_win TEXT)
   — Top 2000 vendors who repeatedly win from the same organization
   — total_value_crore is in crore INR

3. top_orgs(rank_n INT, org_name, portal_type TEXT, count INT, total_value_crore FLOAT)
   — Top 100 organizations by number of tenders

4. top_published_orgs(rank_n INT, org_name, count INT)
   — Top 100 organizations by published tenders

5. org_report_cards(org_name, total_contracts INT, total_value_crore FLOAT, single_bid_pct FLOAT, round_number_pct FLOAT, score FLOAT, grade TEXT, hhi_score FLOAT, ml_risk_score FLOAT, ml_flag INT)
   — Risk scorecard per organization. grade is A/B/C/D/F. hhi_score measures market concentration (0-10000). ml_flag=1 means AI flagged suspicious.

6. yearly_trends(year INT, portal_type TEXT, count INT, total_value_crore FLOAT)
   — Yearly tender counts and values broken down by portal

7. monthly_trends(year INT, month INT, count INT, total_value_crore FLOAT)
   — Monthly tender volumes

8. state_stats(state_name TEXT, total_contracts INT, total_value_crore FLOAT)
   — Aggregated stats per Indian state (34 states/UTs)

9. portal_breakdown(portal_type TEXT, count INT, total_value_crore FLOAT)
   — Summary by portal (e.g. CPP, GEM)

10. sector_distribution(sector TEXT, count INT, total_value_crore FLOAT)
    — Distribution by sector/ministry

11. value_brackets(bracket TEXT, min_val FLOAT, max_val FLOAT, count INT)
    — Contract value bucket distribution

12. tender_type_dist(tender_type TEXT, count INT, total_value_crore FLOAT)
    — Distribution by tender type

13. kpi_stats(key TEXT, value TEXT)
    — Key-value store of top-level KPIs (total_tenders, total_value_crore, avg_value_crore, etc.)

14. sanctioned_entities(id TEXT, schema_type TEXT, name TEXT, countries TEXT, addresses TEXT, sanctions TEXT, first_seen TEXT)
    — 1415 World Bank debarred / sanctioned entities

## RAW DATA TABLES (4.9M rows — use only with tight WHERE + LIMIT)

15. aoc_tenders(internal_id, portal_type, year BIGINT, aoc_date TEXT, closing_date TEXT, title TEXT, ref_no TEXT, tender_id TEXT, org_name TEXT, detail_url TEXT)
    — 4.9M raw tender records. Always add LIMIT 50 or less.

## SQL Rules
- Output ONLY a raw SQL SELECT statement — no markdown, no explanation.
- READ-ONLY: only SELECT statements allowed.
- Use PostgreSQL syntax.
- ALWAYS add LIMIT 20 (max 50 for raw tables).
- For "most single-bid" queries → use single_bid_contracts or org_report_cards.single_bid_pct
- For "repeat winners" / "same vendor wins" → use repeat_winners
- For "highest risk org" → use org_report_cards ORDER BY ml_risk_score DESC or score DESC
- For "which state" queries → use state_stats
- For value queries → total_value_crore is in crore INR; contract_value in single_bid_contracts is raw INR

## Example queries
Q: Which orgs have most single-bid contracts?
A: SELECT org_name, COUNT(*) AS single_bid_count, SUM(contract_value)/10000000 AS value_crore FROM single_bid_contracts GROUP BY org_name ORDER BY single_bid_count DESC LIMIT 20

Q: Top repeat winning vendors?
A: SELECT bidder_name, org_name, wins, total_value_crore FROM repeat_winners ORDER BY wins DESC LIMIT 20

Q: Highest risk organizations?
A: SELECT org_name, score, grade, ml_risk_score, single_bid_pct FROM org_report_cards WHERE grade IN ('D','F') ORDER BY ml_risk_score DESC LIMIT 20
"""

def get_api_key():
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE, 'r') as f:
            for line in f:
                if line.startswith("ROUTING_RUN_API_KEY="):
                    return line.strip().split("=", 1)[1]
    return None

def create_chat_completion_with_fallback(client, models, **kwargs):
    last_exception = None
    for m in models:
        try:
            kwargs["model"] = m
            return client.chat.completions.create(**kwargs)
        except Exception as e:
            last_exception = e
            print(f"Model {m} failed: {e}. Trying next...")
            continue
    raise last_exception
# ── Confirmed-working routing.run model IDs (verified 2026-07) ──
CLAUDE_MODEL   = "claude-sonnet-4-6"    # smart, reliable, cost-effective
CLAUDE_PREMIUM = "claude-opus-4-8"      # most capable, use only for planning
DEEPSEEK_MODEL = "deepseek-v4-pro"      # best for SQL generation
FAST_MODEL     = "deepseek-v4-flash"    # fastest, cheapest
DEFAULT_MODEL  = "deepseek-v4-pro"      # safe default if frontend sends bad model

# Valid model IDs accepted by routing.run
VALID_ROUTING_MODELS = {
    "claude-opus-4-8", "claude-sonnet-4-6", "deepseek-v4-flash",
    "deepseek-v4-pro", "gemini-3.5-flash", "grok-4.3",
    "kimi-k2.6", "minimax-m3", "nemotron-3-ultra"
}

def ask_database(user_query, model=DEFAULT_MODEL):
    # Normalise model — reject unknown IDs to avoid hard failures
    if model not in VALID_ROUTING_MODELS:
        model = DEFAULT_MODEL

    api_key = get_api_key()
    if not api_key:
        yield f"data: {json.dumps({'type': 'error', 'content': 'API Key not found in .env'})}\n\n"
        return

    client = OpenAI(
        base_url="https://api.routing.run/v1",
        api_key=api_key,
        max_retries=0,
        default_headers={
            "HTTP-Referer": "http://localhost:5000", 
            "X-Title": "Procurement Dashboard",
            "User-Agent": "Procurement-Dashboard/1.0"
        }
    )

    # Fallback chains — only use confirmed-working models
    router_models     = [FAST_MODEL, DEEPSEEK_MODEL]
    convo_models      = [model, DEEPSEEK_MODEL, FAST_MODEL]
    planner_models    = [DEEPSEEK_MODEL, CLAUDE_MODEL, model]
    sql_models        = [DEEPSEEK_MODEL, CLAUDE_MODEL, FAST_MODEL]
    interpreter_models = [FAST_MODEL, DEEPSEEK_MODEL, model]

    # Phase 0: Intent Router (Fast, No Schema)
    router_messages = [
        {"role": "user", "content": f"System Instructions: You are a routing AI. If the user's query is conversational (e.g., 'hello', 'who are you', 'what is this') or asks for general knowledge, reply ONLY with 'CONVO'. If the query asks for data, statistics, reports, or search results that would require querying a database of public tenders, reply ONLY with 'DATA'.\n\nUser Query: {user_query}"}
    ]
    try:
        router_res = create_chat_completion_with_fallback(
            client=client,
            models=router_models,
            messages=router_messages,
            temperature=0.0,
            timeout=30.0
        )
        intent = router_res.choices[0].message.content.strip().upper()
    except Exception:
        intent = "DATA"
        
    if "CONVO" in intent:
        yield f"data: {json.dumps({'type': 'summary_start'})}\n\n"
        try:
            convo_res = create_chat_completion_with_fallback(
                client=client,
                models=convo_models,
                messages=[
                    {"role": "user", "content": f"System Instructions: You are Darshi, an expert Data Analyst assistant for India Procurement Watch. Answer the user conversationally and concisely.\n\nUser Query: {user_query}"}
                ],
                temperature=0.5,
                stream=True
            )
            for chunk in convo_res:
                if chunk.choices:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield f"data: {json.dumps({'type': 'summary_chunk', 'content': content})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        yield f"data: {json.dumps({'type': 'end'})}\n\n"
        return

    # Phase 1: Planner
    planner_messages = [
        {"role": "user", "content": f"System Instructions: You are Darshi, an expert Data Analyst and assistant.\n\nYou must outline a logical plan to answer the user's query inside a <think>...</think> block. Inside this block, perform 'Keyword Expansion' (list 5-10 synonyms/alternative spellings for core concepts to simulate semantic search) and instruct the SQL Coder to use extensive `LIKE` chains.\n\nSchema:\n{DB_SCHEMA}\n\nUser Query: {user_query}"}
    ]
    
    yield f"data: {json.dumps({'type': 'thought_start'})}\n\n"
    thought_process = ""
    try:
        planner_response = create_chat_completion_with_fallback(
            client=client,
            models=planner_models, 
            messages=planner_messages,
            temperature=0.3,
            stream=True
        )
        for chunk in planner_response:
            if chunk.choices:
                content = chunk.choices[0].delta.content
                if content:
                    thought_process += content
                    yield f"data: {json.dumps({'type': 'thought_chunk', 'content': content})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'content': f'Planner failed: {str(e)}'})}\n\n"
        return

    yield f"data: {json.dumps({'type': 'status', 'content': 'Writing SQL query...'})}\n\n"

    # Phase 2: SQL Coder
    sql_coder_messages = [
        {"role": "user", "content": f"System Instructions: You are an elite SQL developer. Given the schema and the architect's plan, write the exact PostgreSQL query to answer the question. Reply ONLY with the SQL string.\nSchema:\n{DB_SCHEMA}\n\nQuestion: {user_query}\n\nArchitect Plan:\n{thought_process}"}
    ]
    
    max_retries = 3
    sql_query = ""
    rows = []
    columns = []
    success = False

    for attempt in range(max_retries):
        try:
            sql_response = create_chat_completion_with_fallback(
                client=client,
                models=sql_models,
                messages=sql_coder_messages,
                temperature=0.0,
                timeout=60.0
            )
            sql_query = sql_response.choices[0].message.content.strip()
            
            import re
            match = re.search(r"```(?:sql)?\n?(.*?)\n?```", sql_query, re.IGNORECASE | re.DOTALL)
            if match:
                sql_query = match.group(1)
            
            sql_query = sql_query.strip()
            
            if not sql_query.upper().startswith("SELECT"):
                raise ValueError("Query must start with SELECT")
                
            from dotenv import load_dotenv
            load_dotenv(ENV_FILE)
            import psycopg2
            from psycopg2.extras import RealDictCursor
            db_url = os.environ.get("DATABASE_URL")
            conn = psycopg2.connect(db_url)
            conn.set_session(options={'statement_timeout': '30s'})
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(sql_query)
            rows = [dict(r) for r in cursor.fetchall()]
            columns = [description[0] for description in cursor.description] if cursor.description else []
            conn.close()
            success = True
            break
        except Exception as e:
            sql_coder_messages.append({"role": "assistant", "content": sql_query})
            sql_coder_messages.append({"role": "user", "content": f"That query failed with error: {str(e)}\nPlease rewrite the SQL query to fix this error. Reply ONLY with the exact SQL string."})
            
    if not success:
        yield f"data: {json.dumps({'type': 'error', 'content': 'Darshi could not translate this request into a valid database query.', 'query': sql_query})}\n\n"
        return

    # Yield the actual data first so UI can build table
    yield f"data: {json.dumps({'type': 'data', 'query': sql_query, 'columns': columns, 'data': rows})}\n\n"

    # Phase 2.5: Visualizer
    visualizer_messages = [
        {"role": "user", "content": f"System Instructions: You are a data visualization AI. Given a JSON array of data from a SQL query, decide the best way to visualize it.\n\nRules:\n1. If it's a single aggregate number (e.g. sum, count), output a JSON object: {{\"type\": \"kpi\", \"value\": \"formatted string (e.g. 1.2K)\", \"label\": \"Short description\"}} (Make the label max 3 words).\n2. If it is categorical or trend data, output a JSON object: {{\"type\": \"chart\", \"chart_type\": \"bar\" or \"pie\" or \"line\", \"labels\": [\"x1\", \"x2\"], \"dataset_label\": \"Metric Name\", \"data\": [10, 20]}}\n3. If it has many string columns or doesn't make sense as a chart, output: {{\"type\": \"none\"}}\n\nOutput ONLY raw valid JSON, no markdown blocks.\n\nData: {json.dumps(rows[:10])}"}
    ]
    try:
        if len(rows) > 0:
            viz_res = create_chat_completion_with_fallback(
                client=client,
                models=[GEMINI_MODEL, FAST_MODEL, GPT_MODEL],
                messages=visualizer_messages,
                temperature=0.1,
                timeout=15.0
            )
            viz_text = viz_res.choices[0].message.content.strip()
            if viz_text.startswith("```json"): viz_text = viz_text[7:]
            if viz_text.startswith("```"): viz_text = viz_text[3:]
            if viz_text.endswith("```"): viz_text = viz_text[:-3]
            viz_json = json.loads(viz_text.strip())
            
            if viz_json.get("type") == "kpi":
                yield f"data: {json.dumps({'type': 'kpi_box', 'kpi': viz_json})}\n\n"
            elif viz_json.get("type") == "chart":
                yield f"data: {json.dumps({'type': 'chart_data', 'chart': viz_json})}\n\n"
    except Exception as e:
        print(f"Visualizer error: {e}")
        pass # Ignore visualizer errors, fallback to table

    # Phase 3: Interpreter
    yield f"data: {json.dumps({'type': 'summary_start'})}\n\n"
    interpreter_messages = [
        {"role": "user", "content": f"System Instructions: You are Darshi, a helpful AI assistant. Summarize the following data into a friendly, 1-2 sentence conversational answer for the user. Do not explain the SQL, just interpret the data. If the user asked to delete, update, insert, or drop data, and the data returned is empty, you MUST explicitly state that you are operating in a strict Read-Only sandbox and cannot modify or delete any database records. DO NOT hallucinate that a deletion was successful.\n\nUser's Question: {user_query}\n\nData Returned:\n{json.dumps(rows[:5])}"}
    ]
    try:
        interpreter_response = create_chat_completion_with_fallback(
            client=client,
            models=interpreter_models,
            messages=interpreter_messages,
            temperature=0.5,
            stream=True
        )
        for chunk in interpreter_response:
            if chunk.choices:
                content = chunk.choices[0].delta.content
                if content:
                    yield f"data: {json.dumps({'type': 'summary_chunk', 'content': content})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'type': 'summary_chunk', 'content': 'I found the data, but had trouble summarizing it.'})}\n\n"

    yield f"data: {json.dumps({'type': 'end'})}\n\n"
