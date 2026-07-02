import { useEffect, useState } from 'react';
import { fetchKpis, fetchTrends, fetchTopOrgs } from '../lib/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Briefcase, Building2, TrendingUp } from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
  const [kpis, setKpis] = useState(null);
  const [trends, setTrends] = useState(null);
  const [orgs, setOrgs] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [kpiData, trendData, orgData] = await Promise.all([
          fetchKpis(),
          fetchTrends('yearly', 'aoc'),
          fetchTopOrgs('count', 10, 'aoc')
        ]);
        
        setKpis(kpiData);
        
        // Format trend data for recharts
        const formattedTrends = trendData.labels.map((label, idx) => ({
          name: label,
          count: trendData.counts[idx]
        }));
        setTrends(formattedTrends);

        // Format org data for recharts
        const formattedOrgs = orgData.labels.map((label, idx) => ({
          name: label.substring(0, 25) + (label.length > 25 ? '...' : ''),
          count: orgData.values[idx]
        }));
        setOrgs(formattedOrgs);
      } catch (e) {
        console.error("Failed to load dashboard data:", e);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  if (loading) {
    return <div className="loading-state">Loading dashboard data...</div>;
  }

  const formatNumber = (num) => new Intl.NumberFormat('en-IN').format(num || 0);
  const formatCrore = (num) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(num || 0)} Cr`;

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1 className="page-title">Executive Overview</h1>
        <p className="page-subtitle">Key performance indicators across all procurement data</p>
      </div>

      <div className="dashboard-grid kpi-row">
        <div className="card kpi-card">
          <div className="kpi-icon-wrapper blue">
            <Briefcase size={24} />
          </div>
          <div className="kpi-details">
            <div className="kpi-label">Total Contracts</div>
            <div className="kpi-value">{formatNumber(kpis?.total_aoc_tenders)}</div>
            <div className="kpi-subtext">Across all years</div>
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-icon-wrapper green">
            <TrendingUp size={24} />
          </div>
          <div className="kpi-details">
            <div className="kpi-label">Total Value</div>
            <div className="kpi-value">{formatCrore(kpis?.total_value_crore)}</div>
            <div className="kpi-subtext">Estimated total spending</div>
          </div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-icon-wrapper purple">
            <Building2 size={24} />
          </div>
          <div className="kpi-details">
            <div className="kpi-label">Unique Organizations</div>
            <div className="kpi-value">{formatNumber(kpis?.unique_aoc_orgs)}</div>
            <div className="kpi-subtext">Distinct buyers</div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card chart-card">
          <div className="card-header">
            <div className="card-title">Procurement Volume Over Time</div>
            <div className="card-subtitle">Yearly contract awards</div>
          </div>
          <div className="chart-wrapper" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" tick={{fill: 'var(--text-secondary)', fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis tick={{fill: 'var(--text-secondary)', fontSize: 12}} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? (val/1000)+'k' : val} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="var(--accent-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card chart-card">
          <div className="card-header">
            <div className="card-title">Top Buying Organizations</div>
            <div className="card-subtitle">By total contracts awarded</div>
          </div>
          <div className="chart-wrapper" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={orgs} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                <XAxis type="number" tick={{fill: 'var(--text-secondary)', fontSize: 12}} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" tick={{fill: 'var(--text-primary)', fontSize: 11}} width={150} tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: 'var(--bg-main)'}} />
                <Bar dataKey="count" fill="var(--accent-primary)" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
