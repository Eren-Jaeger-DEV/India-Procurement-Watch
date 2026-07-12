import { useEffect, useState } from 'react';
import { fetchCollusionRadar } from '../lib/api';
import { ShieldAlert, Users, Building2, AlertTriangle, RefreshCw, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Collusion = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  const loadCollusionData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCollusionRadar();
      setData(res);
    } catch (err) {
      console.error(err);
      setError("Failed to load Network Radar data. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCollusionData();
  }, []);

  const fmtCr = (n) => n ? `₹${Number(n).toFixed(2)} Cr` : '-';

  const filteredDepts = (data?.suspicious_departments || []).filter(d => 
    !filter || d.org_name.toLowerCase().includes(filter.toLowerCase())
  );

  const filteredPairs = (data?.co_winning_pairs || []).filter(p => 
    !filter || p.org_name.toLowerCase().includes(filter.toLowerCase()) ||
    p.vendor_a.toLowerCase().includes(filter.toLowerCase()) ||
    p.vendor_b.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <RefreshCw size={36} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)', marginBottom: 16 }} />
        <p style={{ color: 'var(--text-secondary)' }}>Scanning database for frequent bidding networks and co-winning pairs…</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div className="card" style={{ maxWidth: 500, textAlign: 'center', padding: 32, borderLeft: '4px solid #ef4444' }}>
        <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: 12 }}>{error}</p>
        <button onClick={loadCollusionData} style={{ padding: '8px 20px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>Try Again</button>
      </div>
    </div>
  );

  return (
    <div className="dashboard-page">
      {/* Page Header */}
      <div className="page-header" style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldAlert size={28} style={{ color: '#ef4444' }} /> Co-Bidding Network Analysis
          </h1>
          <p className="page-subtitle">Algorithmic identification of frequent co-bidding networks and market-sharing vendor pairs</p>
        </div>
        <button onClick={loadCollusionData} style={{ padding: '7px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: 500, cursor: 'pointer' }}>
          <RefreshCw size={13} /> Re-scan Database
        </button>
      </div>

      {/* Filter bar */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center' }}>
        <input 
          type="text" 
          value={filter} 
          onChange={(e) => setFilter(e.target.value)} 
          placeholder="Filter by organization or vendor name…" 
          style={{ width: '100%', maxWidth: 450, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
        />
        {filter && (
          <button onClick={() => setFilter('')} style={{ padding: '4px 10px', fontSize: 12, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Clear</button>
        )}
      </div>

      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Users size={20} style={{ color: '#8b5cf6' }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Top Co-Winning Vendor Networks</h2>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Procuring Department</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Vendor A</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Vendor B</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Combined Wins</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Combined Value</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPairs.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No co-winning vendor pairs found matching filter.</td></tr>
              ) : filteredPairs.map((p, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{p.org_name}</td>
                  <td style={{ padding: '12px 16px', color: '#8b5cf6', fontWeight: 600 }}>{p.vendor_a}</td>
                  <td style={{ padding: '12px 16px', color: '#2563eb', fontWeight: 600 }}>{p.vendor_b}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{p.combined_wins} awards</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{fmtCr(p.combined_value_cr)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button 
                      onClick={() => navigate(`/network?q=${encodeURIComponent(p.vendor_a)}`)}
                      style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--accent-primary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      Inspect Network <ChevronRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid 2: Concentrated Risk Departments */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Building2 size={20} style={{ color: '#f59e0b' }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>High-Risk Market Concentrated Departments</h2>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Department Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Risk Grade</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Top Vendors</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Network Wins</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Network Value</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Single-Bid %</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>HHI Score</th>
              </tr>
            </thead>
            <tbody>
              {filteredDepts.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No departments found matching filter.</td></tr>
              ) : filteredDepts.map((d, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{d.org_name}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{ 
                      padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                      background: d.risk_grade === 'F' ? '#ef444422' : d.risk_grade === 'D' ? '#f9731622' : '#eab30822',
                      color: d.risk_grade === 'F' ? '#ef4444' : d.risk_grade === 'D' ? '#f97316' : '#d97706',
                      border: '1px solid currentColor'
                    }}>
                      Grade {d.risk_grade}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{d.top_vendors}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{d.syndicate_wins}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{fmtCr(d.syndicate_val_cr)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: d.single_bid_pct > 25 ? '#ef4444' : 'var(--text-primary)' }}>{d.single_bid_pct}%</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{d.hhi_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Collusion;
