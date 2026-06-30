import os
import json
import requests
from dotenv import load_dotenv
from duckduckgo_search import DDGS

load_dotenv()

def verify_company(company_name):
    """
    Searches the web for news about the company and uses an LLM to assess risk.
    """
    if not company_name:
        return {"risk_score": "Unknown", "summary": "No company name provided.", "sources": []}
        
    try:
        # 1. Search the web for news and general info
        # We append keywords to surface potential red flags
        query = f'"{company_name}" (scam OR fraud OR blacklist OR corruption OR tender)'
        results = []
        try:
            results = DDGS().text(query, max_results=5, backend="lite")
        except Exception as e:
            print(f"DDGS Error: {e}")
            
        if not results:
            return {
                "risk_score": "Unknown",
                "summary": "No verified sources available online to perform an OSINT analysis.",
                "sources": []
            }
        else:
            # 2. Format the search results to feed to the LLM
            context = ""
            sources = []
            for i, res in enumerate(results):
                context += f"Result {i+1}:\nTitle: {res.get('title')}\nSnippet: {res.get('body')}\n\n"
                sources.append({"title": res.get("title"), "href": res.get("href")})
            
        # 3. Call the LLM to analyze the context
        api_key = os.environ.get("ROUTING_RUN_API_KEY")
        if not api_key:
            return {
                "risk_score": "Unknown", 
                "summary": "API key missing. Could not perform LLM analysis.",
                "sources": sources
            }
            
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        prompt = f"""You are an investigative journalist API. 
Analyze the following web search results for the company '{company_name}'.
Determine if there is any history of scams, fraud, blacklisting, or corruption.

Search Results Context:
{context}

Return ONLY a valid JSON object matching this schema exactly:
{{
  "risk_score": "High", // "High", "Medium", or "Low"
  "summary": "A 2-3 sentence journalistic summary of the findings."
}}"""

        payload = {
            "model": "gemini-3.5-flash",
            "messages": [
                {"role": "system", "content": "You are a strict JSON extraction engine."},
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"}
        }
        
        resp = requests.post("https://api.routing.run/v1/chat/completions", headers=headers, json=payload, timeout=45)
        resp.raise_for_status()
        
        result_json = resp.json()
        content = result_json['choices'][0]['message']['content'].strip()
        
        if content.startswith('```json'):
            content = content.split('```json')[1].rsplit('```', 1)[0].strip()
            
        data = json.loads(content)
        
        return {
            "risk_score": data.get("risk_score", "Unknown"),
            "summary": data.get("summary", "Analysis failed to produce a valid summary."),
            "sources": sources
        }
        
    except Exception as e:
        print(f"OSINT Engine Error: {e}")
        return {
            "risk_score": "Error",
            "summary": f"Failed to perform OSINT verification. Error: {str(e)}",
            "sources": []
        }
