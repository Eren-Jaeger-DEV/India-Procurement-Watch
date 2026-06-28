import sqlite3
import pandas as pd

# Append to nodes.csv
df = pd.DataFrame([{
    'id': 'comp4',
    'label': 'Gitanjali Udyog Limited',
    'kind': 'COMPANY',
    'group': 'vendor',
    'value': 80000000,
    'n_contracts': 40,
    'n_buyers': 5
}])
df.to_csv('data_dump/nodes.csv', mode='a', header=False, index=False)

# Insert into summary.db network_nodes
conn = sqlite3.connect('summary.db')
conn.execute("INSERT INTO network_nodes (id, label, kind, state, email, value, n_contracts, n_buyers) VALUES ('comp4', 'Gitanjali Udyog Limited', 'COMPANY', 'MH', '', 80000000, 40, 5)")
conn.commit()
conn.close()

print("Injected dummy data for Gitanjali.")
