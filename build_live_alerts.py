import os
import sqlite3
import time
import json
import numpy as np

# ML and NLP imports
from sklearn.ensemble import IsolationForest
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import StandardScaler
from scipy.sparse import hstack

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VPS_DB = os.path.join(BASE_DIR, "data_dump", "tenders_vps.db")
SUM_DB = os.path.join(BASE_DIR, "summary.db")

def log(msg):
    print(f"[build_live_alerts] {msg}")

def parse_contract_value(val_str):
    if not val_str: return 0.0
    v = str(val_str).replace(",", "").strip()
    if v.startswith("₹") or v.startswith("INR"):
        v = v.replace("₹", "").replace("INR", "").strip()
    try:
        return float(v)
    except Exception:
        return 0.0

def days_between(d1, d2):
    try:
        from datetime import datetime
        fmt = "%d-%b-%Y %I:%M %p"
        dt1 = datetime.strptime(str(d1).strip(), fmt)
        dt2 = datetime.strptime(str(d2).strip(), fmt)
        return (dt2 - dt1).days
    except Exception:
        return 0

def main():
    if not os.path.exists(VPS_DB) or not os.path.exists(SUM_DB):
        log("Missing tenders_vps.db or summary.db. Skipping live alerts.")
        return

    log("Phase 1: Fetching sample of live tenders...")
    vps_conn = sqlite3.connect(VPS_DB)
    vps_conn.row_factory = sqlite3.Row
    vps_cur = vps_conn.cursor()

    # Get a sample of recent tenders (limit to 10k for speed in this V5 demo)
    vps_cur.execute("SELECT tender_id, details_json FROM tender_details LIMIT 10000")
    
    tenders = []
    texts = []
    numeric_features = []
    
    for row in vps_cur:
        tid, djson = row['tender_id'], row['details_json']
        if not djson: continue
        try:
            d = json.loads(djson)
            title = str(d.get('Tender Title', ''))
            desc = str(d.get('Work Description', ''))
            org = str(d.get('Organisation Name', ''))
            
            val = parse_contract_value(d.get('Tender Value'))
            fee = parse_contract_value(d.get('Tender Fee'))
            emd = parse_contract_value(d.get('EMD'))
            
            pub_date = d.get('ePublished Date')
            end_date = d.get('Bid Submission End Date')
            days_open = days_between(pub_date, end_date)
            
            # Text for NLP analysis (Title + Description)
            text_payload = f"{title} {desc}".strip()
            if len(text_payload) < 10: continue
            
            # Numeric features for ML (Value, Fee, EMD %, Days Open, Text Length)
            emd_pct = (emd / val) if val > 0 else 0
            text_len = len(desc)
            
            numeric_features.append([val, fee, emd_pct, days_open, text_len])
            texts.append(text_payload)
            tenders.append({
                'tender_id': tid,
                'org_name': org,
                'title': title,
                'value': val,
                'desc': desc
            })
            
        except Exception:
            pass

    log(f"  Loaded {len(tenders)} valid tenders for predictive analysis.")
    if len(tenders) < 50:
        log("Not enough data to train ML model.")
        return

    log("Phase 2: NLP Analysis (TF-IDF on Tailored Specs)...")
    vectorizer = TfidfVectorizer(max_features=1000, stop_words='english', max_df=0.9, min_df=2)
    X_text = vectorizer.fit_transform(texts)

    log("Phase 3: Machine Learning (Isolation Forest for Pre-Crime Risk)...")
    scaler = StandardScaler()
    X_num = scaler.fit_transform(numeric_features)
    
    # Combine NLP and Numeric features
    X_combined = hstack([X_text, X_num])
    
    # Train Isolation Forest
    iso = IsolationForest(n_estimators=100, contamination=0.01, random_state=42)
    iso.fit(X_combined)
    
    scores = iso.decision_function(X_combined)
    preds = iso.predict(X_combined) # -1 is anomaly, 1 is normal
    
    log("Phase 4: Saving Live Alerts to summary.db...")
    sum_conn = sqlite3.connect(SUM_DB)
    sum_cur = sum_conn.cursor()
    
    sum_cur.execute("DROP TABLE IF EXISTS live_alerts")
    sum_cur.execute("""
        CREATE TABLE live_alerts (
            tender_id TEXT,
            org_name TEXT,
            title TEXT,
            contract_value REAL,
            ml_risk_score REAL,
            nlp_flag TEXT
        )
    """)
    
    insert_rows = []
    # Normalize scores to 0-100 risk
    min_score = np.min(scores)
    max_score = np.max(scores)
    
    for i in range(len(tenders)):
        if preds[i] == -1: # Only save the anomalies
            # Inverse the score so higher = more risk
            risk_pct = 100 * (max_score - scores[i]) / (max_score - min_score)
            if risk_pct > 99: risk_pct = 99.9
            
            # Determine if it's an NLP tailored spec or just numeric anomaly
            # If the text was unusually long, we flag it as "Tailored Specs"
            nlp_flag = "Tailored Specs (NLP)" if numeric_features[i][4] > 1000 else "Financial Anomaly (ML)"
            
            t = tenders[i]
            insert_rows.append((
                t['tender_id'], t['org_name'], t['title'][:200], t['value'],
                round(risk_pct, 1), nlp_flag
            ))
            
    # Sort by risk
    insert_rows.sort(key=lambda x: x[4], reverse=True)
            
    sum_cur.executemany("INSERT INTO live_alerts VALUES (?,?,?,?,?,?)", insert_rows)
    sum_conn.commit()
    
    log(f"✓ Detected {len(insert_rows)} high-risk live tenders (Pre-Crime Alerts).")

if __name__ == "__main__":
    t0 = time.time()
    main()
    print(f"[build_live_alerts] Finished in {time.time() - t0:.1f}s")
