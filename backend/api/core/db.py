import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import g, abort

def get_pg_conn():
    """Returns a request-scoped PostgreSQL connection to the local ipw database."""
    conn = getattr(g, 'pg_conn', None)
    if conn is None:
        db_url = os.environ.get("DATABASE_URL")
        if not db_url:
            abort(503, description="DATABASE_URL not set in .env")
        try:
            conn = psycopg2.connect(db_url)
            setattr(g, 'pg_conn', conn)
        except Exception as e:
            abort(503, description=f"Failed to connect to PostgreSQL: {e}")
    return conn

def close_db(error):
    conn = getattr(g, 'pg_conn', None)
    if conn is not None:
        try:
            conn.close()
        except Exception:
            pass

def rows_to_list(cursor_result):
    return [dict(row) for row in cursor_result]
