import { useEffect, useState } from 'react';
import { fetchSingleBidContracts, fetchRepeatWinners } from '../lib/api';
import { Download, Search, AlertCircle } from 'lucide-react';
import './Search.css'; // Reuse table styles

const Investigation = () => {
  const [activeTab, setActiveTab] = useState('single');
  
  // Single Bid State
  const [singleValFilter, setSingleValFilter] = useState(1000000);
  const [singlePage, setSinglePage] = useState(1);
  const [singleData, setSingleData] = useState({ results: [], total: 0 });
  const [singleLoading, setSingleLoading] = useState(true);

  // Repeat Winners State
  const [repeatWinFilter, setRepeatWinFilter] = useState(3);
  const [repeatPage, setRepeatPage] = useState(1);
  const [repeatData, setRepeatData] = useState({ results: [], total: 0 });
  const [repeatLoading, setRepeatLoading] = useState(true);

  useEffect(() => {
    if (activeTab === 'single') {
      const loadSingle = async () => {
        setSingleLoading(true);
        try {
          const data = await fetchSingleBidContracts(singleValFilter, singlePage);
          setSingleData(data);
        } catch (e) {
          console.error(e);
        } finally {
          setSingleLoading(false);
        }
      };
      loadSingle();
    } else {
      const loadRepeat = async () => {
        setRepeatLoading(true);
        try {
          const data = await fetchRepeatWinners(repeatWinFilter, repeatPage);
          setRepeatData(data);
        } catch (e) {
          console.error(e);
        } finally {
          setRepeatLoading(false);
        }
      };
      loadRepeat();
    }
  }, [activeTab, singleValFilter, singlePage, repeatWinFilter, repeatPage]);

  const exportCSV = (type) => {
    // In a full implementation, this would generate and download a CSV string
    alert(`Downloading ${type}.csv (Placeholder)`);
  };

  const formatNumber = (num) => new Intl.NumberFormat('en-IN').format(num || 0);

  return (
    <div className="dashboard-page search-page" style={{ maxWidth: '1200px' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1 className="page-title">Investigation Desk</h1>
        <p className="page-subtitle">Identify anomalies, monopolies, and suspicious procurement patterns</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
        <button 
          onClick={() => setActiveTab('single')}
          className={`search-button ${activeTab === 'single' ? '' : 'inactive'}`}
          style={{ background: activeTab === 'single' ? 'var(--text-primary)' : 'var(--bg-card)', color: activeTab === 'single' ? 'white' : 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
        >
          Single-Bid Contracts
        </button>
        <button 
          onClick={() => setActiveTab('repeat')}
          className={`search-button ${activeTab === 'repeat' ? '' : 'inactive'}`}
          style={{ background: activeTab === 'repeat' ? 'var(--text-primary)' : 'var(--bg-card)', color: activeTab === 'repeat' ? 'white' : 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
        >
          Repeat Winners
        </button>
      </div>

      {activeTab === 'single' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="status-dot ready" style={{ background: '#f59e0b' }}></span> Single-Bid Contracts
              </h3>
              <p className="card-subtitle">Contracts where only one bid was received</p>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <select className="search-input" style={{ border: '1px solid var(--border-color)', padding: '6px 12px' }} value={singleValFilter} onChange={(e) => { setSingleValFilter(Number(e.target.value)); setSinglePage(1); }}>
                <option value={1000000}>≥ ₹10 Lakh</option>
                <option value={10000000}>≥ ₹1 Crore</option>
                <option value={100000000}>≥ ₹10 Crore</option>
              </select>
              <button className="search-button" style={{ padding: '6px 12px', fontSize: 13, background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-primary)' }} onClick={() => exportCSV('single_bid')}>
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>
          
          <div className="table-responsive" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Organisation</th>
                  <th>Tender Title</th>
                  <th>Value</th>
                  <th>Date</th>
                  <th>Winner</th>
                </tr>
              </thead>
              <tbody>
                {singleLoading ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: 24 }}>Loading...</td></tr>
                ) : singleData.results.map((item, idx) => (
                  <tr key={idx} style={{ cursor: 'pointer' }} className="hover-row" onClick={() => window.dispatchEvent(new CustomEvent('openTenderModal', { detail: item }))}>
                    <td className="truncate-cell">{item.org_name}</td>
                    <td className="truncate-cell" title={item.tender_title}>{item.tender_title}</td>
                    <td>{item.value_lakh ? `₹${item.value_lakh}L` : 'N/A'}</td>
                    <td>{item.published_date || 'N/A'}</td>
                    <td className="truncate-cell"><strong>{item.vendor_name || 'N/A'}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 16, borderTop: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Found {formatNumber(singleData.total)} records</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={singlePage === 1} onClick={() => setSinglePage(p => p - 1)} className="search-button" style={{ padding: '4px 12px', fontSize: 12 }}>Prev</button>
              <button disabled={singleData.results.length < 50} onClick={() => setSinglePage(p => p + 1)} className="search-button" style={{ padding: '4px 12px', fontSize: 12 }}>Next</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'repeat' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="status-dot ready" style={{ background: '#8b5cf6' }}></span> Repeat Winners
              </h3>
              <p className="card-subtitle">Vendors who won multiple contracts from the same department</p>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <select className="search-input" style={{ border: '1px solid var(--border-color)', padding: '6px 12px' }} value={repeatWinFilter} onChange={(e) => { setRepeatWinFilter(Number(e.target.value)); setRepeatPage(1); }}>
                <option value={3}>≥ 3 Wins</option>
                <option value={10}>≥ 10 Wins</option>
                <option value={25}>≥ 25 Wins</option>
              </select>
            </div>
          </div>
          
          <div className="table-responsive" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vendor / Bidder</th>
                  <th>Organisation</th>
                  <th>Wins</th>
                  <th>Total Value (Cr)</th>
                </tr>
              </thead>
              <tbody>
                {repeatLoading ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: 24 }}>Loading...</td></tr>
                ) : repeatData.results.map((item, idx) => (
                  <tr key={idx} style={{ cursor: 'pointer' }} className="hover-row">
                    <td className="truncate-cell" title={item.vendor_name}><strong>{item.vendor_name}</strong></td>
                    <td className="truncate-cell" title={item.org_name}>{item.org_name}</td>
                    <td>{item.wins}</td>
                    <td>₹{item.total_value_cr?.toFixed(2) || '0.00'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 16, borderTop: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Found {formatNumber(repeatData.total)} records</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={repeatPage === 1} onClick={() => setRepeatPage(p => p - 1)} className="search-button" style={{ padding: '4px 12px', fontSize: 12 }}>Prev</button>
              <button disabled={repeatData.results.length < 50} onClick={() => setRepeatPage(p => p + 1)} className="search-button" style={{ padding: '4px 12px', fontSize: 12 }}>Next</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, padding: 16, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <strong>Disclaimer:</strong> The algorithmic flags and anomalies shown above are automatically generated from public procurement data. They indicate statistical deviations but do not constitute proof of corruption or illegal activity. All findings should be independently verified before being published or used in RTI applications.
        </div>
      </div>
    </div>
  );
};

export default Investigation;
