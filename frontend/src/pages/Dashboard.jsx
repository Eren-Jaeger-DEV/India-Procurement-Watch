import { useEffect, useState, useCallback } from 'react';
import { fetchKpis, fetchTrends, fetchTopOrgs } from '../lib/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { Briefcase, Building2, TrendingUp, IndianRupee, RefreshCw } from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
  const [kpis, setKpis] = useState(null);
  const [trends, setTrends] = useState(null);
  const [orgs, setOrgs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpiData, trendData, orgData] = await Promise.all([
        fetchKpis(),
        fetchTrends('yearly', 'aoc'),
        fetchTopOrgs('count', 10, 'aoc')
      ]);

      setKpis(kpiData);
      setLastUpdated(new Date());

      if (trendData?.labels) {
        setTrends(trendData.labels.map((label, idx) => ({
          name: label,
          count: trendData.counts[idx]
        })));
      }

      if (orgData?.labels) {
        setOrgs(orgData.labels.map((label, idx) => ({
          name: label.length > 30 ? label.substring(0, 30) + '…' : label,
          count: orgData.values[idx]
        })));
      }
    } catch (e) {
      console.error("Failed to load dashboard data:", e);
      setError("Failed to connect to the database. Please try refreshing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fmt = (num) => new Intl.NumberFormat('en-IN').format(num || 0);
  const fmtCr = (num) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(num || 0)} Cr`;

  if (loading) {
    return (
      <div className="dashboard-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={36} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)', marginBottom: 16 }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading live data from database...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: 500, textAlign: 'center', padding: 32, borderLeft: '4px solid var(--error, #ef4444)' }}>
          <p style={{ color: 'var(--error, #ef4444)', fontWeight: 600, marginBottom: 12 }}>{error}</p>
          <button onClick={loadData} style={{ padding: '8px 20px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {/* Header */}
      <div className="page-header" style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">Live procurement analytics from the PostgreSQL database</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdated && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={loadData}
            style={{
              padding: '7px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--accent-primary)', color: '#fff', border: 'none',
              borderRadius: 'var(--radius-md, 8px)', fontWeight: 500, cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="dashboard-grid kpi-row" style={{ marginBottom: 24 }}>
        <div className="card kpi-card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
          <div className="kpi-icon-wrapper blue"><Briefcase size={24} /></div>
          <div className="kpi-details">
            <div className="kpi-label">Total Tenders</div>
            <div className="kpi-value">{fmt(kpis?.total_aoc_tenders)}</div>
            <div className="kpi-subtext">Government contracts in database</div>
          </div>
        </div>

        <div className="card kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="kpi-icon-wrapper" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}><IndianRupee size={24} /></div>
          <div className="kpi-details">
            <div className="kpi-label">Total Contract Value</div>
            <div className="kpi-value">{fmtCr(kpis?.total_value_crore)}</div>
            <div className="kpi-subtext">Cumulative procurement spend</div>
          </div>
        </div>

        <div className="card kpi-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="kpi-icon-wrapper purple"><Building2 size={24} /></div>
          <div className="kpi-details">
            <div className="kpi-label">Unique Organizations</div>
            <div className="kpi-value">{fmt(kpis?.unique_orgs)}</div>
            <div className="kpi-subtext">Government departments tracked</div>
          </div>
        </div>

        <div className="card kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="kpi-icon-wrapper" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}><TrendingUp size={24} /></div>
          <div className="kpi-details">
            <div className="kpi-label">Avg Contract Value</div>
            <div className="kpi-value">{fmtCr(kpis?.avg_value_crore)}</div>
            <div className="kpi-subtext">Per tender average</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="dashboard-grid" style={{ marginBottom: 24 }}>
        {/* Trend Chart */}
        <div className="card chart-card">
          <div className="card-header">
            <div className="card-title">Procurement Volume Over Time</div>
            <div className="card-subtitle">Yearly contract awards — live from database</div>
          </div>
          <div className="chart-wrapper" style={{ height: 300 }}>
            {trends?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? (v / 1000) + 'k' : v} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                  <Area type="monotone" dataKey="count" stroke="var(--accent-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
                No trend data available yet
              </div>
            )}
          </div>
        </div>

        {/* Top Orgs */}
        <div className="card chart-card">
          <div className="card-header">
            <div className="card-title">Top Procuring Organizations</div>
            <div className="card-subtitle">By number of published tenders</div>
          </div>
          <div className="chart-wrapper" style={{ height: 300 }}>
            {orgs?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orgs} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                  <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fill: 'var(--text-primary)', fontSize: 11 }} width={160} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8 }} cursor={{ fill: 'var(--bg-main)' }} />
                  <Bar dataKey="count" fill="var(--accent-primary)" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
                No organization data available yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Data Notice */}
      <div className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', flexShrink: 0, animation: 'pulse 2s ease-in-out infinite' }} />
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
          All data is live from the dedicated PostgreSQL database server over a secure Tailscale private network.
          Showing <strong style={{ color: 'var(--text-primary)' }}>{fmt(kpis?.total_aoc_tenders)}</strong> tenders loaded so far — data import is still in progress and counts will increase automatically.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
