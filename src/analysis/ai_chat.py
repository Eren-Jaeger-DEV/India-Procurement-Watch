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
- Use SQLite syntax.
- Limit results to 20 max to avoid overwhelming the chat UI.
"""

def get_api_key():
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE, 'r') as f:
            for line in f:
                if line.startswith("ROUTING_RUN_API_KEY="):
                    return line.strip().split("=", 1)[1]
    return None

def ask_database(user_query, model="gemini-3.5-flash"):
    api_key = get_api_key()
    if not api_key:
        return {"error": "API Key not found in .env"}

    # Initialize OpenAI client pointing to the user's aggregator
    client = OpenAI(
        base_url="https://api.routing.run/v1", # The custom aggregator URL
        api_key=api_key,
        default_headers={
            "HTTP-Referer": "http://localhost:5000", 
            "X-Title": "Procurement Dashboard",
            "User-Agent": "Procurement-Dashboard/1.0"
        }
    )

    # Phase 1: Planner
    planner_messages = [
        {"role": "system", "content": f"You are Darshi, an expert Data Analyst and assistant.\n\nRULE 1: If the user's question is conversational (e.g. 'hello', 'who are you') or general knowledge, just answer directly. DO NOT write a <think> block and DO NOT perform keyword expansion.\n\nRULE 2: If the question requires querying the database, you MUST outline a logical plan inside a <think>...</think> block. Inside this block, perform 'Keyword Expansion' (list 5-10 synonyms/alternative spellings for core concepts to simulate semantic search) and instruct the SQL Coder to use extensive `LIKE` chains.\n\nSchema:\n{DB_SCHEMA}"},
        {"role": "user", "content": user_query}
    ]
    try:
        planner_response = client.chat.completions.create(
            model="gpt-5.5", 
            messages=planner_messages,
            temperature=0.3,
            timeout=60.0
        )
        thought_process = planner_response.choices[0].message.content.strip()
    except Exception as e:
        return {"error": f"Planner failed: {str(e)}"}

    is_sql_like = thought_process.strip().upper().startswith("SELECT") or "```sql" in thought_process.lower()
    if "<think>" not in thought_process and not user_query.lower().startswith("select") and not is_sql_like:
        # The AI decided to just answer conversationally
        return {
            "success": True,
            "thought_process": "",
            "summary": thought_process,
            "query": "",
            "columns": [],
            "data": []
        }

    # Phase 2: SQL Coder (with self-correction loop)
    sql_coder_messages = [
        {"role": "system", "content": f"You are an elite SQL developer. Given the schema and the architect's plan, write the exact SQLite query to answer the question. Reply ONLY with the SQL string.\nSchema:\n{DB_SCHEMA}"},
        {"role": "user", "content": f"Question: {user_query}\n\nArchitect Plan:\n{thought_process}"}
    ]
    
    max_retries = 3
    sql_query = ""
    rows = []
    columns = []
    success = False

    for attempt in range(max_retries):
        try:
            sql_response = client.chat.completions.create(
                model="deepseek-v4-pro",
                messages=sql_coder_messages,
                temperature=0.0,
                timeout=60.0
            )
            sql_query = sql_response.choices[0].message.content.strip()
            
            # Clean up markdown
            if sql_query.startswith("```sql"): sql_query = sql_query[6:]
            if sql_query.startswith("```"): sql_query = sql_query[3:]
            if sql_query.endswith("```"): sql_query = sql_query[:-3]
            sql_query = sql_query.strip()
            
            if not sql_query.upper().startswith("SELECT"):
                raise ValueError("Query must start with SELECT")
                
            # Execute
            db_uri = f"file:{SUMMARY_DB}?mode=ro"
            conn = sqlite3.connect(db_uri, uri=True)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(sql_query)
            fetched = cursor.fetchall()
            columns = [description[0] for description in cursor.description] if cursor.description else []
            rows = [dict(row) for row in fetched]
            conn.close()
            success = True
            break # It worked!

        except Exception as e:
            # Feed the error back to the LLM to self-correct
            sql_coder_messages.append({"role": "assistant", "content": sql_query})
            sql_coder_messages.append({"role": "user", "content": f"That query failed with error: {str(e)}\nPlease rewrite the SQL query to fix this error. Reply ONLY with the exact SQL string."})
            
    if not success:
        return {
            "error": "Darshi could not translate this request into a valid database query.",
            "thought_process": thought_process,
            "query": sql_query
        }

    # Phase 3: Interpreter
    interpreter_messages = [
        {"role": "system", "content": "You are Darshi, a helpful AI assistant. Summarize the following data into a friendly, 1-2 sentence conversational answer for the user. Do not explain the SQL, just interpret the data."},
        {"role": "user", "content": f"User's Question: {user_query}\n\nData Returned:\n{json.dumps(rows[:5])}"}
    ]
    try:
        interpreter_response = client.chat.completions.create(
            model=model, # Use the user's selected model for the final touch
            messages=interpreter_messages,
            temperature=0.5,
            timeout=60.0
        )
        summary = interpreter_response.choices[0].message.content.strip()
    except Exception as e:
        summary = "I found the data, but had trouble summarizing it."

    return {
        "success": True,
        "thought_process": thought_process,
        "summary": summary,
        "query": sql_query,
        "columns": columns,
        "data": rows
    }
