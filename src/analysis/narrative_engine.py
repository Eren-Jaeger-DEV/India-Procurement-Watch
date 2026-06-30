"""
src/analysis/narrative_engine.py
=================================
Rule-based narrative generator. Takes processed summary data and converts
raw numbers into plain-English investigative findings sorted by severity.
No AI API needed — runs fully offline.
"""

from datetime import datetime

# ─────────────────────────────────────────────
# SEVERITY LEVELS
# ─────────────────────────────────────────────

SEVERITY = {
    "CRITICAL": {"level": 4, "color": "#ef4444", "emoji": "🔴"},
    "HIGH":     {"level": 3, "color": "#f97316", "emoji": "🟠"},
    "MEDIUM":   {"level": 2, "color": "#eab308", "emoji": "🟡"},
    "LOW":      {"level": 1, "color": "#22c55e", "emoji": "🟢"},
    "INFO":     {"level": 0, "color": "#6b7280", "emoji": "ℹ️"},
}


def _finding(severity, title, summary, explanation, what_it_means, next_steps, data=None):
    return {
        "severity": severity,
        "severity_level": SEVERITY[severity]["level"],
        "severity_color": SEVERITY[severity]["color"],
        "severity_emoji": SEVERITY[severity]["emoji"],
        "title": title,
        "summary": summary,
        "explanation": explanation,
        "what_it_means": what_it_means,
        "next_steps": next_steps,
        "data": data or {},
    }


# ─────────────────────────────────────────────
# ANALYSIS RULES
# ─────────────────────────────────────────────

def analyse_kpis(kpis):
    """Generate findings from top-level KPI statistics."""
    findings = []

    total = int(kpis.get("total_aoc_tenders", 0) or 0)
    valued = int(kpis.get("total_contracts_valued", 0) or 0)
    total_value = float(kpis.get("total_value_crore", 0) or 0)
    avg_value = float(kpis.get("avg_value_crore", 0) or 0)

    if total > 0:
        undisclosed_pct = round((1 - valued / total) * 100, 1) if total else 0
        if undisclosed_pct > 40:
            findings.append(_finding(
                "HIGH",
                f"{undisclosed_pct}% of Contracts Have No Disclosed Value",
                f"Out of {total:,} contracts, {total - valued:,} have no value recorded.",
                f"A large portion — {undisclosed_pct}% — of all awarded contracts in this dataset "
                f"do not have a contract value disclosed. This is a significant transparency gap. "
                f"Government procurement rules mandate value disclosure, yet nearly half of all records "
                f"are silent on this most basic fact.",
                "This could indicate systemic non-compliance with disclosure norms, selective suppression "
                "of large or controversial contracts, or poor data collection practices. "
                "Contracts without values cannot be audited for reasonableness.",
                [
                    "Cross-reference undisclosed contracts with the portal source to check if values were published elsewhere.",
                    "File RTI requests for the specific departments with the highest rates of non-disclosure.",
                    "Compare which portal types (central vs state) have higher non-disclosure rates."
                ],
                {"undisclosed_pct": undisclosed_pct, "total": total, "undisclosed_count": total - valued}
            ))
        elif undisclosed_pct > 20:
            findings.append(_finding(
                "MEDIUM",
                f"{undisclosed_pct}% of Contracts Have No Disclosed Value",
                f"{total - valued:,} contracts out of {total:,} have no value on record.",
                f"{undisclosed_pct}% of contracts in this dataset have no contract value recorded. "
                f"While some contracts may genuinely have undisclosed values for security or commercial sensitivity reasons, "
                f"this rate is above the expected norm for transparent procurement.",
                "Incomplete disclosure makes it impossible to calculate total government spending accurately "
                "or assess value-for-money at scale.",
                [
                    "Identify which departments and years have the highest non-disclosure rates.",
                    "Check if patterns correlate with contract size — larger contracts may be selectively omitted."
                ],
                {"undisclosed_pct": undisclosed_pct}
            ))

    if avg_value > 0:
        if avg_value > 10:
            findings.append(_finding(
                "INFO",
                f"Average Contract Size is ₹{avg_value:.1f} Crore",
                f"The mean contract value across {valued:,} valued contracts is ₹{avg_value:.2f} Crore.",
                f"The average contract value of ₹{avg_value:.1f} Crore across {valued:,} contracts "
                f"indicates this dataset skews heavily toward large, high-value procurements. "
                f"This is typical for central government infrastructure and defence contracts.",
                "High average values are not inherently suspicious, but they do mean each contract decision "
                "has enormous financial impact. A single corrupt or poorly managed contract at this scale "
                "represents significant public money.",
                ["Focus investigative attention on contracts significantly above this average."],
                {"avg_value_crore": avg_value}
            ))

    return findings




def analyse_top_orgs(top_orgs):
    """Analyse concentration of contracts in top organisations."""
    findings = []
    if not top_orgs or len(top_orgs) < 2:
        return findings

    # Check if top 5 orgs dominate
    total_all = sum(o.get("count", 0) for o in top_orgs)
    if total_all == 0:
        return findings

    top5_count = sum(o.get("count", 0) for o in top_orgs[:5])
    top5_pct = round(top5_count / total_all * 100, 1)

    if top5_pct > 60:
        top_names = [o.get("org_name", "Unknown") for o in top_orgs[:3]]
        findings.append(_finding(
            "MEDIUM",
            f"Top 5 Departments Award {top5_pct}% of All Contracts",
            f"Procurement is heavily concentrated in a handful of organisations.",
            f"The top 5 awarding organisations account for {top5_pct}% of all contracts in this dataset. "
            f"These include: {', '.join(top_names)}, and others. "
            f"While large infrastructure ministries naturally award more contracts, "
            f"this level of concentration means the actions of a few departments have outsized impact "
            f"on overall procurement quality and integrity.",
            "High concentration means a small number of procurement officers control enormous budgets. "
            "It also means that if corruption exists in even one of these top departments, "
            "its effect on public money is multiplied.",
            [
                "Focus auditing and RTI efforts on the top 5 departments first — highest impact per investigation.",
                "Compare the transparency grade (risk score) of high-volume departments vs. their size.",
            ],
            {"top5_pct": top5_pct, "top_orgs_list": top_names}
        ))

    return findings


def analyse_single_bids(single_bid_data, total_contracts):
    """Analyse single-bid contract patterns."""
    findings = []
    total_single = single_bid_data.get("total", 0)

    if total_contracts <= 0 or total_single <= 0:
        return findings

    pct = round(total_single / total_contracts * 100, 1)

    if pct > 30:
        severity = "CRITICAL"
        interpretation = (
            "A rate above 30% of contracts receiving only one bid is a systemic failure of competitive procurement. "
            "Either: (1) tenders are being written to exclude all but one pre-selected vendor, "
            "(2) tenders are being published so obscurely that no other companies find them, "
            "(3) the procurement market is genuinely uncompetitive in these sectors, or "
            "(4) the data reflects repeat no-bid contracts that should trigger automatic re-tendering."
        )
    elif pct > 15:
        severity = "HIGH"
        interpretation = (
            f"A single-bid rate of {pct}% is significantly elevated. In a healthy procurement ecosystem, "
            "single bids should be rare — they indicate a failure of competitive tendering. "
            "When only one vendor bids, there is no price competition, no quality comparison, "
            "and the government has no leverage."
        )
    else:
        severity = "MEDIUM"
        interpretation = (
            f"A single-bid rate of {pct}% is present. While some level of single-bid contracts "
            "is normal for specialised or highly technical procurements, "
            "this rate warrants monitoring to ensure tenders are reaching the widest possible audience."
        )

    findings.append(_finding(
        severity,
        f"{pct}% of Contracts Had Only One Bidder ({total_single:,} contracts)",
        f"{total_single:,} contracts received exactly one bid — meaning there was no competitive pricing.",
        f"Of the contracts in this dataset where bid count data is available, "
        f"{total_single:,} ({pct}%) received only a single bid. "
        f"In public procurement, competition is the primary mechanism to ensure taxpayers "
        f"get fair value for money. A single bid means that mechanism failed completely.",
        interpretation,
        [
            "Identify which departments have the highest single-bid rates — these are the highest-risk units.",
            "Check if repeat single-bid contracts repeatedly go to the same vendor.",
            "Look at the tender publication timeline — were single-bid tenders published for unusually short durations?",
            "Cross-reference single-bid contracts with round-number values — the compound signal is very strong.",
        ],
        {"total_single_bid": total_single, "single_bid_pct": pct}
    ))

    return findings


def analyse_repeat_winners(repeat_winners_data):
    """Analyse vendor concentration / repeat winner patterns."""
    findings = []
    top_winners = repeat_winners_data.get("results", [])

    if not top_winners:
        return findings

    # Find extreme repeat winners
    extreme = [w for w in top_winners if w.get("wins", 0) >= 20]
    if extreme:
        top = extreme[0]
        findings.append(_finding(
            "HIGH",
            f"Vendor '{top.get('bidder_name', 'Unknown')}' Won {top.get('wins', 0)} Contracts from Same Department",
            f"A single vendor dominated procurement from one government department with {top.get('wins', 0)} wins.",
            f"The vendor '{top.get('bidder_name', 'Unknown')}' won {top.get('wins', 0)} contracts "
            f"from '{top.get('org_name', 'the same department')}' "
            f"between {top.get('first_win', '?')} and {top.get('last_win', '?')}, "
            f"totalling approximately ₹{top.get('total_value_crore', 0):.1f} Crore. "
            f"This extreme concentration of contracts in one vendor-department relationship "
            f"is a significant structural anomaly.",
            "Legitimate repeat wins are possible for vendors providing ongoing services or specialised equipment. "
            "However, {0} wins from the same department suggests either a monopoly arrangement, "
            "a preferred vendor relationship, or that the tender specifications are written "
            "to systematically exclude competitors.".format(top.get('wins', 0)),
            [
                f"Investigate whether '{top.get('bidder_name', 'Unknown')}' is the sole supplier in its market or if competitors exist.",
                "Check if any single-bid contracts are included in these wins — the strongest red flag.",
                "Look at the contract values over time — are they increasing? A rising trend suggests dependency.",
                "File RTI to see tender evaluation reports for the highest-value wins."
            ],
            {"vendor": top.get("bidder_name"), "wins": top.get("wins"), "dept": top.get("org_name"), "value": top.get("total_value_crore")}
        ))

    multi_winners = [w for w in top_winners if 10 <= w.get("wins", 0) < 20]
    if len(multi_winners) > 5:
        findings.append(_finding(
            "MEDIUM",
            f"{len(multi_winners)} Vendors Have Won 10–19 Contracts from the Same Department",
            f"A pattern of repeat vendor dominance exists across multiple departments.",
            f"Beyond the extreme cases, {len(multi_winners)} vendor-department pairs show "
            f"a pattern of 10–19 repeat wins. This suggests the repeat-winner phenomenon "
            f"is not isolated but systemic across multiple departments in this dataset.",
            "When multiple departments independently show the same vendor-capture pattern, "
            "it suggests either: a market structure issue (too few vendors in these sectors), "
            "or a systemic procurement culture that favours known vendors over competition.",
            [
                "Map these relationships — do any vendors appear in multiple departments?",
                "Identify the sectors (construction, IT, medical supplies) where repeat wins are most common."
            ],
            {"count": len(multi_winners)}
        ))

    return findings


def analyse_trends(yearly_data):
    """Detect notable changes in yearly trends."""
    findings = []

    if not yearly_data or len(yearly_data.get("labels", [])) < 3:
        return findings

    labels = yearly_data.get("labels", [])
    values = yearly_data.get("values", [])
    counts = yearly_data.get("counts", [])

    # Detect year-over-year spikes in value
    for i in range(1, len(values)):
        prev = values[i-1]
        curr = values[i]
        if prev > 0 and curr > 0:
            change_pct = ((curr - prev) / prev) * 100
            if change_pct > 150:
                findings.append(_finding(
                    "MEDIUM",
                    f"Spending Spike of +{change_pct:.0f}% Between {labels[i-1]} and {labels[i]}",
                    f"Total contract value jumped from ₹{prev:.0f} Cr to ₹{curr:.0f} Cr in one year.",
                    f"Between {labels[i-1]} and {labels[i]}, total declared contract value "
                    f"increased by {change_pct:.0f}% — from ₹{prev:.0f} Crore to ₹{curr:.0f} Crore. "
                    f"While some year-to-year variation is normal (new projects, annual budgets), "
                    f"a spike of this magnitude warrants explanation.",
                    "Sudden spending spikes can indicate year-end budget utilization, "
                    "or large infrastructure projects suddenly approved.",
                    [
                        f"Identify which departments drove the {labels[i]} spending spike.",
                        f"Check if the surge in {labels[i]} correlates with election cycles or budget approvals.",
                        "Compare the contract quality (single-bid rates, round numbers) in the spike year vs. other years."
                    ],
                    {"from_year": labels[i-1], "to_year": labels[i], "change_pct": round(change_pct, 1),
                     "from_value": prev, "to_value": curr}
                ))
            elif change_pct < -50:
                findings.append(_finding(
                    "LOW",
                    f"Spending Drop of {change_pct:.0f}% Between {labels[i-1]} and {labels[i]}",
                    f"Total contract value fell sharply from ₹{prev:.0f} Cr to ₹{curr:.0f} Cr.",
                    f"Contract spending dropped by {abs(change_pct):.0f}% between {labels[i-1]} and {labels[i]}. "
                    f"This could reflect policy changes, budget cuts, or — importantly — "
                    f"a shift to procurement channels not captured in this dataset.",
                    "Sharp drops can mean real austerity, but can also mean spending moved to "
                    "a different procurement portal or mechanism that isn't included in this data.",
                    ["Check if the drop year coincides with new procurement portals being introduced.",
                     "Verify coverage of this dataset for the drop year."],
                    {"from_year": labels[i-1], "to_year": labels[i], "change_pct": round(change_pct, 1)}
                ))

    return findings


# ─────────────────────────────────────────────
# EXECUTIVE SUMMARY GENERATOR
# ─────────────────────────────────────────────

def generate_executive_summary(kpis, all_findings):
    """Generate a top-level plain-English summary of the entire dataset."""
    total_tenders = int(kpis.get("total_aoc_tenders", 0) or 0)
    total_value = float(kpis.get("total_value_crore", 0) or 0)
    
    critical_count = len([f for f in all_findings if f["severity_level"] == 4])
    high_count = len([f for f in all_findings if f["severity_level"] == 3])
    medium_count = len([f for f in all_findings if f["severity_level"] == 2])

    summary_statement = ""
    if critical_count > 0:
        summary_statement = f"The analysis has generated {critical_count} primary and {high_count} secondary data highlights."
    elif high_count > 0:
        summary_statement = f"The analysis has generated {high_count} primary data highlights."
    elif medium_count > 0:
        summary_statement = f"The analysis has generated {medium_count} notable data trends."
    else:
        summary_statement = "The dataset shows standard procurement patterns with no major statistical deviations."

    return {
        "title": "Data Analysis Summary",
        "paragraph_1": (
            f"This report covers {total_tenders:,} awarded contracts "
            f"with a declared total value of ₹{total_value:,} Crore. "
        ),
        "paragraph_2": summary_statement,
        "paragraph_3": (
            "These findings are generated automatically through statistical profiling. "
            "Primary findings are strong statistical highlights, while secondary findings are patterns that "
            "may warrant further review. None of these findings imply wrongdoing; they are strictly data trends."
        ),
        "critical_count": critical_count,
        "high_count": high_count,
        "medium_count": medium_count,
        "total_findings": len(all_findings),
        "generated_at": datetime.now().strftime("%d %b %Y, %H:%M"),
    }


# ─────────────────────────────────────────────
# MASTER GENERATE FUNCTION
# ─────────────────────────────────────────────

def generate_full_report(kpis, top_orgs, single_bid_data,
                          repeat_winners_data, report_cards, yearly_data, total_contracts=0):
    """
    Master function: takes all processed data and returns the complete
    narrative report as a structured dictionary.
    """
    all_findings = []

    all_findings += analyse_kpis(kpis)

    all_findings += analyse_top_orgs(top_orgs)
    all_findings += analyse_single_bids(single_bid_data, total_contracts)
    all_findings += analyse_repeat_winners(repeat_winners_data)
    all_findings += analyse_trends(yearly_data)

    # Sort by severity descending
    all_findings.sort(key=lambda x: -x["severity_level"])

    executive_summary = generate_executive_summary(kpis, all_findings)

    return {
        "executive_summary": executive_summary,
        "findings": all_findings,
        "generated_at": datetime.now().isoformat(),
    }
