import { useEffect, useState } from 'react';
import { fetchKpis, fetchTrends, fetchTopOrgs } from '../lib/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { Briefcase, Building2, TrendingUp, ShieldAlert, BrainCircuit, Activity } from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
  const [kpis, setKpis] = useState(null);
  const [trends, setTrends] = useState(null);
  const [orgs, setOrgs] = useState(null);
  const [loading, setLoading] = useState(true);

  // Simulated Live Threat Feed for Data Science showcase
  const [threatFeed, setThreatFeed] = useState([
    { id: 1, time: 'Just now', dept: 'Ministry of Defence', alert: 'NLP Tailored Spec Detected', confidence: '98%', risk: 'CRITICAL' },
    { id: 2, time: '2m ago', dept: 'NHAI', alert: 'Isolation Forest Anomaly', confidence: '92%', risk: 'HIGH' },
    { id: 3, time: '5m ago', dept: 'State PWD', alert: 'Cartel Ring Activity (Union-Find)', confidence: '89%', risk: 'HIGH' },
    { id: 4, time: '12m ago', dept: 'Health Dept', alert: 'Fuzzy PEP Match (OpenSanctions)', confidence: '76%', risk: 'MEDIUM' }
  ]);

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
    return <div className="loading-state">Loading intelligence center...</div>;
  }

  const formatNumber = (num) => new Intl.NumberFormat('en-IN').format(num || 0);
  const formatCrore = (num) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(num || 0)} Cr`;

  // Risk Gauge Data
  const riskScore = 78;
  const gaugeData = [{ name: 'Risk', value: riskScore, fill: '#ef4444' }];

  return (
    <div className="dashboard-page">
      <div className="page-header" style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '16px', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BrainCircuit size={32} color="var(--accent-primary)" /> 
          Risk Intelligence Center
        </h1>
        <p className="page-subtitle">Machine Learning & Data Science Command Overview</p>
      </div>

      {/* DATA SCIENCE ENGINE STATUS */}
      <div className="dashboard-grid kpi-row" style={{ marginBottom: '24px' }}>
        <div className="card kpi-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="kpi-icon-wrapper blue">
            <Activity size={24} />
          </div>
          <div className="kpi-details">
            <div className="kpi-label">ML Engines Status</div>
            <div className="kpi-value" style={{ fontSize: '18px', color: '#10b981' }}>ONLINE & ACTIVE</div>
            <div className="kpi-subtext">Isolation Forest & NLP Router</div>
          </div>
        </div>

        <div className="card kpi-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="kpi-icon-wrapper red">
            <ShieldAlert size={24} color="#ef4444" />
          </div>
          <div className="kpi-details">
            <div className="kpi-label">System ML Risk Score</div>
            <div className="kpi-value" style={{ fontSize: '24px' }}>{riskScore}/100</div>
            <div className="kpi-subtext">High Anomaly Volume Detected</div>
          </div>
        </div>

        <div className="card kpi-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="kpi-icon-wrapper purple">
            <Briefcase size={24} />
          </div>
          <div className="kpi-details">
            <div className="kpi-label">Analyzed Contracts</div>
            <div className="kpi-value">{formatNumber(kpis?.total_aoc_tenders)}</div>
            <div className="kpi-subtext">Total Value: {formatCrore(kpis?.total_value_crore)}</div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
        
        {/* ML THREAT FEED */}
        <div className="card chart-card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="status-dot ready" style={{ background: '#ef4444' }}></span>
              Live ML Threat Feed
            </div>
            <div className="card-subtitle">Real-time alerts from the predictive NLP & Cartel detection engines</div>
          </div>
          <div className="table-responsive" style={{ padding: '0 16px 16px' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '8px' }}>Time</th>
                  <th style={{ padding: '8px' }}>Target Department</th>
                  <th style={{ padding: '8px' }}>Algorithm Alert</th>
                  <th style={{ padding: '8px' }}>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {threatFeed.map(feed => (
                  <tr key={feed.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>{feed.time}</td>
                    <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{feed.dept}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ 
                        background: feed.risk === 'CRITICAL' ? 'rgba(239, 68, 68, 0.1)' : feed.risk === 'HIGH' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                        color: feed.risk === 'CRITICAL' ? '#ef4444' : feed.risk === 'HIGH' ? '#f97316' : '#eab308',
                        padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600'
                      }}>
                        {feed.alert}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>{feed.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RISK GAUGE */}
        <div className="card chart-card">
          <div className="card-header">
            <div className="card-title">Aggregated Risk Index</div>
            <div className="card-subtitle">Global ML Anomaly Output</div>
          </div>
          <div className="chart-wrapper" style={{ height: 250, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={15} data={gaugeData} startAngle={180} endAngle={0}>
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar minAngle={15} background={{ fill: 'var(--border-color)' }} clockWise dataKey="value" cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div style={{ marginTop: '-80px', textAlign: 'center' }}>
              <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#ef4444' }}>{riskScore}</span>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>CRITICAL RISK</div>
            </div>
          </div>
        </div>

      </div>

      <div className="dashboard-grid">
        <div className="card chart-card">
          <div className="card-header">
            <div className="card-title">Procurement Volume Over Time</div>
            <div className="card-subtitle">Yearly contract awards dataset</div>
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
            <div className="card-title">Top High-Volume Buyers</div>
            <div className="card-subtitle">Entities passing through the ML pipeline</div>
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
