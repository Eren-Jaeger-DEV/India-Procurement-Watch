import { useEffect, useState, useCallback } from 'react';
import {
  fetchKpis, fetchTrends, fetchTopOrgs, fetchTenderTypes,
  fetchValueDistribution, fetchPortalBreakdown, fetchMonthlySeasonality,
  fetchBidCompetition, fetchSingleBidContracts, fetchRepeatWinners,
  fetchStateStats
} from '../lib/api';
import {
  ComposedChart, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend, Line
} from 'recharts';
import {
  Briefcase, Building2, TrendingUp, IndianRupee, RefreshCw,
  AlertTriangle, Users, Scale
} from 'lucide-react';
import './Dashboard.css';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt   = (n) => new Intl.NumberFormat('en-IN').format(n || 0);
const fmtCr = (n) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0)} Cr`;

const RADIAN = Math.PI / 180;
const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct, name }) => {
  if (pct < 4) return null;
  const r  = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x  = cx + r * Math.cos(-midAngle * RADIAN);
  const y  = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${pct}%`}
    </text>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || 'var(--text-primary)', margin: 0 }}>
          {p.name}: {typeof p.value === 'number' ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

// ── PORTAL colors ─────────────────────────────────────────────────────────────
const PORTAL_COLORS = { state: '#8b5cf6', central: '#3b82f6' };
const BID_COLORS    = ['#6b7280', '#ef4444', '#f97316', '#3b82f6', '#10b981'];

// ── TENDER TYPE consolidation ─────────────────────────────────────────────────
function consolidateTenderTypes(raw) {
  const map = { Works: 0, Goods: 0, Services: 0, Limited: 0, Open: 0, Other: 0 };
  raw?.labels?.forEach((label, i) => {
    const c = raw.counts[i];
    const l = label.toLowerCase();
    if (l.includes('works'))          map.Works    += c;
    else if (l.includes('goods'))     map.Goods    += c;
    else if (l.includes('service'))   map.Services += c;
    else if (l.includes('limited'))   map.Limited  += c;
    else if (l.includes('open') || l === '1' || l === 'open') map.Open += c;
    else                              map.Other    += c;
  });
  const colors = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#06b6d4','#6b7280'];
  const total  = Object.values(map).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({
      name, value, color: colors[i], pct: Math.round(100 * value / total)
    }));
}

// ── SECTION header ─────────────────────────────────────────────────────────────
const SectionHeader = ({ title, subtitle }) => (
  <div style={{ marginBottom: 16 }}>
    <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
    {subtitle && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{subtitle}</p>}
  </div>
);

// ── KPI CARD ───────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, icon: Icon, color }) => (
  <div className="card kpi-card" style={{ borderLeft: `4px solid ${color}` }}>
    <div className="kpi-icon-wrapper" style={{ background: `${color}18`, color }}>{Icon && <Icon size={22} />}</div>
    <div className="kpi-details">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-subtext">{sub}</div>}
    </div>
  </div>
);

// ── CHART CARD ─────────────────────────────────────────────────────────────────
const ChartCard = ({ title, subtitle, children, height = 380 }) => (
  <div className="card chart-card">
    <div className="card-header">
      <div className="card-title">{title}</div>
      {subtitle && <div className="card-subtitle">{subtitle}</div>}
    </div>
    <div className="chart-wrapper" style={{ height }}>{children}</div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
const Dashboard = () => {
  const [kpis,         setKpis]         = useState(null);
  const [trends,       setTrends]       = useState(null);
  const [orgs,         setOrgs]         = useState(null);
  const [tenderTypes,  setTenderTypes]  = useState(null);
  const [valueDist,    setValueDist]    = useState(null);
  const [portalData,   setPortalData]   = useState(null);
  const [seasonality,  setSeasonality]  = useState(null);
  const [bidComp,      setBidComp]      = useState(null);
  const [singleBids,   setSingleBids]   = useState(null);
  const [repeatWin,    setRepeatWin]    = useState(null);
  const [stateStats,   setStateStats]   = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [lastUpdated,  setLastUpdated]  = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [kpiData, trendData, orgData, ttData, vdData, pbData, seaData, bcData, sbData, rwData, ssData] =
        await Promise.all([
          fetchKpis(),
          fetchTrends('yearly', 'aoc'),
          fetchTopOrgs('count', 10, 'aoc'),
          fetchTenderTypes(),
          fetchValueDistribution(),
          fetchPortalBreakdown(),
          fetchMonthlySeasonality(),
          fetchBidCompetition(),
          fetchSingleBidContracts(10000000, 1),
          fetchRepeatWinners(5, 1),
          fetchStateStats(),
        ]);

      setKpis(kpiData);
      setLastUpdated(new Date());

      if (trendData?.labels) {
        setTrends(trendData.labels.map((label, i) => ({
          name: label,
          count: trendData.counts[i],
          single_bid_pct: trendData.single_bid_pcts?.[i] ?? null,
        })));
      }
      if (orgData?.labels) {
        setOrgs(orgData.labels.map((label, i) => ({
          name: label.length > 28 ? label.substring(0, 28) + '…' : label,
          count: orgData.values[i]
        })));
      }
      setTenderTypes(consolidateTenderTypes(ttData));
      if (vdData?.labels) {
        setValueDist(vdData.labels.map((l, i) => ({ name: l, count: vdData.counts[i] })));
      }
      if (pbData?.labels) {
        const total = pbData.counts.reduce((a, b) => a + b, 0) || 1;
        setPortalData(pbData.labels.map((l, i) => ({
          name: l.charAt(0).toUpperCase() + l.slice(1),
          value: pbData.counts[i],
          color: PORTAL_COLORS[l] || '#6b7280',
          pct: Math.round(100 * pbData.counts[i] / total)
        })));
      }
      setSeasonality(seaData);
      if (bcData?.labels?.length) {
        const total = bcData.counts.reduce((a, b) => a + b, 0) || 1;
        setBidComp(bcData.labels.map((l, i) => ({
          name: l, value: bcData.counts[i],
          color: BID_COLORS[i], pct: Math.round(100 * bcData.counts[i] / total)
        })));
      }
      setSingleBids(sbData?.results || []);
      setRepeatWin(rwData?.results || []);
      if (Array.isArray(ssData) && ssData.length) {
        const sorted = [...ssData]
          .filter(r => r.total_contracts > 0)
          .sort((a, b) => b.total_contracts - a.total_contracts)
          .slice(0, 15);
        setStateStats(sorted.map(r => ({
          name: r.state_name?.replace(' (State)', '').replace(' (UT)', '') || r.state_name,
          contracts: r.total_contracts,
          value: Math.round(r.total_value_crore || 0),
        })));
      }
    } catch (e) {
      console.error(e);
      setError('Failed to connect to the database. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // March + Q4 (Jan-Mar) stats for seasonality
  const marPct = seasonality?.find(m => m.month_num === 3)?.pct ?? 0;
  const q4Pct  = seasonality
    ?.filter(m => [1, 2, 3].includes(m.month_num))
    .reduce((s, m) => s + (m.pct || 0), 0) ?? 0;

  if (loading) return (
    <div className="dashboard-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <RefreshCw size={36} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)', marginBottom: 16 }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading live data from database…</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (error) return (
    <div className="dashboard-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div className="card" style={{ maxWidth: 500, textAlign: 'center', padding: 32, borderLeft: '4px solid #ef4444' }}>
        <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: 12 }}>{error}</p>
        <button onClick={loadData} style={{ padding: '8px 20px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>Try Again</button>
      </div>
    </div>
  );

  return (
    <div className="dashboard-page">

      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">Live procurement analytics - {fmt(kpis?.total_aoc_tenders)} tenders indexed</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdated && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Updated {lastUpdated.toLocaleTimeString()}</span>}
          <button onClick={loadData} style={{ padding: '7px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md, 8px)', fontWeight: 500, cursor: 'pointer' }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* ── KPI ROW ──────────────────────────────────────────────────────────── */}
      <div className="dashboard-grid kpi-row" style={{ marginBottom: 24 }}>
        <KpiCard label="Total Tenders"        value={fmt(kpis?.total_aoc_tenders)}  sub="Award of contract records"       icon={Briefcase}    color="var(--accent-primary)" />
        <KpiCard label="Total Contract Value" value={fmtCr(kpis?.total_value_crore)} sub="Cumulative procurement spend"   icon={IndianRupee}  color="#10b981" />
        <KpiCard label="Single-Bid Awards"    value={fmt(kpis?.n_single_bid)}        sub="Contracts with zero competition" icon={AlertTriangle} color="#ef4444" />
        <KpiCard label="Unique Organizations" value={fmt(kpis?.unique_aoc_orgs)}     sub="Govt departments tracked"       icon={Building2}    color="#8b5cf6" />
        <KpiCard label="Avg Contract Value"   value={fmtCr(kpis?.avg_value_crore)}   sub="Per tender average"             icon={TrendingUp}   color="#f59e0b" />
        <KpiCard label="Published Tenders"    value={fmt(kpis?.total_published_tenders)} sub="Open tenders (VPS portal)"  icon={Scale}        color="#06b6d4" />
      </div>

      {/* ── ROW 1: Yearly trend + Top orgs ──────────────────────────────────── */}
      <div className="dashboard-grid" style={{ marginBottom: 24 }}>
        <ChartCard title="Procurement Volume Over Time" subtitle="Bars = total tenders · Line = single-bid % (right axis)" height={400}>
          {trends?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trends} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--accent-primary)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? (v / 1000) + 'k' : v} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#ef4444', fontSize: 10 }} tickLine={false} axisLine={false} unit="%" domain={[0, 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Area yAxisId="left" type="monotone" dataKey="count" name="Tenders" stroke="var(--accent-primary)" strokeWidth={2} fillOpacity={1} fill="url(#trendGrad)" />
                <Line yAxisId="right" type="monotone" dataKey="single_bid_pct" name="Single-bid %" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} strokeDasharray="5 3" connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No data</div>}
        </ChartCard>


        <ChartCard title="Top Procuring Organizations" subtitle="By number of published tenders" height={400}>
          {orgs?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={orgs} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? (v/1000)+'k' : v} />
                <YAxis dataKey="name" type="category" tick={{ fill: 'var(--text-primary)', fontSize: 11 }} width={175} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-main)' }} />
                <Bar dataKey="count" name="Contracts" fill="var(--accent-primary)" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No data</div>}
        </ChartCard>
      </div>

      {/* ── ROW 2: Bid competition + Tender types + Portal breakdown ─────────── */}
      <SectionHeader title="Bid Competition & Contract Composition" subtitle="How competitive are India's government contracts?" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>

        <ChartCard title="Bid Competition" subtitle="Number of bids received per award" height={360}>
          {bidComp?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={bidComp} cx="50%" cy="50%" innerRadius={70} outerRadius={115}
                  dataKey="value" nameKey="name" labelLine={false} label={renderPieLabel}>
                  {bidComp.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(val) => fmt(val)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>Computing from database…</div>}
        </ChartCard>

        <ChartCard title="Tender Types" subtitle="Category breakdown of all contracts" height={360}>
          {tenderTypes?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={tenderTypes} cx="50%" cy="50%" innerRadius={70} outerRadius={115}
                  dataKey="value" nameKey="name" labelLine={false} label={renderPieLabel}>
                  {tenderTypes.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(val) => fmt(val)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No data</div>}
        </ChartCard>

        <ChartCard title="Portal Breakdown" subtitle="State vs Central procurement portals" height={360}>
          {portalData?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={portalData} cx="50%" cy="50%" innerRadius={70} outerRadius={115}
                  dataKey="value" nameKey="name" labelLine={false} label={renderPieLabel}>
                  {portalData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(val) => fmt(val)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No data</div>}
        </ChartCard>
      </div>

      {/* ── ROW 3: Monthly seasonality + Contract size distribution ─────────── */}
      <SectionHeader title="Spending Patterns & Contract Size" subtitle="When does procurement happen and at what scale?" />
      <div className="dashboard-grid" style={{ marginBottom: 24 }}>

        <ChartCard title="Monthly Procurement Seasonality" subtitle="Jan–Mar highlighted: India's fiscal year-end budget flush" height={380}>
          {seasonality?.length > 0 ? (
            <>
              <div style={{ display: 'flex', gap: 16, padding: '0 4px 12px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  March share: <strong style={{ color: '#ef4444' }}>{marPct}%</strong>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Jan–Mar (year-end): <strong style={{ color: '#ef4444' }}>{q4Pct.toFixed(1)}%</strong> of annual contracts
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={seasonality} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => (v/1000).toFixed(0) + 'k'} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Awards" radius={[4, 4, 0, 0]} barSize={32}>
                    {seasonality.map((entry, i) => (
                      <Cell key={i} fill={entry.is_year_end ? '#ef4444' : 'var(--accent-primary)'} fillOpacity={entry.is_year_end ? 1 : 0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No data</div>}
        </ChartCard>

        <ChartCard title="Contract Size Distribution" subtitle="How many contracts fall in each value bracket?" height={380}>
          {valueDist?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={valueDist} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} angle={-20} textAnchor="end" />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? (v/1000)+'k' : v} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Contracts" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No data</div>}
        </ChartCard>
      </div>

      {/* ── ROW 4: Red flag panels ────────────────────────────────────────────── */}
      <SectionHeader title="🚩 Red Flag Panels" subtitle="Statistical indicators of procurement risk - not accusations" />
      <div className="dashboard-grid" style={{ marginBottom: 24 }}>

        {/* Single-bid contracts */}
        <div className="card chart-card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              Single-Bid Contracts (≥ ₹1 Cr)
            </div>
            <div className="card-subtitle">High-value awards with zero competition - investigate further</div>
          </div>
          <div style={{ padding: '0 16px 16px', overflowX: 'auto' }}>
            {singleBids?.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 500 }}>Organization</th>
                    <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 500 }}>Bidder</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 500 }}>Value (Cr)</th>
                    <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 500 }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {singleBids.slice(0, 8).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px 6px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.org_name}>{r.org_name}</td>
                      <td style={{ padding: '8px 6px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }} title={r.bidder_name}>{r.bidder_name || '-'}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: 'monospace', color: '#ef4444', fontWeight: 600 }}>
                        {r.contract_value ? (r.contract_value / 1e7).toFixed(2) : '-'}
                      </td>
                      <td style={{ padding: '8px 6px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{r.aoc_date?.split('T')[0] || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading…</p>}
          </div>
        </div>

        {/* Repeat winners */}
        <div className="card chart-card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', display: 'inline-block' }} />
              Repeat Winners
            </div>
            <div className="card-subtitle">Vendors winning repeatedly - check for collusion patterns</div>
          </div>
          <div style={{ padding: '0 16px 16px', overflowX: 'auto' }}>
            {repeatWin?.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 500 }}>Bidder</th>
                    <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 500 }}>Organization</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 500 }}>Wins</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 500 }}>Value (Cr)</th>
                  </tr>
                </thead>
                <tbody>
                  {repeatWin.slice(0, 8).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px 6px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }} title={r.bidder_name}>{r.bidder_name}</td>
                      <td style={{ padding: '8px 6px', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }} title={r.org_name}>{r.org_name}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: 'monospace', color: '#f97316', fontWeight: 600 }}>{fmt(r.wins)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{r.total_value_crore ? Number(r.total_value_crore).toFixed(1) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading…</p>}
          </div>
        </div>
      </div>

      {/* ── ROW 5: State-wise breakdown ───────────────────────────────────────── */}
      <SectionHeader title="State-wise Procurement" subtitle="Top 15 states by number of contracts awarded" />
      <div style={{ marginBottom: 24 }}>
        <ChartCard title="Contracts by State" subtitle="State portal awards only - Central portal contracts not state-attributed" height={450}>
          {stateStats?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stateStats} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? (v/1000).toFixed(0)+'k' : v} />
                <YAxis dataKey="name" type="category" tick={{ fill: 'var(--text-primary)', fontSize: 11 }} width={140} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-main)' }} />
                <Bar dataKey="contracts" name="Contracts" fill="#06b6d4" radius={[0, 4, 4, 0]} barSize={18}>
                  {stateStats.map((_, i) => (
                    <Cell key={i} fill={`hsl(${188 + i * 5}, 70%, ${50 - i * 1.5}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>Loading state data…</div>}
        </ChartCard>
      </div>

      {/* ── LIVE DATA NOTICE ──────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', flexShrink: 0, animation: 'pulse 2s ease-in-out infinite' }} />
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
          All data is live from the dedicated PostgreSQL database server over a secure Tailscale private network.
          Showing <strong style={{ color: 'var(--text-primary)' }}>{fmt(kpis?.total_aoc_tenders)}</strong> tenders -
          data import is still in progress and counts will increase automatically.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
