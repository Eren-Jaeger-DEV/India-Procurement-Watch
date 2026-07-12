import { useState, useCallback } from 'react';
import { Filter, Download, AlertTriangle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import './RedFlagExplorer.css';

const API_BASE = '/api';

const FLAG_OPTIONS = [
  { key: 'single_bid',   label: 'Single Bid',    color: '#ef4444', desc: 'Only one bidder - zero competition' },
  { key: 'high_value',   label: 'High Value',     color: '#f97316', desc: 'Contract > ₹10 Cr' },
  { key: 'repeat_win',   label: 'Repeat Winner',  color: '#8b5cf6', desc: 'Same vendor won from same org before' },
  { key: 'debarred',     label: 'Debarred (Sanctions)', color: '#dc2626', desc: 'Vendor matches World Bank sanctions list' },
];

const YEAR_OPTIONS = ['All', 2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015];
const PER_PAGE = 25;

const fmt     = (n) => new Intl.NumberFormat('en-IN').format(n || 0);
const fmtCr   = (n) => n ? `₹${(n / 1e7).toFixed(2)} Cr` : '-';
const fmtDate = (d) => d ? d.split('T')[0] : '-';

// ── risk badge ────────────────────────────────────────────────────────────────
const RiskBadge = ({ score }) => {
  const color = score >= 3 ? '#ef4444' : score >= 2 ? '#f97316' : '#eab308';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11,
      fontWeight: 700, background: `${color}22`, color, border: `1px solid ${color}44`
    }}>
      ⚑ {score}
    </span>
  );
};

// ── main component ────────────────────────────────────────────────────────────
const RedFlagExplorer = () => {
  const [selectedFlags, setSelectedFlags] = useState(['single_bid']);
  const [year,          setYear]          = useState('All');
  const [minValue,      setMinValue]      = useState('');
  const [orgKeyword,    setOrgKeyword]    = useState('');
  const [bidderKw,      setBidderKw]      = useState('');
  const [portal,        setPortal]        = useState('All');
  const [results,       setResults]       = useState([]);
  const [total,         setTotal]         = useState(0);
  const [page,          setPage]          = useState(1);
  const [loading,       setLoading]       = useState(false);
  const [searched,      setSearched]      = useState(false);
  const [error,         setError]         = useState(null);

  const toggleFlag = (key) => {
    setSelectedFlags(prev =>
      prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]
    );
  };

  const runSearch = useCallback(async (pageNum = 1) => {
    setLoading(true); setError(null); setSearched(true);
    try {
      const params = new URLSearchParams({
        page: pageNum,
        per_page: PER_PAGE,
        ...(year !== 'All'     && { year }),
        ...(minValue           && { min_value: Number(minValue) * 1e7 }),
        ...(orgKeyword.trim()  && { org: orgKeyword.trim() }),
        ...(bidderKw.trim()    && { bidder: bidderKw.trim() }),
        ...(portal !== 'All'   && { portal }),
        ...(selectedFlags.length && { flags: selectedFlags.join(',') }),
      });
      const res  = await fetch(`${API_BASE}/red-flag-explorer?${params}`);
      const data = await res.json();
      setResults(data.results || []);
      setTotal(data.total    || 0);
      setPage(pageNum);
    } catch (e) {
      setError('Query failed - please try again.');
    } finally {
      setLoading(false);
    }
  }, [year, minValue, orgKeyword, bidderKw, portal, selectedFlags]);

  const downloadCSV = () => {
    if (!results.length) return;
    const cols = ['org_name', 'title', 'bidder_name', 'contract_value', 'aoc_date', 'portal_type', 'risk_score'];
    const header = cols.join(',');
    const rows = results.map(r =>
      cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csv  = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = 'red_flag_results.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="rfe-page">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="rfe-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={22} style={{ color: '#ef4444' }} /> Red-Flag Explorer
          </h1>
          <p className="page-subtitle">
            Filter 3.2M+ procurement records by risk indicators. Flags are statistical signals - not accusations.
          </p>
        </div>
      </div>

      {/* ── FILTER PANEL ───────────────────────────────────────────────────── */}
      <div className="card rfe-filters">
        <div className="rfe-filter-row">
          {/* Flag chips */}
          <div className="rfe-filter-group">
            <label className="rfe-label">Risk Flags</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {FLAG_OPTIONS.map(f => (
                <button
                  key={f.key}
                  onClick={() => toggleFlag(f.key)}
                  title={f.desc}
                  style={{
                    padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', border: `1.5px solid ${f.color}`,
                    background: selectedFlags.includes(f.key) ? f.color : 'transparent',
                    color: selectedFlags.includes(f.key) ? '#fff' : f.color,
                    transition: 'all 0.15s',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Year */}
          <div className="rfe-filter-group">
            <label className="rfe-label">Award Year</label>
            <select value={year} onChange={e => setYear(e.target.value)} className="rfe-select">
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Portal */}
          <div className="rfe-filter-group">
            <label className="rfe-label">Portal</label>
            <select value={portal} onChange={e => setPortal(e.target.value)} className="rfe-select">
              <option value="All">All</option>
              <option value="state">State</option>
              <option value="central">Central</option>
            </select>
          </div>

          {/* Min value */}
          <div className="rfe-filter-group">
            <label className="rfe-label">Min Value (₹ Cr)</label>
            <input
              type="number" min="0" placeholder="e.g. 1"
              value={minValue} onChange={e => setMinValue(e.target.value)}
              className="rfe-input"
            />
          </div>
        </div>

        <div className="rfe-filter-row" style={{ marginTop: 12 }}>
          {/* Org keyword */}
          <div className="rfe-filter-group" style={{ flex: 2 }}>
            <label className="rfe-label">Organization keyword</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                placeholder="e.g. BHEL, NTPC, Municipal…"
                value={orgKeyword} onChange={e => setOrgKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runSearch(1)}
                className="rfe-input" style={{ paddingLeft: 30 }}
              />
            </div>
          </div>

          {/* Bidder keyword */}
          <div className="rfe-filter-group" style={{ flex: 2 }}>
            <label className="rfe-label">Bidder / Winner keyword</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                placeholder="e.g. L&T, Tata, Infosys…"
                value={bidderKw} onChange={e => setBidderKw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runSearch(1)}
                className="rfe-input" style={{ paddingLeft: 30 }}
              />
            </div>
          </div>

          {/* Search button */}
          <div className="rfe-filter-group" style={{ justifyContent: 'flex-end' }}>
            <label className="rfe-label">&nbsp;</label>
            <button
              onClick={() => runSearch(1)}
              disabled={loading}
              className="rfe-search-btn"
            >
              <Filter size={15} />
              {loading ? 'Searching…' : 'Apply Filters'}
            </button>
          </div>
        </div>
      </div>

      {/* ── RESULTS ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #ef4444', color: '#ef4444', fontSize: 13 }}>
          {error}
        </div>
      )}

      {searched && !loading && (
        <div className="card rfe-results-card">
          <div className="rfe-results-header">
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{fmt(total)}</strong> matching records
              {total > PER_PAGE && ` - page ${page} of ${totalPages}`}
            </div>
            <button
              onClick={downloadCSV}
              disabled={!results.length}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                fontSize: 12, fontWeight: 500, border: '1px solid var(--border-color)',
                borderRadius: 8, background: 'transparent', color: 'var(--text-secondary)',
                cursor: results.length ? 'pointer' : 'not-allowed', opacity: results.length ? 1 : 0.4,
              }}
            >
              <Download size={13} /> Export CSV
            </button>
          </div>

          {results.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              No results match these filters. Try relaxing some criteria.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="rfe-table">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Title</th>
                    <th>Winner / Bidder</th>
                    <th style={{ textAlign: 'right' }}>Value</th>
                    <th>Date</th>
                    <th>Portal</th>
                    <th style={{ textAlign: 'center' }}>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className={r.risk_score >= 3 ? 'high-risk' : r.risk_score >= 2 ? 'med-risk' : ''}>
                      <td className="cell-wrap" title={r.org_name}>{r.org_name}</td>
                      <td className="cell-wrap" title={r.title}>{r.title || '-'}</td>
                      <td className="cell-bidder" title={r.bidder_name}>{r.bidder_name || '-'}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#f97316', whiteSpace: 'nowrap' }}>
                        {fmtCr(r.contract_value)}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 12 }}>{fmtDate(r.aoc_date)}</td>
                      <td>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12,
                          background: r.portal_type === 'central' ? '#3b82f622' : '#8b5cf622',
                          color: r.portal_type === 'central' ? '#3b82f6' : '#8b5cf6',
                          border: `1px solid ${r.portal_type === 'central' ? '#3b82f644' : '#8b5cf644'}` }}>
                          {r.portal_type}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}><RiskBadge score={r.risk_score || 1} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '16px 0' }}>
              <button
                onClick={() => runSearch(page - 1)} disabled={page <= 1 || loading}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', cursor: page > 1 ? 'pointer' : 'not-allowed', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, opacity: page <= 1 ? 0.4 : 1 }}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Page {page} / {totalPages}</span>
              <button
                onClick={() => runSearch(page + 1)} disabled={page >= totalPages || loading}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', cursor: page < totalPages ? 'pointer' : 'not-allowed', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, opacity: page >= totalPages ? 0.4 : 1 }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {!searched && (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <AlertTriangle size={40} style={{ color: '#ef4444', opacity: 0.4, marginBottom: 16 }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 480, margin: '0 auto' }}>
            Select flags and filters above, then click <strong>Apply Filters</strong> to explore procurement red flags
            across 3.2M+ contract records. All results can be exported as CSV.
          </p>
        </div>
      )}
    </div>
  );
};

export default RedFlagExplorer;
