import sqlite3
conn = sqlite3.connect('f:/projects/ssad/aoc_tenders.db')
res = conn.execute("SELECT org_name, count(*) FROM aoc_tenders WHERE portal_type='state' GROUP BY org_name ORDER BY count(*) DESC LIMIT 20").fetchall()
for row in res:
    print(row)
