# India Procurement Watch — API Documentation

Base URL: `https://tender.darshi.app/api`  
Rate Limit: 100 requests per hour per IP  
Default Response: `application/json`

---

## Overview & Analytics

### GET /api/kpis
Returns platform KPI totals.
- Query params: `year` (optional, integer, e.g. 2024)
- Sample response:
```json
{
  "total_contracts": 3212228,
  "total_value_cr": 5071865.4,
  "unique_orgs": 10436,
  "total_tenders": 3450120
}
```

### GET /api/trends
Procurement time-series trend data.
- Query params: 
  - `grain`: `yearly` | `monthly` (default: `yearly`)
  - `dataset`: `aoc`

### GET /api/top-orgs
Top purchasing government departments.
- Query params:
  - `by`: `count` | `value` (default: `count`)
  - `limit`: integer (default: 15)

### GET /api/tender-types
Distribution across Works, Goods, and Services procurement classifications.

### GET /api/value-distribution
Contract value bracket distribution.

### GET /api/portal-breakdown
Split between Central eProcurement vs State portals.

### GET /api/sector-distribution
Spending breakdown by industry sector.
- Query params: `by`: `count` | `value`

---

## Maps & State Data

### GET /api/state-stats
State-level contract counts and total spend for mapping and state tables.

---

## Anomalies & Risk Flags

### GET /api/single-bid-contracts
Single-bidder awarded contracts.
- Query params:
  - `min_val`: integer in INR (default: 1000000)
  - `page`: integer (default: 1)

### GET /api/repeat-winners
Vendors repeatedly winning contracts in the same organization.
- Query params:
  - `min_wins`: integer (default: 3)
  - `page`: integer (default: 1)

### GET /api/sanctions
Bidders matched against sanction and watchlist registries.

---

## Search & Data Points

### GET /api/search
Full-text search across tenders and vendors.
- Query params:
  - `q`: search query string
  - `page`: integer (default: 1)

---

## Network Graph & MCA Linkage

### GET /api/network/search
Search nodes in the director & vendor network graph.
- Query params: `q`: search query string

### GET /api/network/ego/{node_id}
1-Hop neighborhood network graph formatted for graph visualizers (vis-network, D3).
- Returns: `{ "nodes": [...], "edges": [...] }`

### GET /api/vendor-mca/{vendor_name}
MCA corporate registry information for a vendor.

---

## AI Engine & System Status

### POST /api/ai-chat
Streams real-time AI query responses.
- Headers: `Content-Type: application/json`
- Body: `{ "text": "Query string", "model": "gemini-3.5-flash" }`
- Response: `text/event-stream` (real-time chunked stream)

### GET /api/narrative-report
Summary report JSON of systemic audit findings.

### GET /api/status
Ingestion status and latest update timestamp.
