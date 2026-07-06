import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ZAxis
} from 'recharts';
import {
  BarChart, Bar, LineChart, Line
} from 'recharts';
import { TrendingUp, Users, Building2, Award, Search, AlertCircle } from 'lucide-react';
import './Insights.css';

const fmt   = (n) => new Intl.NumberFormat('en-IN').format(n || 0);
const fmtCr = (v) => v ? `₹${Number(v).toFixed(1)} Cr` : '—';

// ── Custom scatter tooltip ─────────────────────────────────────────────────────
const ScatterTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const hhiBand = d.hhi >= 2500 ? '🔴 High' : d.hhi >= 1500 ? '🟠 Moderate' : '🟢 Low';
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-color)',
      borderRadius: 10, padding: '12px 16px', fontSize: 12, maxWidth: 260,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
    }}>
      <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)', fontSize: 13 }}>
        {d.org?.length > 40 ? d.org.substring(0, 40) + '…' : d.org}
      </p>
      <p style={{ color: 'var(--text-secondary)', margin: '2px 0' }}>HHI: <strong>{fmt(Math.round(d.hhi))}</strong> — {hhiBand}</p>
      <p style={{ color: '#ef4444', margin: '2px 0' }}>Single-bid: <strong>{d.single_bid_pct}%</strong></p>
      <p style={{ color: 'var(--text-muted)', margin: '2px 0' }}>Awards: {fmt(d.total_awards)}</p>
      <p style={{ color: 'var(--text-muted)', margin: '2px 0' }}>Vendors: {d.n_vendors}</p>
    </div>
  );
};

// ── Insights page ──────────────────────────────────────────────────────────────
const Insights = () => {
  const [scatter,      setScatter]      = useState([]);
  const [scatterLoad,  setScatterLoad]  = useState(true);
  const [scatterErr,   setScatterErr]   = useState(null);
  const [portalFilter, setPortalFilter] = useState('All');
  const [minAwards,    setMinAwards]    = useState(50);

  // Vendor search
  const [vendorQ,     setVendorQ]     = useState('');
  const [vendorData,  setVendorData]  = useState(null);
  const [vendorLoad,  setVendorLoad]  = useState(false);
  const [vendorErr,   setVendorErr]   = useState(null);
  const debounceRef = useRef(null);

  // Load scatter data
  useEffect(() => {
    setScatterLoad(true); setScatterErr(null);
    fetch('/api/hhi-scatter')
      .then(r => r.json())
      .then(data => { setScatter(Array.isArray(data) ? data : []); })
      .catch(() => setScatterErr('Failed to load HHI data'))
      .finally(() => setScatterLoad(false));
  }, []);

  // Filtered scatter points
  const scatterFiltered = scatter.filter(d =>
    (portalFilter === 'All' || d.portal === portalFilter) &&
    d.total_awards >= minAwards
  );

  // Color by HHI band
  const dotColor = (hhi) =>
    hhi >= 2500 ? '#ef4444' : hhi >= 1500 ? '#f97316' : '#10b981';

  // Vendor search handler
  const searchVendor = useCallback(async (q) => {
    if (!q || q.length < 3) { setVendorData(null); return; }
    setVendorLoad(true); setVendorErr(null);
    try {
      const res  = await fetch(`/api/vendor-profile?name=${encodeURIComponent(q)}`);
      const data = await res.json();
      setVendorData(data);
    } catch {
      setVendorErr('Search failed');
    } finally {
      setVendorLoad(false);
    }
  }, []);

  const handleVendorChange = (e) => {
    const val = e.target.value;
    setVendorQ(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchVendor(val), 600);
  };

  const profile = vendorData?.profile;
  const matches = vendorData?.matches || [];

  return (
    <div className="insights-page">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: 16, marginBottom: 24 }}>
        <h1 className="page-title">Insights</h1>
        <p className="page-subtitle">Deep analytical views — concentration, competition, and vendor patterns</p>
      </div>

      {/* ══ SECTION 1: HHI Scatter ═══════════════════════════════════════════ */}
      <div className="insights-section-title">
        <TrendingUp size={18} style={{ color: 'var(--accent-primary)' }} />
        <div>
          <h2>Vendor Concentration vs Competition</h2>
          <p>Each dot is a government organization. <span style={{ color: '#ef4444' }}>Top-right</span> = highly concentrated & uncompetitive — worth investigating.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: 16, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Portal:</span>
          {['All', 'state', 'central'].map(p => (
            <button key={p} onClick={() => setPortalFilter(p)} style={{
              padding: '4px 12px', borderRadius: 16, fontSize: 12, cursor: 'pointer',
              border: '1.5px solid var(--border-color)', fontWeight: 500,
              background: portalFilter === p ? 'var(--accent-primary)' : 'transparent',
              color: portalFilter === p ? '#fff' : 'var(--text-secondary)',
            }}>{p === 'All' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Min awards:</span>
          {[30, 50, 100, 200].map(n => (
            <button key={n} onClick={() => setMinAwards(n)} style={{
              padding: '4px 12px', borderRadius: 16, fontSize: 12, cursor: 'pointer',
              border: '1.5px solid var(--border-color)', fontWeight: 500,
              background: minAwards === n ? 'var(--accent-primary)' : 'transparent',
              color: minAwards === n ? '#fff' : 'var(--text-secondary)',
            }}>{n}+</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          Showing <strong style={{ color: 'var(--text-primary)' }}>{scatterFiltered.length}</strong> organizations
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
          {[['#10b981','Low HHI (< 1500)'],['#f97316','Moderate (1500-2500)'],['#ef4444','High HHI (> 2500)']].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: c }} /> {l}
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 32, overflow: 'hidden' }}>
        {scatterLoad ? (
          <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Computing HHI for all organizations…
          </div>
        ) : scatterErr ? (
          <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: 13 }}>
            {scatterErr}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis
                type="number" dataKey="hhi" name="HHI"
                domain={[0, 10000]}
                label={{ value: 'HHI (vendor concentration →)', position: 'insideBottom', offset: -10, fill: 'var(--text-secondary)', fontSize: 12 }}
                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false}
              />
              <YAxis
                type="number" dataKey="single_bid_pct" name="Single-bid %"
                unit="%" domain={[0, 100]}
                label={{ value: 'Single-bid % ↑', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 12 }}
                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false}
              />
              <ZAxis type="number" dataKey="total_awards" range={[30, 600]} name="Awards" />
              <Tooltip content={<ScatterTip />} cursor={{ strokeDasharray: '3 3' }} />
              {/* Reference lines at HHI thresholds */}
              <ReferenceLine x={1500} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: 'Moderate', fill: '#f59e0b', fontSize: 10, position: 'top' }} />
              <ReferenceLine x={2500} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: 'High', fill: '#ef4444', fontSize: 10, position: 'top' }} />
              <Scatter
                data={scatterFiltered.map(d => ({ ...d, fill: dotColor(d.hhi) }))}
                fill="#8884d8"
                shape={(props) => {
                  const { cx, cy, fill, payload } = props;
                  return <circle cx={cx} cy={cy} r={Math.max(3, Math.min(10, payload.total_awards / 500))} fill={dotColor(payload.hhi)} fillOpacity={0.7} stroke={dotColor(payload.hhi)} strokeWidth={1} />;
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        )}
        <div style={{ padding: '10px 24px 14px', borderTop: '1px solid var(--border-color)', fontSize: 11, color: 'var(--text-muted)' }}>
          Dot size ∝ number of awards. HHI = Herfindahl-Hirschman Index (0–10,000 scale). Hover any dot for details. Top-right quadrant = most concerning.
        </div>
      </div>

      {/* ══ SECTION 2: Vendor Drill-Down ═════════════════════════════════════ */}
      <div className="insights-section-title">
        <Users size={18} style={{ color: '#8b5cf6' }} />
        <div>
          <h2>Vendor Drill-Down</h2>
          <p>Search any winning bidder to see their procurement profile, award history, and top departments.</p>
        </div>
      </div>

      {/* Search */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ position: 'relative', maxWidth: 500 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={vendorQ} onChange={handleVendorChange}
            placeholder="Type a vendor/bidder name (min 3 chars)…"
            style={{
              width: '100%', padding: '10px 12px 10px 36px', borderRadius: 8,
              border: '1.5px solid var(--border-color)', background: 'var(--bg-main)',
              color: 'var(--text-primary)', fontSize: 14, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        {vendorLoad && <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>Searching…</p>}
        {vendorErr && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{vendorErr}</p>}

        {/* Match list if multiple */}
        {!vendorLoad && matches.length > 1 && (
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>Other matches:</span>
            {matches.slice(1, 6).map((m, i) => (
              <button key={i} onClick={() => setVendorQ(m.bidder_name)}
                style={{ padding: '4px 10px', borderRadius: 16, fontSize: 12, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                {m.bidder_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Profile */}
      {profile && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Sanctions Warning Banner */}
          {profile.sanction_match && (
            <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #dc2626', background: 'rgba(220, 38, 38, 0.08)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', fontWeight: 700, fontSize: 14 }}>
                <AlertCircle size={18} />
                DEBARRED PROVIDER (SANCTIONS MATCH)
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)' }}>
                This vendor name matches a record on the <strong>World Bank Group Debarred Providers List</strong>.
              </p>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                <div><strong>Sanction reason:</strong> {profile.sanction_match.sanctions}</div>
                {profile.sanction_match.addresses && <div><strong>Registered Address:</strong> {profile.sanction_match.addresses}</div>}
                {profile.sanction_match.countries && <div><strong>Jurisdiction:</strong> {profile.sanction_match.countries.toUpperCase()}</div>}
              </div>
            </div>
          )}

          {/* Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {[
              { label: 'Total Wins',        val: fmt(matches[0]?.total_wins),       color: 'var(--accent-primary)', icon: Award },
              { label: 'Departments',        val: fmt(matches[0]?.n_orgs),           color: '#8b5cf6',              icon: Building2 },
              { label: 'Total Value',        val: fmtCr(matches[0]?.total_value_cr), color: '#10b981',              icon: TrendingUp },
              { label: 'Single-bid Awards',  val: fmt(profile.single_bid_count),     color: '#ef4444',              icon: AlertCircle },
            ].map(({ label, val, color, icon: Icon }) => (
              <div key={label} className="card" style={{ padding: '14px 16px', borderLeft: `3px solid ${color}` }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Trend + Depts grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Awards over time */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>Awards Won Over Time</div>
              {profile.trend.length > 1 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={profile.trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="year" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="wins" name="Awards" stroke="var(--accent-primary)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent-primary)' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>Not enough history</p>}
            </div>

            {/* Top departments */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>Top Departments</div>
              {profile.departments.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={profile.departments.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                    <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis dataKey="org_name" type="category" tick={{ fill: 'var(--text-primary)', fontSize: 9 }} width={120} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="wins" name="Wins" fill="#8b5cf6" radius={[0, 3, 3, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data</p>}
            </div>
          </div>

          {/* Recent contracts table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>
              Top Contracts by Value
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
                    {['Organization', 'Title', 'Value', 'Date', 'Portal'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {profile.contracts.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '9px 14px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.org_name}</td>
                      <td style={{ padding: '9px 14px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{c.title || '—'}</td>
                      <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#10b981', whiteSpace: 'nowrap' }}>{fmtCr(c.contract_value ? c.contract_value / 1e7 : null)}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 11 }}>{c.aoc_date?.split('T')[0] || c.aoc_date || '—'}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 500,
                          background: c.portal_type === 'central' ? '#3b82f618' : '#8b5cf618',
                          color: c.portal_type === 'central' ? '#3b82f6' : '#8b5cf6' }}>
                          {c.portal_type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!profile && !vendorLoad && vendorQ.length >= 3 && matches.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
          No vendors found matching "{vendorQ}"
        </div>
      )}
    </div>
  );
};

export default Insights;
