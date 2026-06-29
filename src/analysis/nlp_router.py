import os
import json
import requests
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

def parse_natural_query(text):
    """
    Parses a natural language query into constrained SQL-safe parameters using an LLM.
    Returns: {"year": "2022", "portal": "", "q": "educational bodies on-screen marking"}
    """
    if not text or not isinstance(text, str):
        return {"year": "", "portal": "", "q": ""}
        
    api_key = os.environ.get("ROUTING_RUN_API_KEY")
    if not api_key:
        print("WARNING: ROUTING_RUN_API_KEY not found. Falling back to basic search.")
        return {"year": "", "portal": "", "q": text}
        
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    prompt = """You are a strict JSON extraction engine for a government procurement dashboard.
Extract search filters from the user's natural language query.
Return ONLY a valid JSON object matching this schema exactly (no markdown, no backticks):
{
  "year": "string (extract any 4 digit year if mentioned, else empty string)",
  "portal": "string (if the text mentions railways, defense/defence, health/medical, education/school, roads/highway, or pwd, map it to one of: 'railways', 'defence', 'health', 'education', 'roads', 'pwd'. Otherwise empty string)",
  "q": "string (the remaining semantic search keywords, with fluff words removed)"
}"""

    payload = {
        "model": "gemini-3.5-flash",
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": text}
        ],
        "response_format": {"type": "json_object"}
    }
    
    try:
        resp = requests.post("https://api.routing.run/v1/chat/completions", headers=headers, json=payload, timeout=10)
        if not resp.ok:
            print(f"Error {resp.status_code}: {resp.text}")
        resp.raise_for_status()
        result = resp.json()
        content = result['choices'][0]['message']['content']
        
        # Ensure it's clean JSON
        content = content.strip()
        if content.startswith('```json'):
            content = content.split('```json')[1].rsplit('```', 1)[0].strip()
            
        data = json.loads(content)
        
        return {
            "year": str(data.get("year", "")).strip(),
            "portal": str(data.get("portal", "")).strip(),
            "q": str(data.get("q", "")).strip()
        }
    except Exception as e:
        print(f"LLM parsing failed: {e}")
        # Secure Fallback
        return {"year": "", "portal": "", "q": f"{text} (LLM Error: {str(e)})"}
