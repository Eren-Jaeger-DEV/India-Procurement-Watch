import os
from flask import Blueprint, jsonify

DATA_DUMP = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'databases', 'data_dump'))

system_bp = Blueprint('system', __name__)

@system_bp.route("/api/status")
def api_status():
    return jsonify({
        "summary_db_ready": True,
        "search_db_ready": True,
        "aoc_in_dump": False,
        "message": "Connected to PostgreSQL"
    })

@system_bp.route("/api/analysis-progress")
def api_analysis_progress():
    return jsonify({"status": "completed", "progress": 100})

@system_bp.route("/api/dump-files")
def api_dump_files():
    """List .db files currently in data_dump/."""
    if not os.path.exists(DATA_DUMP):
        return jsonify({"files": []})
    files = []
    for f in os.listdir(DATA_DUMP):
        if f.lower().endswith(".db"):
            full = os.path.join(DATA_DUMP, f)
            size_mb = round(os.path.getsize(full) / 1024 / 1024, 1)
            files.append({"name": f, "size_mb": size_mb})
    return jsonify({"files": files, "data_dump_path": DATA_DUMP})
