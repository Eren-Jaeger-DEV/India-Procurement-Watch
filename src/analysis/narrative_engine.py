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
    min_yr = kpis.get("min_year", "?")
    max_yr = kpis.get("max_year", "?")

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


def analyse_anomalies(anomalies_by_type):
    """Generate findings from anomaly data."""
    findings = []

    round_count = anomalies_by_type.get("round_number", {}).get("total", 0)
    quick_count = anomalies_by_type.get("quick_award", {}).get("total", 0)
    hv_count = anomalies_by_type.get("high_value_state", {}).get("total", 0)

    if quick_count > 0:
        severity = "CRITICAL" if quick_count > 50 else "HIGH"
        findings.append(_finding(
            severity,
            f"{quick_count:,} Contracts Awarded Implausibly Fast (≤ 1 day)",
            f"{quick_count:,} contracts were awarded within 24 hours of the bidding deadline closing.",
            f"Standard procurement procedure requires time to receive bids, evaluate them against technical "
            f"and financial criteria, obtain approval from a tender committee, and issue the Award of Contract. "
            f"This process typically takes days to weeks. Yet {quick_count:,} contracts in this dataset "
            f"were awarded on the same day — or within 24 hours — of the bidding deadline. "
            f"This is physically implausible under fair procurement rules.",
            "Contracts awarded this fast were almost certainly pre-decided before bidding opened. "
            "The tender process may have been a formality to create a paper trail for a pre-arranged award. "
            "This is one of the strongest structural red flags for procurement fraud.",
            [
                "Prioritise these contracts for RTI requests — ask for the bid evaluation committee minutes.",
                "Check if the same vendor appears across multiple 'quick award' contracts.",
                "Verify if the award date and bid closing date in the raw data are accurate — some may be data entry errors.",
                "Cross-reference with the vendor who won — are they politically connected?"
            ],
            {"count": quick_count}
        ))

    if round_count > 0:
        round_pct_of_total = None
        total = anomalies_by_type.get("_total_contracts", 0)
        if total > 0:
            round_pct_of_total = round(round_count / total * 100, 1)

        severity = "MEDIUM"
        pct_str = f" ({round_pct_of_total}% of all contracts)" if round_pct_of_total else ""
        findings.append(_finding(
            severity,
            f"{round_count:,} Contracts at Suspiciously Round Numbers{pct_str}",
            f"{round_count:,} contracts have values that are exact multiples of ₹1 Lakh (₹1,00,000).",
            f"In competitive procurement, contract values should reflect the actual cost of work or goods — "
            f"a messy, specific number. When {round_count:,} contracts are awarded at exactly ₹10,00,000 "
            f"or ₹50,00,000 or ₹1,00,00,000, it strongly suggests the price was estimated rather than "
            f"competitively determined. This is a classic signal of single-vendor negotiations or rubber-stamped approvals.",
            "Round-number contracts suggest either: (1) the 'lowest bidder' was told what price to quote, "
            "(2) the contract value was set before bidding began, or "
            "(3) estimates are being passed off as market-tested prices.",
            [
                "Compare round-number contracts against similar contracts with specific values — which orgs have higher rates?",
                "Check if round-number contracts cluster around specific thresholds that trigger higher oversight (e.g., ₹1 Crore).",
                "A high rate of round numbers combined with a high rate of single bids is a very strong compound signal."
            ],
            {"count": round_count}
        ))

    if hv_count > 0:
        findings.append(_finding(
            "HIGH",
            f"{hv_count:,} High-Value State Contracts Over ₹10 Crore",
            f"{hv_count:,} contracts awarded by state governments exceed ₹10 Crore each.",
            f"State government contracts above ₹10 Crore are significant expenditures "
            f"that should be subject to rigorous oversight, competitive tendering, and "
            f"approval at senior government levels. This dataset contains {hv_count:,} such contracts, "
            f"collectively representing a large share of state procurement spending.",
            "High-value state contracts are particularly prone to political interference in vendor selection, "
            "inflated valuations, and poor quality delivery. They are also harder to scrutinize "
            "as state-level RTI responses are often slower.",
            [
                "Identify which states dominate this list.",
                "Check if any single vendor appears across multiple high-value state contracts.",
                "Look for contracts awarded near state election dates."
            ],
            {"count": hv_count}
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


def analyse_report_cards(report_cards):
    """Generate systemic findings from org risk grades."""
    findings = []
    results = report_cards.get("results", [])

    if not results:
        return findings

    f_grade = [r for r in results if r.get("grade") == "F"]
    d_grade = [r for r in results if r.get("grade") == "D"]

    if f_grade:
        worst = sorted(f_grade, key=lambda x: -(x.get("total_contracts", 0)))[:5]
        names = [w.get("org_name", "Unknown") for w in worst]
        total_value = sum(w.get("total_value_crore", 0) for w in worst)
        findings.append(_finding(
            "CRITICAL" if len(f_grade) > 10 else "HIGH",
            f"{len(f_grade)} Departments Graded 'F' for Procurement Risk",
            f"{len(f_grade)} organisations scored the highest risk level based on single-bid and round-number patterns.",
            f"The risk grading system assigns 'F' to departments where over 40% of contracts "
            f"show procurement red flags (single bids, round-number values). "
            f"{len(f_grade)} departments have earned this lowest grade. "
            f"The highest-volume 'F' grade departments include: {', '.join(names[:3])}. "
            f"Together, the top 5 'F' departments control at least ₹{total_value:.0f} Crore in contracts.",
            "An 'F' grade does not automatically mean corruption — it means the procurement patterns "
            "match the profile of high-risk procurement. It could reflect poor procedure, "
            "weak oversight, or active manipulation. Without investigation, the cause is unknown.",
            [
                f"Prioritise these {len(f_grade)} departments for RTI requests and audit scrutiny.",
                "Check if 'F' grade departments are concentrated in specific states or sectors.",
                "Compare 'F' departments' single-bid rates against their market — are they justified by specialisation?",
            ],
            {"f_grade_count": len(f_grade), "worst_orgs": names, "combined_value": total_value}
        ))

    if d_grade:
        findings.append(_finding(
            "MEDIUM",
            f"{len(d_grade)} More Departments Graded 'D' (Elevated Risk)",
            f"An additional {len(d_grade)} departments show elevated procurement risk patterns.",
            f"Beyond the 'F' grade departments, {len(d_grade)} more organisations "
            f"have been graded 'D' — indicating that 25–40% of their contracts raise flags. "
            f"This is a significant secondary tier of risk that should not be ignored.",
            "A 'D' grade means procurement practices are poor enough to warrant attention, "
            "even if they haven't reached the extreme levels of 'F' grade departments.",
            [
                "Monitor 'D' grade departments — are their scores improving or worsening over time?",
                "Combine grade data with contract value data — a mid-size department with a 'D' grade but high contract value is still high priority."
            ],
            {"d_grade_count": len(d_grade)}
        ))

    return findings


def analyse_trends(yearly_data):
    """Detect spending pattern anomalies in yearly trends."""
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
                    "Sudden spending spikes can indicate: year-end budget rush (use-it-or-lose-it spending), "
                    "large infrastructure projects suddenly approved, or inflated contract values being rubber-stamped "
                    "to absorb available budget before the financial year closes.",
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
    total = int(kpis.get("total_aoc_tenders", 0) or 0)
    total_value = float(kpis.get("total_value_crore", 0) or 0)
    unique_orgs = int(kpis.get("unique_aoc_orgs", 0) or 0)
    min_yr = kpis.get("min_year", "?")
    max_yr = kpis.get("max_year", "?")
    total_pub = int(kpis.get("total_published_tenders", 0) or 0)

    critical_count = sum(1 for f in all_findings if f["severity"] == "CRITICAL")
    high_count = sum(1 for f in all_findings if f["severity"] == "HIGH")
    medium_count = sum(1 for f in all_findings if f["severity"] == "MEDIUM")

    risk_statement = ""
    if critical_count > 0:
        risk_statement = f"The analysis has identified {critical_count} CRITICAL and {high_count} HIGH severity findings that warrant immediate investigative attention."
    elif high_count > 0:
        risk_statement = f"The analysis has identified {high_count} HIGH severity findings that indicate significant procurement irregularities."
    else:
        risk_statement = f"The analysis has identified {medium_count} MEDIUM severity findings with patterns worth monitoring."

    return {
        "headline": f"Analysis of {total:,} Government Procurement Contracts ({min_yr}–{max_yr})",
        "paragraph_1": (
            f"This dataset covers {total:,} awarded contracts spanning {min_yr} to {max_yr}, "
            f"involving {unique_orgs:,} unique government organisations. "
            f"The total declared value of these contracts is ₹{total_value:,.0f} Crore. "
            + (f"Additionally, {total_pub:,} published (open) tenders are tracked." if total_pub > 0 else "")
        ),
        "paragraph_2": risk_statement,
        "paragraph_3": (
            "The findings below are ranked by severity. CRITICAL findings represent structural patterns "
            "that are inconsistent with fair, transparent procurement. HIGH findings indicate strong "
            "statistical anomalies. MEDIUM and LOW findings are patterns that should be monitored "
            "but may have legitimate explanations."
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

def generate_full_report(kpis, anomalies_by_type, top_orgs, single_bid_data,
                          repeat_winners_data, report_cards, yearly_data, total_contracts=0):
    """
    Master function: takes all processed data and returns the complete
    narrative report as a structured dictionary.
    """
    all_findings = []

    all_findings += analyse_kpis(kpis)
    all_findings += analyse_anomalies(anomalies_by_type)
    all_findings += analyse_top_orgs(top_orgs)
    all_findings += analyse_single_bids(single_bid_data, total_contracts)
    all_findings += analyse_repeat_winners(repeat_winners_data)
    all_findings += analyse_report_cards(report_cards)
    all_findings += analyse_trends(yearly_data)

    # Sort by severity descending
    all_findings.sort(key=lambda x: -x["severity_level"])

    executive_summary = generate_executive_summary(kpis, all_findings)

    return {
        "executive_summary": executive_summary,
        "findings": all_findings,
        "generated_at": datetime.now().isoformat(),
    }
