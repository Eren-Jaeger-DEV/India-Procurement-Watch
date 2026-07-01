import os
import sqlite3
import json
from openai import OpenAI

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SUMMARY_DB = os.path.join(BASE_DIR, "summary.db")
ENV_FILE = os.path.join(BASE_DIR, ".env")

# Basic schema definition to feed the LLM
DB_SCHEMA = """
Tables in summary.db:
1. single_bid_contracts(org_name, title, contract_value, aoc_date, portal_type, bidder_name)
2. repeat_winners(bidder_name, org_name, wins, total_value_crore, first_win, last_win)
3. top_orgs(org_name, count, total_value_crore)
4. org_report_cards(org_name, total_contracts, total_value_crore, single_bid_pct, hhi_score)
5. yearly_trends(year, count, total_value_crore)

Rules:
- You must output ONLY a valid SQL SELECT query. Do not include markdown formatting like ```sql or explanations. Just the raw SQL string.
- The query must be READ-ONLY (only SELECT statements).
- Use PostgreSQL syntax (including ->> for JSONB queries if needed).
- Limit results to 20 max to avoid overwhelming the chat UI.
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

def ask_database(user_query, model="gemini-3.5-flash"):
    api_key = get_api_key()
    if not api_key:
        yield f"data: {json.dumps({'type': 'error', 'content': 'API Key not found in .env'})}\n\n"
        return

    client = OpenAI(
        base_url="https://api.routing.run/v1",
        api_key=api_key,
        default_headers={
            "HTTP-Referer": "http://localhost:5000", 
            "X-Title": "Procurement Dashboard",
            "User-Agent": "Procurement-Dashboard/1.0"
        }
    )

    router_models = ["gemini-3.5-flash", "gpt-3.5-turbo"]
    convo_models = [model, "gpt-4o", "gemini-3.5-flash"]
    planner_models = [model, "gpt-4o", "deepseek-v4-pro"]
    sql_models = ["deepseek-v4-pro", "gpt-4o", "claude-3-opus"]
    interpreter_models = [model, "gpt-4o", "gemini-3.5-flash"]

    # Phase 0: Intent Router (Fast, No Schema)
    router_messages = [
        {"role": "system", "content": "You are a routing AI. If the user's query is conversational (e.g., 'hello', 'who are you', 'what is this') or asks for general knowledge, reply ONLY with 'CONVO'. If the query asks for data, statistics, reports, or search results that would require querying a database of public tenders, reply ONLY with 'DATA'."},
        {"role": "user", "content": user_query}
    ]
    try:
        router_res = create_chat_completion_with_fallback(
            client=client,
            models=router_models,
            messages=router_messages,
            temperature=0.0,
            timeout=10.0
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
                    {"role": "system", "content": "You are Darshi, an expert Data Analyst assistant for India Procurement Watch. Answer the user conversationally and concisely."},
                    {"role": "user", "content": user_query}
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
        {"role": "system", "content": f"You are Darshi, an expert Data Analyst and assistant.\n\nYou must outline a logical plan to answer the user's query inside a <think>...</think> block. Inside this block, perform 'Keyword Expansion' (list 5-10 synonyms/alternative spellings for core concepts to simulate semantic search) and instruct the SQL Coder to use extensive `LIKE` chains.\n\nSchema:\n{DB_SCHEMA}"},
        {"role": "user", "content": user_query}
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
        {"role": "system", "content": f"You are an elite SQL developer. Given the schema and the architect's plan, write the exact PostgreSQL query to answer the question. Reply ONLY with the SQL string.\nSchema:\n{DB_SCHEMA}"},
        {"role": "user", "content": f"Question: {user_query}\n\nArchitect Plan:\n{thought_process}"}
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
            
            if sql_query.startswith("```sql"): sql_query = sql_query[6:]
            if sql_query.startswith("```"): sql_query = sql_query[3:]
            if sql_query.endswith("```"): sql_query = sql_query[:-3]
            sql_query = sql_query.strip()
            
            if not sql_query.upper().startswith("SELECT"):
                raise ValueError("Query must start with SELECT")
                
            from dotenv import load_dotenv
            load_dotenv(ENV_FILE)
            db_url = os.environ.get("DATABASE_URL")
            import psycopg2
            from psycopg2.extras import RealDictCursor
            conn = psycopg2.connect(db_url)
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(sql_query)
            fetched = cursor.fetchall()
            columns = [description[0] for description in cursor.description] if cursor.description else []
            rows = [dict(row) for row in fetched]
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
        {"role": "system", "content": "You are a data visualization AI. Given a JSON array of data from a SQL query, decide the best way to visualize it.\n\nRules:\n1. If it's a single aggregate number (e.g. sum, count), output a JSON object: {\"type\": \"kpi\", \"value\": \"formatted string (e.g. 1.2K)\", \"label\": \"Short description\"} (Make the label max 3 words).\n2. If it is categorical or trend data, output a JSON object: {\"type\": \"chart\", \"chart_type\": \"bar\" or \"pie\" or \"line\", \"labels\": [\"x1\", \"x2\"], \"dataset_label\": \"Metric Name\", \"data\": [10, 20]}\n3. If it has many string columns or doesn't make sense as a chart, output: {\"type\": \"none\"}\n\nOutput ONLY raw valid JSON, no markdown blocks."},
        {"role": "user", "content": f"Data:\n{json.dumps(rows)}"}
    ]
    try:
        if len(rows) > 0:
            viz_res = create_chat_completion_with_fallback(
                client=client,
                models=["gemini-3.5-flash", "gpt-3.5-turbo", "gpt-4o"],
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
        {"role": "system", "content": "You are Darshi, a helpful AI assistant. Summarize the following data into a friendly, 1-2 sentence conversational answer for the user. Do not explain the SQL, just interpret the data. If the user asked to delete, update, insert, or drop data, and the data returned is empty, you MUST explicitly state that you are operating in a strict Read-Only sandbox and cannot modify or delete any database records. DO NOT hallucinate that a deletion was successful."},
        {"role": "user", "content": f"User's Question: {user_query}\n\nData Returned:\n{json.dumps(rows[:5])}"}
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
