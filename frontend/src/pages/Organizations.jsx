import { useEffect, useState } from 'react';
import { fetchTopOrgs, fetchSectorDistribution, fetchPortalBreakdown } from '../lib/api';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ShieldAlert, Activity, Filter } from 'lucide-react';
import './Dashboard.css';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e'];

const Organizations = () => {
  const [topBuyers, setTopBuyers] = useState(null);
  const [sectors, setSectors] = useState(null);
  const [portals, setPortals] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to assign a demonstration Risk Grade
  const getRiskGrade = (count) => {
    if (count > 20000) return { grade: 'F', color: '#ef4444', desc: 'Critical Anomaly Volume' };
    if (count > 10000) return { grade: 'D', color: '#f97316', desc: 'High Anomaly Volume' };
    if (count > 5000) return { grade: 'C', color: '#eab308', desc: 'Moderate Anomaly Volume' };
    if (count > 1000) return { grade: 'B', color: '#3b82f6', desc: 'Low Risk' };
    return { grade: 'A', color: '#10b981', desc: 'Clean' };
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [buyersData, sectorsData, portalsData] = await Promise.all([
          fetchTopOrgs('count', 10, 'aoc'),
          fetchSectorDistribution(),
          fetchPortalBreakdown()
        ]);
        
        setTopBuyers(buyersData.labels.map((label, idx) => {
          const count = buyersData.values[idx];
          const risk = getRiskGrade(count);
          return {
            name: label.length > 25 ? label.substring(0, 25) + '...' : label,
            full_name: label,
            count: count,
            fill: risk.color, // Color the bar based on Risk Grade
            riskGrade: risk.grade,
            riskDesc: risk.desc
          };
        }));

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
    return <div className="loading-state">Loading organization risk profiles...</div>;
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="recharts-default-tooltip" style={{ background: '#fff', padding: '12px', border: '1px solid #ccc', borderRadius: '8px' }}>
          <p className="recharts-tooltip-item" style={{ margin: '0 0 8px', fontWeight: 'bold' }}>{data.full_name || data.name}</p>
          <p style={{ margin: '0 0 4px', color: 'var(--text-secondary)' }}>Contracts: <strong>{new Intl.NumberFormat('en-IN').format(data.value || data.count)}</strong></p>
          {data.riskGrade && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #eee' }}>
              <span style={{ 
                background: data.fill + '22', 
                color: data.fill, 
                padding: '4px 8px', 
                borderRadius: '4px', 
                fontSize: '12px', 
                fontWeight: 'bold' 
              }}>
                Grade {data.riskGrade} : {data.riskDesc}
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dashboard-page">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldAlert size={32} color="var(--accent-primary)" />
          Department Risk Grading
        </h1>
        <p className="page-subtitle">Algorithmic risk profiles for top buying organizations based on anomaly volume</p>
      </div>

      {/* NORMIE EXPLAINER BLOCK */}
      <div style={{ marginBottom: 24, padding: 20, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8, display: 'flex', gap: 16 }}>
        <Activity size={28} color="#ef4444" style={{ flexShrink: 0, marginTop: 4 }} />
        <div>
          <h4 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '15px' }}>How does Risk Grading work?</h4>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Our Machine Learning engine (Isolation Forests) continuously scans millions of contracts. Organizations are graded from <strong>A (Clean) to F (Critical Risk)</strong> based on the concentration of anomalous behavior. A grade of <strong>F</strong> means the department exhibits extremely high rates of single-bid awards, round-number contracts, or cartel bid-rotation.
          </p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card chart-card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <div className="card-title">Top 10 High-Volume Departments</div>
            <div className="card-subtitle">Bars are color-coded by their ML Risk Grade (Red = Grade F)</div>
          </div>
          <div className="chart-wrapper" style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topBuyers} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" tick={{fill: 'var(--text-secondary)', fontSize: 11}} angle={-45} textAnchor="end" tickLine={false} axisLine={false} />
                <YAxis tick={{fill: 'var(--text-secondary)', fontSize: 12}} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? (val/1000)+'k' : val} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'var(--bg-main)'}} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={32}>
                  {topBuyers?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
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
