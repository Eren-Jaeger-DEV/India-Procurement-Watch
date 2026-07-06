import { useEffect, useState, useRef } from 'react';
import { searchNetwork, fetchNetworkEgo, fetchVendorMca } from '../lib/api';
import { Network as VisNetwork } from 'vis-network';
import { Search, Loader2, Camera } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import './Search.css'; // Reusing input styles

const NetworkGraph = () => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [egoData, setEgoData] = useState(null);
  const [mcaData, setMcaData] = useState(null);
  const [loadingEgo, setLoadingEgo] = useState(false);
  const [loadingMca, setLoadingMca] = useState(false);
  const [error, setError] = useState(null);

  const containerRef = useRef(null);
  const networkInstance = useRef(null);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    try {
      const data = await searchNetwork(query);
      if (data && data.results) setSearchResults(data.results);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const loadEntity = async (nodeId, label, kind) => {
    setLoadingEgo(true);
    setError(null);
    setEgoData(null);
    setMcaData(null);

    try {
      const data = await fetchNetworkEgo(nodeId);
      if (data.error) throw new Error(data.error);
      setEgoData({ ...data, label, kind });
      
      if (kind === 'vendor' || kind === 'company' || (data.focus && data.nodes.find(n => n.id === data.focus)?.kind === 'company')) {
        setLoadingMca(true);
        try {
          const mcaRes = await fetchVendorMca(label);
          if (mcaRes && mcaRes.match) setMcaData(mcaRes.match);
        } catch (e) {
          console.error("MCA fetch failed", e);
        } finally {
          setLoadingMca(false);
        }
      }
    } catch (e) {
      console.error(e);
      setError(e.message || 'Failed to load network neighborhood.');
    } finally {
      setLoadingEgo(false);
    }
  };

  useEffect(() => {
    if (!egoData || !containerRef.current) return;

    const rawNodes = egoData.nodes || [];
    const rawEdges = egoData.edges || [];
    const focusId = egoData.focus;

    const fmtNetValue = (n) => {
      if (n == null) return '—';
      if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K Cr`;
      return `₹${Number(n).toFixed(1)} Cr`;
    };

    const nodes = rawNodes.map(n => {
      const isFocus = n.id === focusId;
      let color = '#6366f1';
      let shape = 'dot';
      let size = 16;
      
      if (isFocus) { color = '#f97316'; size = 26; }
      else if (n.kind === 'buyer') { color = '#06b6d4'; shape = 'triangle'; size = 18; }
      else if (n.kind === 'tender') { color = '#a855f7'; shape = 'square'; size = 12; }

      let cleanLabel = n.label;
      if (cleanLabel.length > 20) cleanLabel = cleanLabel.substring(0, 18) + '…';

      return {
        id: n.id,
        label: cleanLabel,
        title: `${n.label}\nKind: ${n.kind}\nContracts: ${n.n_contracts || 0}\nValue: ${fmtNetValue(n.value)}`,
        color: {
          background: color,
          border: isFocus ? '#fb923c' : 'rgba(255,255,255,0.15)',
          highlight: { background: '#f97316', border: '#ff9800' }
        },
        font: { color: '#e8eaf0', size: isFocus ? 13 : 11, face: 'Inter' },
        size, shape, borderWidth: isFocus ? 2 : 1
      };
    });

    const edges = rawEdges.map(e => {
      let color = 'rgba(255,255,255,0.12)';
      let width = 1.5;
      if (e.relationship === 'SHARES_EMAIL') { color = '#f87171'; width = 2; }
      else if (e.relationship === 'SHARES_ADDRESS') { color = '#ef4444'; width = 2.5; }
      else if (e.relationship === 'CO_BIDDER') { color = '#38bdf8'; width = 1.5; }

      return {
        from: e.source, to: e.target, label: e.relationship,
        title: `${e.label || e.relationship}\nWeight: ${e.weight}`,
        color: { color, highlight: '#f97316' },
        width, font: { color: '#94a3b8', size: 9, align: 'middle' },
        arrows: e.relationship === 'AWARDED' ? { to: { enabled: true, scaleFactor: 0.5 } } : undefined,
        smooth: { type: 'continuous', roundness: 0.2 }
      };
    });

    const data = { nodes, edges };
    const options = {
      physics: {
        solver: 'forceAtlas2Based',
        forceAtlas2Based: { gravitationalConstant: -50, centralGravity: 0.01, springLength: 100, springConstant: 0.08 },
        stabilization: { iterations: 120, updateInterval: 25 }
      },
      interaction: { hover: true, tooltipDelay: 100, zoomView: true, dragView: true }
    };

    if (networkInstance.current) networkInstance.current.destroy();
    networkInstance.current = new VisNetwork(containerRef.current, data, options);

    networkInstance.current.on("doubleClick", function (params) {
      if (params.nodes.length > 0) {
        const clickedNodeId = params.nodes[0];
        const matchingNode = rawNodes.find(n => n.id === clickedNodeId);
        if (matchingNode) {
          loadEntity(matchingNode.id, matchingNode.label, matchingNode.kind);
        }
      }
    });

    return () => { if (networkInstance.current) networkInstance.current.destroy(); };
  }, [egoData]);

  const handleExport = () => {
    if (!containerRef.current) return;
    const canvas = containerRef.current.querySelector('canvas');
    if (!canvas) return;
    
    const wrapper = document.createElement('div');
    wrapper.style.padding = '20px';
    wrapper.innerHTML = `<h2>India Procurement Watch - Director Network Ego-Graph</h2><p style="color:#666">Generated on: ${new Date().toLocaleString()}</p><hr style="margin-bottom:20px">`;
    
    const img = document.createElement('img');
    img.src = canvas.toDataURL('image/png');
    img.style.width = '100%';
    img.style.height = 'auto';
    img.style.border = '1px solid #ccc';
    wrapper.appendChild(img);

    html2pdf().set({
      margin: 10, filename: 'Director_Network_Graph.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(wrapper).save();
  };

  const focusNode = egoData?.nodes?.find(n => n.id === egoData.focus);

  return (
    <div className="dashboard-page search-page" style={{ maxWidth: '1400px' }}>
      <div className="page-header">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="status-dot ready" style={{ background: '#0ea5e9' }}></span> Company & Director Networks
        </h1>
        <p className="page-subtitle">Explore connections between buyers, bidders, and shared physical locations</p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-wrapper">
            <Search size={20} className="search-icon" />
            <input 
              type="text" 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
              placeholder="Search registered company, email, buyer name, or DIN/CIN..." 
              className="search-input"
            />
            <button type="submit" className="search-button" disabled={isSearching || !query.trim()}>
              {isSearching ? <Loader2 size={18} className="spin" /> : 'Find Connections'}
            </button>
          </div>
        </form>
        
        {searchResults.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-color)', maxHeight: 200, overflowY: 'auto' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Select an entity to render its neighborhood graph:</p>
            {searchResults.map(r => (
              <div 
                key={r.id}
                onClick={() => loadEntity(r.id, r.label, r.kind)}
                style={{ padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: 6, cursor: 'pointer', background: egoData?.focus === r.id ? 'var(--bg-main)' : 'transparent' }}
                className="hover-row"
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {r.kind === 'company' ? 'Company (CIN matched)' : 'Department / Buyer'} ({r.state || 'Unknown'})
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loadingEgo ? (
        <div className="loading-state">Loading neighborhood graph...</div>
      ) : error ? (
        <div className="loading-state" style={{ color: 'var(--critical)' }}>{error}</div>
      ) : egoData && focusNode ? (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card-header"><h3 className="card-title">Entity Profile</h3></div>
            <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{focusNode.label}</div>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: focusNode.kind === 'company' ? '#2563eb' : '#059669', color: 'white', textTransform: 'uppercase' }}>
                  {focusNode.kind}
                </span>
              </div>
              
              {focusNode.kind === 'company' && (
                <>
                  <div><div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>CIN</div><div style={{ fontFamily: 'monospace' }}>{focusNode.id.replace('C:', '')}</div></div>
                  <div><div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Registered State</div><div>{focusNode.state || 'Unknown'}</div></div>
                  <div><div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Email</div><div style={{ color: 'var(--accent-primary)', wordBreak: 'break-all' }}>{focusNode.email || 'N/A'}</div></div>
                  <div><div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Contracts Won</div><div>{focusNode.n_contracts || 0}</div></div>
                </>
              )}
              {focusNode.kind !== 'company' && (
                <>
                  <div><div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Region</div><div>{focusNode.state || 'Central/State'}</div></div>
                  <div><div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Contracts Awarded</div><div>{focusNode.n_contracts || 0}</div></div>
                </>
              )}

              {loadingMca ? (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Searching MCA records...</div>
              ) : mcaData ? (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>MCA Corporate Identity</div>
                  <div><div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Official Name</div><div style={{ fontWeight: 600 }}>{mcaData.CompanyName}</div></div>
                  <div style={{ marginTop: 8 }}><div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Status</div><div>{mcaData.CompanyStatus}</div></div>
                  <div style={{ marginTop: 8 }}><div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Paid-up Capital</div><div>₹ {Number(mcaData.PaidupCapital).toLocaleString('en-IN')}</div></div>
                </div>
              ) : (focusNode.kind === 'company' || focusNode.kind === 'vendor') && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>No confident MCA record found.</div>
              )}
            </div>
          </div>

          <div className="card" style={{ height: 750, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="card-title">Neighborhood Ego-Graph (1-Hop)</h3>
                <p className="card-subtitle">Drag nodes to rearrange, hover for tooltips</p>
              </div>
              <button onClick={handleExport} className="search-button" style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-primary)', padding: '6px 12px', fontSize: 12 }}>
                <Camera size={14} style={{ marginRight: 6 }} /> Snapshot Graph
              </button>
            </div>
            <div ref={containerRef} style={{ flex: 1, background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}></div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '64px 0', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌐</div>
          <h3>Graph Viewer</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Search a contractor, department, or registration email address above to view their connections.</p>
        </div>
      )}
    </div>
  );
};

export default NetworkGraph;
