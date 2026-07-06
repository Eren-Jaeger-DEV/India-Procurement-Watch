import { useEffect, useState } from 'react';
import { fetchDepartmentBenchmarks } from '../lib/api';
import { Building2, Search, AlertTriangle, Download, RefreshCw, Award, Filter } from 'lucide-react';

const Departments = () => {
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('All');
  const [minSpend, setMinSpend] = useState('All');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDepartmentBenchmarks();
      setDepts(data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load department integrity benchmarks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const fmt = (n) => new Intl.NumberFormat('en-IN').format(n || 0);
  const fmtCr = (n) => n ? `₹${Number(n).toFixed(2)} Cr` : '—';

  const filteredDepts = depts.filter(d => {
    const matchQ = !query || d.org_name.toLowerCase().includes(query.toLowerCase());
    const matchGrade = gradeFilter === 'All' || d.grade === gradeFilter;
    const matchSpend = minSpend === 'All' 
      ? true 
      : minSpend === '100' ? (d.total_value_crore >= 100)
      : minSpend === '500' ? (d.total_value_crore >= 500)
      : (d.total_value_crore >= 1000);
    return matchQ && matchGrade && matchSpend;
  });

  const exportCSV = () => {
    if (!filteredDepts.length) return;
    const cols = ['org_name', 'grade', 'total_contracts', 'total_value_crore', 'single_bid_pct', 'hhi_score', 'ml_risk_score'];
    const header = cols.join(',');
    const rows = filteredDepts.map(d => cols.map(c => `"${String(d[c] ?? '').replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'department_integrity_leaderboard.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <RefreshCw size={36} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)', marginBottom: 16 }} />
        <p style={{ color: 'var(--text-secondary)' }}>Benchmarking 4,788 government departments…</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div className="card" style={{ maxWidth: 500, textAlign: 'center', padding: 32, borderLeft: '4px solid #ef4444' }}>
        <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: 12 }}>{error}</p>
        <button onClick={loadData} style={{ padding: '8px 20px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>Try Again</button>
      </div>
    </div>
  );

  return (
    <div className="dashboard-page">
      {/* Page Header */}
      <div className="page-header" style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={28} style={{ color: 'var(--accent-primary)' }} /> Department Integrity & Risk Leaderboard
          </h1>
          <p className="page-subtitle">Comparative benchmarking of 4,788 government departments across competition & single-bid metrics</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={exportCSV} style={{ padding: '7px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md, 8px)', fontWeight: 500, cursor: 'pointer' }}>
            <Download size={13} /> Export CSV
          </button>
          <button onClick={loadData} style={{ padding: '7px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: 500, cursor: 'pointer' }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            placeholder="Search department name (e.g. Railway, CPWD, AIIMS)…" 
            style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Risk Grade:</span>
          {['All', 'A', 'B', 'C', 'D', 'F'].map(g => (
            <button 
              key={g} 
              onClick={() => setGradeFilter(g)}
              style={{
                padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: '1px solid var(--border-color)',
                background: gradeFilter === g ? 'var(--accent-primary)' : 'transparent',
                color: gradeFilter === g ? 'white' : 'var(--text-secondary)'
              }}
            >
              {g}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Min Spend:</span>
          {[
            { label: 'All', val: 'All' },
            { label: '≥ ₹100 Cr', val: '100' },
            { label: '≥ ₹500 Cr', val: '500' },
            { label: '≥ ₹1,000 Cr', val: '1000' }
          ].map(s => (
            <button 
              key={s.val} 
              onClick={() => setMinSpend(s.val)}
              style={{
                padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: '1px solid var(--border-color)',
                background: minSpend === s.val ? 'var(--accent-primary)' : 'transparent',
                color: minSpend === s.val ? 'white' : 'var(--text-secondary)'
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border-color)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>Department Name</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Integrity Grade</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Contracts</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Value</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Single-Bid %</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>HHI Concentration</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>ML Risk Score</th>
            </tr>
          </thead>
          <tbody>
            {filteredDepts.length === 0 ? (
              <tr><td colSpan="7" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No departments found matching filter criteria.</td></tr>
            ) : filteredDepts.map((d, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{d.org_name}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <span style={{ 
                    padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                    background: d.grade === 'F' ? '#ef444422' : d.grade === 'D' ? '#f9731622' : d.grade === 'C' ? '#eab30822' : '#10b98122',
                    color: d.grade === 'F' ? '#ef4444' : d.grade === 'D' ? '#f97316' : d.grade === 'C' ? '#d97706' : '#10b981',
                    border: '1px solid currentColor'
                  }}>
                    Grade {d.grade}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{fmt(d.total_contracts)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{fmtCr(d.total_value_crore)}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: d.single_bid_pct > 25 ? '#ef4444' : 'var(--text-primary)' }}>{d.single_bid_pct}%</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{d.hhi_score}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: d.ml_risk_score > 70 ? '#ef4444' : 'var(--text-secondary)' }}>{d.ml_risk_score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Departments;
