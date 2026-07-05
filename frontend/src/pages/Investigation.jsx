import { useEffect, useState } from 'react';
import { fetchSingleBidContracts, fetchRepeatWinners } from '../lib/api';
import { Download, AlertCircle, Info, FileText } from 'lucide-react';
import './Search.css';

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
    alert(`Downloading ${type}.csv (Placeholder)`);
  };

  const formatNumber = (num) => new Intl.NumberFormat('en-IN').format(num || 0);

  // Determine Severity Badge for Single Bids
  const getSeverityBadge = (value) => {
    if (!value) return <span className="badge-info">INFO</span>;
    if (value > 50000000) return <span className="badge-critical">CRITICAL</span>; // > 5 Cr
    if (value > 10000000) return <span className="badge-high">HIGH</span>; // > 1 Cr
    return <span className="badge-medium">MEDIUM</span>;
  };

  return (
    <div className="dashboard-page search-page" style={{ maxWidth: '1200px' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1 className="page-title">Investigation Desk</h1>
        <p className="page-subtitle">Deep dive into anomalies, monopolies, and suspicious procurement patterns flagged by the ML engine</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
        <button 
          onClick={() => setActiveTab('single')}
          className="search-button"
          style={{ 
            background: activeTab === 'single' ? 'var(--accent-primary)' : 'transparent', 
            color: activeTab === 'single' ? '#ffffff' : 'var(--text-secondary)', 
            border: '1px solid var(--border-color)' 
          }}
        >
          Single-Bid Contracts
        </button>
        <button 
          onClick={() => setActiveTab('repeat')}
          className="search-button"
          style={{ 
            background: activeTab === 'repeat' ? 'var(--accent-primary)' : 'transparent', 
            color: activeTab === 'repeat' ? '#ffffff' : 'var(--text-secondary)', 
            border: '1px solid var(--border-color)' 
          }}
        >
          Repeat Winners & Cartels
        </button>
      </div>

      {activeTab === 'single' && (
        <>
          {/* NORMIE EXPLAINER BLOCK */}
          <div style={{ marginBottom: 24, padding: 20, background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 8, display: 'flex', gap: 16 }}>
            <Info size={28} color="#3b82f6" style={{ flexShrink: 0, marginTop: 4 }} />
            <div>
              <h4 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '15px' }}>What does "Single-Bid" mean?</h4>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                A <strong>Single-Bid contract</strong> happens when only one company participates in a government tender. In a healthy, competitive market, many companies should bid to lower the price for taxpayers. When a multi-crore contract constantly goes to a single bidder, it is a high-risk indicator that the tender requirements were <em>tailored</em> to favor one specific company (locking out competitors).
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="status-dot ready" style={{ background: '#f59e0b' }}></span> ML Flagged: Single-Bids
                </h3>
                <p className="card-subtitle">High-value contracts lacking market competition</p>
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
                    <th>Severity</th>
                    <th>Organisation</th>
                    <th>Tender Title</th>
                    <th>Value</th>
                    <th>Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {singleLoading ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: 24 }}>Running Anomaly Scan...</td></tr>
                  ) : singleData.results.map((item, idx) => (
                    <tr key={idx} style={{ cursor: 'pointer' }} className="hover-row" onClick={() => window.dispatchEvent(new CustomEvent('openTenderModal', { detail: item }))}>
                      <td>{getSeverityBadge(item.contract_value)}</td>
                      <td className="truncate-cell">{item.org_name}</td>
                      <td className="truncate-cell" title={item.title}>{item.title}</td>
                      <td>{item.contract_value ? `₹${(item.contract_value / 100000).toFixed(2)}L` : 'N/A'}</td>
                      <td className="truncate-cell"><strong>{item.bidder_name || 'N/A'}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 16, borderTop: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Found {formatNumber(singleData.total)} isolated records</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={singlePage === 1} onClick={() => setSinglePage(p => p - 1)} className="search-button" style={{ padding: '4px 12px', fontSize: 12 }}>Prev</button>
                <button disabled={singleData.results.length < 50} onClick={() => setSinglePage(p => p + 1)} className="search-button" style={{ padding: '4px 12px', fontSize: 12 }}>Next</button>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'repeat' && (
        <>
          {/* NORMIE EXPLAINER BLOCK */}
          <div style={{ marginBottom: 24, padding: 20, background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: 8, display: 'flex', gap: 16 }}>
            <FileText size={28} color="#8b5cf6" style={{ flexShrink: 0, marginTop: 4 }} />
            <div>
              <h4 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '15px' }}>Why track Repeat Winners?</h4>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                When a single vendor wins dozens of contracts from the exact same department over a short period, it forms a monopoly. Our <strong>Cartel Detection Engine (Union-Find Graph Algorithm)</strong> flags these vendors. In many cases, these "repeat winners" coordinate with dummy companies to simulate competition, ensuring the same corporate network always wins the bid.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="status-dot ready" style={{ background: '#8b5cf6' }}></span> Cartel & Monopoly Suspects
                </h3>
                <p className="card-subtitle">Vendors flagged for dominating specific departments</p>
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
                    <th>Dominated Organisation</th>
                    <th>Monopoly Wins</th>
                    <th>Total Extracted Value (Cr)</th>
                  </tr>
                </thead>
                <tbody>
                  {repeatLoading ? (
                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: 24 }}>Graphing Cartel Networks...</td></tr>
                  ) : repeatData.results.map((item, idx) => (
                    <tr key={idx} style={{ cursor: 'pointer' }} className="hover-row">
                      <td className="truncate-cell" title={item.bidder_name}><strong>{item.bidder_name}</strong></td>
                      <td className="truncate-cell" title={item.org_name}>{item.org_name}</td>
                      <td><span style={{ fontWeight: 'bold', color: '#8b5cf6' }}>{item.wins}</span></td>
                      <td>₹{item.total_value_crore?.toFixed(2) || '0.00'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 16, borderTop: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Found {formatNumber(repeatData.total)} high-frequency bidders</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={repeatPage === 1} onClick={() => setRepeatPage(p => p - 1)} className="search-button" style={{ padding: '4px 12px', fontSize: 12 }}>Prev</button>
                <button disabled={repeatData.results.length < 50} onClick={() => setRepeatPage(p => p + 1)} className="search-button" style={{ padding: '4px 12px', fontSize: 12 }}>Next</button>
              </div>
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: 24, padding: 16, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <strong>Disclaimer:</strong> The algorithmic flags and anomalies shown above are automatically generated from public procurement data by Machine Learning models. They indicate statistical deviations but do not constitute proof of corruption or illegal activity. All findings should be independently verified before being published or used in RTI applications.
        </div>
      </div>
    </div>
  );
};

export default Investigation;
