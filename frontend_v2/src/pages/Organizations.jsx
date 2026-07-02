import { useEffect, useState } from 'react';
import { fetchTopOrgs, fetchSectorDistribution, fetchPortalBreakdown } from '../lib/api';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users, LayoutTemplate, Briefcase } from 'lucide-react';
import './Dashboard.css';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e'];

const Organizations = () => {
  const [topBuyers, setTopBuyers] = useState(null);
  const [sectors, setSectors] = useState(null);
  const [portals, setPortals] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [buyersData, sectorsData, portalsData] = await Promise.all([
          fetchTopOrgs('count', 10, 'aoc'),
          fetchSectorDistribution(),
          fetchPortalBreakdown()
        ]);
        
        setTopBuyers(buyersData.labels.map((label, idx) => ({
          name: label.length > 25 ? label.substring(0, 25) + '...' : label,
          full_name: label,
          count: buyersData.values[idx]
        })));

        setSectors(sectorsData.labels.map((label, idx) => ({
          name: label,
          value: sectorsData.counts[idx]
        })));

        setPortals(portalsData.labels.map((label, idx) => ({
          name: label,
          value: portalsData.counts[idx]
        })));

      } catch (e) {
        console.error("Failed to load organizations data:", e);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  if (loading) {
    return <div className="loading-state">Loading organization data...</div>;
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="recharts-default-tooltip">
          <p className="recharts-tooltip-item">{payload[0].payload.full_name || payload[0].name}</p>
          <p style={{ color: 'var(--text-secondary)' }}>Count: <strong>{new Intl.NumberFormat('en-IN').format(payload[0].value)}</strong></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1 className="page-title">Organizations & Buyers</h1>
        <p className="page-subtitle">Deep dive into procurement entities and their activity</p>
      </div>

      <div className="dashboard-grid">
        <div className="card chart-card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <div className="card-title">Top 10 Buyer Organizations</div>
            <div className="card-subtitle">By total volume of awarded contracts</div>
          </div>
          <div className="chart-wrapper" style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topBuyers} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" tick={{fill: 'var(--text-secondary)', fontSize: 11}} angle={-45} textAnchor="end" tickLine={false} axisLine={false} />
                <YAxis tick={{fill: 'var(--text-secondary)', fontSize: 12}} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? (val/1000)+'k' : val} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'var(--bg-main)'}} />
                <Bar dataKey="count" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="dashboard-grid kpi-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card chart-card">
          <div className="card-header">
            <div className="card-title">Sector Distribution</div>
            <div className="card-subtitle">Contracts grouped by industry sector</div>
          </div>
          <div className="chart-wrapper" style={{ height: 300, display: 'flex', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sectors} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                  {sectors?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card chart-card">
          <div className="card-header">
            <div className="card-title">Portal Breakdown</div>
            <div className="card-subtitle">Source platforms for procurement</div>
          </div>
          <div className="chart-wrapper" style={{ height: 300, display: 'flex', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={portals} cx="50%" cy="50%" innerRadius={0} outerRadius={100} paddingAngle={1} dataKey="value">
                  {portals?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Organizations;
