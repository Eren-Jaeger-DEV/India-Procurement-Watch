import { useState, useEffect, useCallback } from 'react';
import { searchDatabase, streamAiChat } from '../lib/api';
import { Search as SearchIcon, MessageSquare, Loader2, Sparkles, Filter, AlertTriangle, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import './Search.css';

const YEAR_OPTIONS = ['All', 2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];

const Search = () => {
  const [query,        setQuery]        = useState('');
  const [year,         setYear]         = useState('All');
  const [portal,       setPortal]       = useState('All');
  const [singleBid,    setSingleBid]    = useState(false);
  const [page,         setPage]         = useState(1);

  const [searchResults, setSearchResults] = useState(null);
  const [isSearching,  setIsSearching]  = useState(false);
  const [aiAnswer,     setAiAnswer]     = useState('');
  const [aiLoading,    setAiLoading]    = useState(false);

  const runSearch = useCallback(async (pageNum = 1) => {
    setIsSearching(true);
    try {
      const data = await searchDatabase({
        q: query.trim(),
        year: year !== 'All' ? year : '',
        portal: portal !== 'All' ? portal : '',
        single_bid: singleBid ? '1' : '',
        page: pageNum
      });
      setSearchResults(data);
      setPage(pageNum);
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setIsSearching(false);
    }
  }, [query, year, portal, singleBid]);

  // Execute initial search on mount
  useEffect(() => {
    runSearch(1);
  }, [runSearch]);

  const handleAiAsk = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setAiAnswer('');
    setAiLoading(true);

    await streamAiChat(
      query,
      'deepseek-v4-pro',
      (payload) => {
        if (payload.type === 'text' || payload.type === 'summary_chunk') {
          setAiAnswer(prev => prev + payload.content);
        }
      },
      () => setAiLoading(false),
      () => setAiLoading(false)
    );
    setAiLoading(false);
  };

  const handleInspect = (item) => {
    window.dispatchEvent(new CustomEvent('openTenderModal', { detail: item }));
  };

  const total = searchResults?.total || 0;
  const totalPages = Math.ceil(total / 25) || 1;

  return (
    <div className="dashboard-page search-page">
      <div className="page-header" style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: 16, marginBottom: 24 }}>
        <h1 className="page-title">4.9M Tender Search & Inspector</h1>
        <p className="page-subtitle">Full-text instant search across 4,921,960 government procurement awards</p>
      </div>

      {/* Main Search & Filters Card */}
      <div className="card" style={{ marginBottom: 24, padding: 20 }}>
        <form onSubmit={(e) => { e.preventDefault(); runSearch(1); }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <SearchIcon size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                value={query} 
                onChange={(e) => setQuery(e.target.value)} 
                placeholder="Search by tender title, department, reference number, or vendor name…" 
                className="search-input"
                style={{ width: '100%', padding: '10px 14px 10px 42px', borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <button type="submit" className="search-button" disabled={isSearching} style={{ padding: '10px 24px', fontSize: 14, fontWeight: 600, background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              {isSearching ? <Loader2 size={16} className="spin" /> : 'Search'}
            </button>
            <button type="button" onClick={handleAiAsk} disabled={aiLoading || !query.trim()} style={{ padding: '10px 18px', fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} /> {aiLoading ? 'Thinking…' : 'Ask AI'}
            </button>
          </div>

          {/* Multi-facet Filter Bar */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Year:</span>
              <select value={year} onChange={(e) => setYear(e.target.value)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 12 }}>
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Portal:</span>
              <select value={portal} onChange={(e) => setPortal(e.target.value)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 12 }}>
                <option value="All">All Portals</option>
                <option value="central">Central Portal</option>
                <option value="state">State Portal</option>
              </select>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: singleBid ? '#ef4444' : 'var(--text-secondary)', cursor: 'pointer', marginLeft: 8 }}>
              <input type="checkbox" checked={singleBid} onChange={(e) => setSingleBid(e.target.checked)} />
              <AlertTriangle size={14} style={{ color: '#ef4444' }} /> Single-Bid Contracts Only
            </label>

            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
              Showing <strong style={{ color: 'var(--text-primary)' }}>{total.toLocaleString('en-IN')}</strong> matching records
            </div>
          </div>
        </form>
      </div>

      {/* AI Answer Card */}
      {aiAnswer && (
        <div className="card ai-response-card" style={{ marginBottom: 24, borderLeft: '4px solid #8b5cf6', background: 'rgba(139, 92, 246, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#8b5cf6', marginBottom: 8, fontSize: 14 }}>
            <Sparkles size={18} /> Darshi AI Insights
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)' }}>{aiAnswer}</div>
        </div>
      )}

      {/* Results Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
            Tender Index ({total.toLocaleString('en-IN')} found)
          </h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
            <button disabled={page <= 1} onClick={() => runSearch(page - 1)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>
              <ChevronLeft size={14} />
            </button>
            <button disabled={page >= totalPages} onClick={() => runSearch(page + 1)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {isSearching ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="spin" style={{ marginBottom: 8 }} />
            <div>Searching database…</div>
          </div>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Procuring Department</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Tender Title</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Contract Value / Winner</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Portal / Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {searchResults?.results?.length === 0 ? (
                <tr><td colSpan="5" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No contracts found matching query.</td></tr>
              ) : searchResults?.results?.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => handleInspect(item)}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.org_name}
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
                    {item.title}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                    {item.contract_value ? (
                      <span style={{ color: '#10b981', fontWeight: 700 }}>₹{(item.contract_value / 1e7).toFixed(2)} Cr</span>
                    ) : item.bidder_name ? (
                      <span style={{ color: '#8b5cf6' }}>{item.bidder_name}</span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-main)', border: '1px solid var(--border-color)', textTransform: 'uppercase', marginRight: 6 }}>
                      {item.portal_type || 'CPP'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.aoc_date || item.year || '—'}</span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleInspect(item); }} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--accent-primary)', color: 'white', cursor: 'pointer', border: 'none' }}>
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Search;
