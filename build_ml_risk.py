import os
import sys
import sqlite3

def log(msg):
    print(msg)
    sys.stdout.flush()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SUM_DB = os.path.join(BASE_DIR, "summary.db")

def main():
    log("============================================================")
    log("  India Procurement Analytics — build_ml_risk.py")
    log("============================================================")
    
    try:
        import pandas as pd
        import numpy as np
        from sklearn.ensemble import IsolationForest
        from sklearn.preprocessing import StandardScaler
    except ImportError:
        log("  [!] Machine Learning dependencies not found.")
        log("      Please run: pip install scikit-learn pandas numpy")
        log("      Skipping ML Risk Scoring...")
        return
    
    if not os.path.exists(SUM_DB):
        log("  [!] summary.db not found. Run build_summary.py first.")
        return

    log("Phase 1: Loading contractor data from summary.db...")
    conn = sqlite3.connect(SUM_DB)
    
    df = pd.read_sql_query("""
        SELECT org_name, total_contracts, total_value_crore, single_bid_pct, round_number_pct
        FROM org_report_cards
    """, conn)
    
    if df.empty or len(df) < 10:
        log("  [-] Not enough data for Machine Learning model (need at least 10 contractors). Skipping ML.")
        conn.close()
        return

    log(f"  Loaded {len(df)} contractors for ML evaluation.")
    
    # Fill any nulls
    df.fillna(0, inplace=True)
    
    # Feature Engineering
    features = ['total_contracts', 'total_value_crore', 'single_bid_pct', 'round_number_pct']
    X = df[features]
    
    log("Phase 2: Scaling features and training Isolation Forest...")
    # Scale features so large monetary values don't dominate percentages
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Train Isolation Forest (contamination = 0.05 means we assume 5% are anomalous)
    clf = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    clf.fit(X_scaled)
    
    # Get anomaly predictions (-1 is anomaly, 1 is normal)
    preds = clf.predict(X_scaled)
    
    # Get raw anomaly scores (lower is more anomalous in scikit-learn)
    scores = clf.decision_function(X_scaled)
    
    log("Phase 3: Generating Risk Scores...")
    # Convert scikit-learn scores to a 0-100 ML Risk Score (100 = most anomalous)
    # The lowest decision_function value becomes 100, the highest becomes 0.
    min_score = scores.min()
    max_score = scores.max()
    
    # Avoid division by zero
    if max_score == min_score:
        normalized_scores = np.zeros(len(scores))
    else:
        # Invert scale so lower decision_function (anomalies) gets higher risk score
        normalized_scores = 100 * (max_score - scores) / (max_score - min_score)
    
    df['ml_risk_score'] = np.round(normalized_scores, 1)
    df['ml_flag'] = np.where(preds == -1, 1, 0)
    
    num_anomalies = df['ml_flag'].sum()
    log(f"  [+] Isolation Forest detected {num_anomalies} high-risk contractors.")
    
    log("Phase 4: Writing ML scores back to summary.db...")
    cur = conn.cursor()
    
    # Update the org_report_cards table
    update_data = list(zip(df['ml_risk_score'], df['ml_flag'], df['org_name']))
    
    cur.executemany("""
        UPDATE org_report_cards 
        SET ml_risk_score = ?, ml_flag = ? 
        WHERE org_name = ?
    """, update_data)
    
    conn.commit()
    conn.close()
    
    log("============================================================")
    log("  build_ml_risk.py COMPLETE")
    log("============================================================")

if __name__ == "__main__":
    main()
