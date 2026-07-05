import { useState } from 'react';
import { searchDatabase, aiChat } from '../lib/api';
import { Search as SearchIcon, MessageSquare, Loader2, Sparkles } from 'lucide-react';
import './Search.css';

const Search = () => {
  const [smartQuery, setSmartQuery] = useState('');
  const [tradQuery, setTradQuery] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterPortal, setFilterPortal] = useState('');
  
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [chatResponse, setChatResponse] = useState('');
  const [page, setPage] = useState(1);

  const handleSmartSearch = async (e) => {
    e?.preventDefault();
    if (!smartQuery.trim()) return;

    setIsSearching(true);
    setSearchResults(null);
    setChatResponse('');
    setPage(1);

    try {
      const [searchData, chatData] = await Promise.all([
        searchDatabase(smartQuery, 1), // Pass smart query as Q, backend usually parses it
        aiChat(smartQuery)
      ]);
      setSearchResults(searchData);
      setChatResponse(chatData.response);
    } catch (error) {
      console.error(error);
      setChatResponse("Sorry, I encountered an error while processing your request.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleTradSearch = async (e, p = 1) => {
    e?.preventDefault();
    setIsSearching(true);
    setChatResponse(''); // Traditional search doesn't trigger AI
    setPage(p);

    try {
      // If the backend search supports year/portal filters, we'd pass them here. 
      // For now, we pass the query and page.
      const data = await searchDatabase(`${tradQuery} ${filterYear} ${filterPortal}`.trim(), p);
      setSearchResults(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="dashboard-page search-page">
      <div className="page-header">
        <h1 className="page-title">Search Tenders & Awards</h1>
        <p className="page-subtitle"><span className="status-dot ready" style={{ display: 'inline-block', marginRight: 6 }}></span> Full-text search ready</p>
      </div>

      <div className="card" style={{ marginBottom: 32 }}>
        <h4 style={{ marginBottom: 12, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={16} /> Smart Search (Beta)
        </h4>
        <form onSubmit={handleSmartSearch} className="search-form">
          <div className="search-input-wrapper" style={{ borderColor: 'var(--accent-primary)', boxShadow: '0 0 5px rgba(37, 99, 235, 0.2)' }}>
            <input 
              type="text" value={smartQuery} onChange={(e) => setSmartQuery(e.target.value)} 
              placeholder="e.g., 'Find me all railway contracts in 2023 for civil work'" 
              className="search-input"
            />
            <button type="submit" className="search-button" disabled={isSearching || !smartQuery.trim()} style={{ background: 'var(--accent-primary)' }}>
              {isSearching && chatResponse === '' ? <Loader2 size={18} className="spin" /> : 'Ask AI'}
            </button>
          </div>
        </form>

        <hr style={{ margin: '24px 0', borderTop: '1px solid var(--border-color)' }} />

        <h4 style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>Traditional Search</h4>
        <form onSubmit={(e) => handleTradSearch(e, 1)} className="search-form">
          <div className="search-input-wrapper" style={{ marginBottom: 12 }}>
            <SearchIcon size={20} className="search-icon" />
            <input 
              type="text" value={tradQuery} onChange={(e) => setTradQuery(e.target.value)} 
              placeholder="Search by title, organisation, tender ID…" 
              className="search-input"
            />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <select className="search-input" style={{ border: '1px solid var(--border-color)', padding: '8px 12px', flex: 1 }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="">All Years</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
              <option value="2022">2022</option>
            </select>
            <select className="search-input" style={{ border: '1px solid var(--border-color)', padding: '8px 12px', flex: 1 }} value={filterPortal} onChange={e => setFilterPortal(e.target.value)}>
              <option value="">All Portals</option>
              <option value="central">Central</option>
              <option value="state">State</option>
            </select>
            <button type="submit" className="search-button" disabled={isSearching} style={{ padding: '8px 24px' }}>
              Search
            </button>
          </div>
        </form>
      </div>

      {isSearching && !searchResults && (
        <div className="loading-state">
          <Loader2 size={32} className="spin text-primary" />
          <p>Analyzing records...</p>
        </div>
      )}

      {!isSearching && chatResponse && (
        <div className="card ai-response-card" style={{ marginBottom: 24, borderLeft: '4px solid var(--accent-primary)' }}>
          <div className="card-header ai-header">
            <MessageSquare size={20} className="text-primary" />
            <div className="card-title">Amogh AI Analysis</div>
          </div>
          <div className="ai-content">{chatResponse}</div>
        </div>
      )}

      {searchResults && (
        <div className="card table-card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title">Search Results ({searchResults.total} found)</div>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Organisation</th>
                  <th>Title</th>
                  <th>Value</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.results?.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: 24 }}>No results found.</td></tr>
                ) : searchResults.results?.map((item, idx) => (
                  <tr key={idx} className="hover-row" style={{ cursor: 'pointer' }} onClick={() => window.dispatchEvent(new CustomEvent('openTenderModal', { detail: item }))}>
                    <td className="truncate-cell">{item.org_name}</td>
                    <td className="truncate-cell" title={item.tender_title}>{item.tender_title}</td>
                    <td>{item.value_lakh ? `₹${item.value_lakh}L` : 'N/A'}</td>
                    <td>{item.published_date || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 16, gap: 8, borderTop: '1px solid var(--border-color)' }}>
            <button disabled={page === 1} onClick={(e) => handleTradSearch(e, page - 1)} className="search-button" style={{ padding: '4px 12px', fontSize: 12 }}>Prev</button>
            <button disabled={!searchResults.results || searchResults.results.length < 50} onClick={(e) => handleTradSearch(e, page + 1)} className="search-button" style={{ padding: '4px 12px', fontSize: 12 }}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Search;
