import os
import json
from flask import Blueprint, jsonify, send_file, request
from core.db import get_pg_conn
from app import ipw_logger

REPORT_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'databases', 'narrative_report.json'))

reporting_bp = Blueprint('reporting', __name__)

@reporting_bp.route("/api/export/html")
def api_export_html():
    """Generate and return a standalone HTML investigation report."""
    if not os.path.exists(REPORT_FILE):
        return jsonify({"error": "No report available. Run analysis first."}), 404

    with open(REPORT_FILE, encoding="utf-8") as f:
        report = json.load(f)

    summary = report.get("executive_summary", {})
    findings = report.get("findings", [])

    sev_colors = {
        "CRITICAL": "#ef4444", "HIGH": "#f97316",
        "MEDIUM": "#eab308", "LOW": "#22c55e", "INFO": "#6b7280"
    }

    import html
    findings_html = ""
    for f in findings:
        color = sev_colors.get(f.get("severity"), "#6b7280")
        emoji = f.get("severity_emoji", "")
        ns_html = "".join(f"<li>{html.escape(str(ns))}</li>" for ns in f.get("next_steps", []))
        findings_html += f"""
        <div class="finding" style="border-left: 4px solid {color};">
          <div class="finding-header">
            <span class="badge" style="background:{color}">{html.escape(emoji)} {html.escape(str(f.get('severity', '')))}</span>
            <h3>{html.escape(str(f.get('title', '')))}</h3>
          </div>
          <p class="summary">{html.escape(str(f.get('summary', '')))}</p>
          <p>{html.escape(str(f.get('explanation', '')))}</p>
          <div class="box"><strong>What This Could Mean:</strong><p>{html.escape(str(f.get('what_it_means', '')))}</p></div>
          <div class="box"><strong>Next Steps for Investigation:</strong><ul>{ns_html}</ul></div>
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>India Procurement Watch — Analysis Report</title>
<style>
  body {{ font-family: Georgia, serif; max-width: 900px; margin: 40px auto; padding: 20px; color: #1a1a2e; background: #fafafa; }}
  h1 {{ color: #1a1a2e; border-bottom: 3px solid #f97316; padding-bottom: 10px; }}
  h2 {{ color: #f97316; margin-top: 40px; }}
  .meta {{ color: #666; font-size: 0.9em; margin-bottom: 30px; }}
  .exec-summary {{ background: #1a1a2e; color: white; padding: 25px; border-radius: 8px; margin-bottom: 40px; }}
  .exec-summary p {{ color: #d1d5db; line-height: 1.7; }}
  .counts {{ display: flex; gap: 20px; margin-top: 15px; }}
  .count-box {{ text-align: center; padding: 10px 20px; border-radius: 6px; }}
  .finding {{ background: white; padding: 25px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
  .finding-header {{ display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }}
  .finding-header h3 {{ margin: 0; font-size: 1.1em; }}
  .badge {{ color: white; padding: 3px 10px; border-radius: 20px; font-size: 0.75em; font-weight: bold; white-space: nowrap; }}
  .summary {{ font-weight: bold; color: #374151; margin-bottom: 12px; }}
  .box {{ background: #f9fafb; border-radius: 6px; padding: 15px; margin-top: 15px; }}
  .box strong {{ color: #1a1a2e; }}
  ul {{ margin: 8px 0; padding-left: 20px; line-height: 1.8; }}
  @media print {{ body {{ background: white; }} .finding {{ box-shadow: none; border: 1px solid #eee; }} }}
</style>
</head>
<body>
<h1>🏛️ India Procurement Watch</h1>
<p class="meta">Analysis Report — Generated: {summary.get('generated_at', 'N/A')} &nbsp;|&nbsp; <strong>PUBLIC DATA FOR PUBLIC SCRUTINY</strong></p>

<div class="exec-summary">
  <h2 style="color:white;margin-top:0">{summary.get('headline', 'Analysis Report')}</h2>
  <p>{summary.get('paragraph_1', '')}</p>
  <p>{summary.get('paragraph_2', '')}</p>
  <p>{summary.get('paragraph_3', '')}</p>
  <div class="counts">
    <div class="count-box" style="background:#ef4444">🔴<br><strong>{summary.get('critical_count',0)}</strong><br>CRITICAL</div>
    <div class="count-box" style="background:#f97316">🟠<br><strong>{summary.get('high_count',0)}</strong><br>HIGH</div>
    <div class="count-box" style="background:#eab308">🟡<br><strong>{summary.get('medium_count',0)}</strong><br>MEDIUM</div>
  </div>
</div>

<h2>Findings ({len(findings)} total)</h2>
{findings_html}

<hr style="margin-top:40px">
<p style="color:#999;font-size:0.8em;text-align:center">
  India Procurement Watch | Data sourced from CPPP (eprocure.gov.in) | Public data for public scrutiny.
</p>
</body></html>"""

    from flask import Response
    return Response(html, mimetype="text/html",
                    headers={"Content-Disposition": "attachment; filename=procurement_report.html"})

@reporting_bp.route("/api/export/print")
def api_export_print():
    """Generate and return a print-friendly HTML report with auto-print trigger."""
    if not os.path.exists(REPORT_FILE):
        return jsonify({"error": "No report available. Run analysis first."}), 404

    with open(REPORT_FILE, encoding="utf-8") as f:
        report = json.load(f)

    summary = report.get("executive_summary", {})
    findings = report.get("findings", [])

    sev_colors = {
        "CRITICAL": "#ef4444", "HIGH": "#f97316",
        "MEDIUM": "#eab308", "LOW": "#22c55e", "INFO": "#6b7280"
    }

    import html
    findings_html = ""
    for f in findings:
        color = sev_colors.get(f.get("severity"), "#6b7280")
        emoji = f.get("severity_emoji", "")
        ns_html = "".join(f"<li>{html.escape(str(ns))}</li>" for ns in f.get("next_steps", []))
        findings_html += f"""
        <div class="finding" style="border-left: 4px solid {color};">
          <div class="finding-header">
            <span class="badge" style="background:{color}">{html.escape(emoji)} {html.escape(str(f.get('severity', '')))}</span>
            <h3>{html.escape(str(f.get('title', '')))}</h3>
          </div>
          <p class="summary">{html.escape(str(f.get('summary', '')))}</p>
          <p>{html.escape(str(f.get('explanation', '')))}</p>
          <div class="box"><strong>What This Could Mean:</strong><p>{html.escape(str(f.get('what_it_means', '')))}</p></div>
          <div class="box"><strong>Next Steps for Investigation:</strong><ul>{ns_html}</ul></div>
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>India Procurement Watch — Analysis Report</title>
<style>
  body {{ font-family: Georgia, serif; max-width: 900px; margin: 40px auto; padding: 20px; color: #1a1a2e; background: #fafafa; }}
  h1 {{ color: #1a1a2e; border-bottom: 3px solid #f97316; padding-bottom: 10px; }}
  h2 {{ color: #f97316; margin-top: 40px; }}
  .meta {{ color: #666; font-size: 0.9em; margin-bottom: 30px; }}
  .exec-summary {{ background: #1a1a2e; color: white; padding: 25px; border-radius: 8px; margin-bottom: 40px; }}
  .exec-summary p {{ color: #d1d5db; line-height: 1.7; }}
  .counts {{ display: flex; gap: 20px; margin-top: 15px; }}
  .count-box {{ text-align: center; padding: 10px 20px; border-radius: 6px; }}
  .finding {{ background: white; padding: 25px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
  .finding-header {{ display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }}
  .finding-header h3 {{ margin: 0; font-size: 1.1em; }}
  .badge {{ color: white; padding: 3px 10px; border-radius: 20px; font-size: 0.75em; font-weight: bold; white-space: nowrap; }}
  .summary {{ font-weight: bold; color: #374151; margin-bottom: 12px; }}
  .box {{ background: #f9fafb; border-radius: 6px; padding: 15px; margin-top: 15px; }}
  .box strong {{ color: #1a1a2e; }}
  ul {{ margin: 8px 0; padding-left: 20px; line-height: 1.8; }}
  @media print {{ body {{ background: white; margin: 0; padding: 0; }} .finding {{ box-shadow: none; border: 1px solid #eee; page-break-inside: avoid; }} }}
</style>
<script>
  window.onload = function() {{
    setTimeout(function() {{
      window.print();
    }}, 500);
  }}
</script>
</head>
<body>
<h1>🏛️ India Procurement Watch</h1>
<p class="meta">Analysis Report — Generated: {summary.get('generated_at', 'N/A')} &nbsp;|&nbsp; <strong>PUBLIC DATA FOR PUBLIC SCRUTINY</strong></p>

<div class="exec-summary">
  <h2 style="color:white;margin-top:0">{summary.get('headline', 'Analysis Report')}</h2>
  <p>{summary.get('paragraph_1', '')}</p>
  <p>{summary.get('paragraph_2', '')}</p>
  <p>{summary.get('paragraph_3', '')}</p>
  <div class="counts">
    <div class="count-box" style="background:#ef4444">🔴<br><strong>{summary.get('critical_count',0)}</strong><br>CRITICAL</div>
    <div class="count-box" style="background:#f97316">🟠<br><strong>{summary.get('high_count',0)}</strong><br>HIGH</div>
    <div class="count-box" style="background:#eab308">🟡<br><strong>{summary.get('medium_count',0)}</strong><br>MEDIUM</div>
  </div>
</div>

<h2>Findings ({len(findings)} total)</h2>
{findings_html}

<hr style="margin-top:40px">
<p style="color:#999;font-size:0.8em;text-align:center">
  India Procurement Watch | Data sourced from CPPP (eprocure.gov.in) | Public data for public scrutiny.
</p>
</body></html>"""

    from flask import Response
    return Response(html, mimetype="text/html")

@reporting_bp.route("/api/narrative-report")
def api_narrative_report():
    if os.path.exists(REPORT_FILE):
        try:
            with open(REPORT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Generate markdown formatting if not already attached
            if "markdown" not in data:
                md_lines = []
                exec_sum = data.get("executive_summary", {})
                md_lines.append(f"# {exec_sum.get('title', 'Data Analysis Summary')}\n")
                if exec_sum.get("paragraph_1"): md_lines.append(f"{exec_sum['paragraph_1']}\n")
                if exec_sum.get("paragraph_2"): md_lines.append(f"{exec_sum['paragraph_2']}\n")
                if exec_sum.get("paragraph_3"): md_lines.append(f"{exec_sum['paragraph_3']}\n")
                
                md_lines.append("\n## Key Audit Findings\n")
                for item in data.get("findings", []):
                    sev = item.get("severity", "INFO")
                    title = item.get("title", "Finding")
                    md_lines.append(f"### [{sev}] {title}\n")
                    if item.get("summary"): md_lines.append(f"**Summary:** {item['summary']}\n")
                    if item.get("explanation"): md_lines.append(f"**Explanation:** {item['explanation']}\n")
                    if item.get("what_it_means"): md_lines.append(f"**What It Means:** {item['what_it_means']}\n")
                    if item.get("next_steps"):
                        md_lines.append("**Recommended Next Steps:**")
                        for step in item["next_steps"]:
                            md_lines.append(f"- {step}")
                        md_lines.append("")
                data["markdown"] = "\n".join(md_lines)
            
            return jsonify(data)
        except Exception as e:
            return jsonify({"error": f"Error loading report: {str(e)}"}), 500

    # Fallback: Generate dynamic summary from PostgreSQL if narrative_report.json not found
    try:
        conn = get_pg_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT COUNT(*) as total_contracts, SUM(contract_value)/10000000.0 as total_value_cr FROM aoc_tenders")
        row = cur.fetchone() or {}
        conn.close()
        
        c_count = row.get("total_contracts", 0)
        c_val = round(row.get("total_value_cr", 0) or 0, 2)
        
        md_text = f"""# Executive Procurement Analysis Report

This analysis covers **{c_count:,}** awarded contracts with a total spending value of **₹{c_val:,.2f} Crore**.

## Summary Highlights
- **Contract Coverage:** Automated profiling active across central and state portals.
- **Single-Bid Flagging:** High-value tenders with single bidder participation are monitored in the Investigation Desk.
- **Repeat Winner Audit:** Vendor department concentration is indexed for structural risk analysis.
"""
        return jsonify({
          "executive_summary": {
            "title": "Executive Procurement Analysis Report",
            "paragraph_1": f"This analysis covers {c_count:,} awarded contracts worth ₹{c_val:,.2f} Crore.",
            "total_findings": 3
          },
          "findings": [],
          "markdown": md_text
        })
    except Exception as e:
        return jsonify({"error": f"Failed to generate dynamic report: {str(e)}"}), 500
