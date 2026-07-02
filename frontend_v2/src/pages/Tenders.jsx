import { useEffect, useState } from 'react';
import { fetchTenderTypes, fetchValueDistribution } from '../lib/api';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FileText, AlertTriangle } from 'lucide-react';
import './Dashboard.css';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e'];

const Tenders = () => {
  const [types, setTypes] = useState(null);
  const [values, setValues] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [typesData, valuesData] = await Promise.all([
          fetchTenderTypes(),
          fetchValueDistribution()
        ]);

        // Process Types
        const MAX = 8;
        let formattedTypes = [];
        if (typesData.labels.length > 0) {
            const topLabels = typesData.labels.slice(0, MAX);
            const topCounts = typesData.counts.slice(0, MAX);
            formattedTypes = topLabels.map((lbl, idx) => ({ name: lbl, value: topCounts[idx] }));
            
            if (typesData.labels.length > MAX) {
                const otherCount = typesData.counts.slice(MAX).reduce((a, b) => a + b, 0);
                formattedTypes.push({ name: 'Other', value: otherCount });
            }
        }
        setTypes(formattedTypes);

        // Process Values
        setValues(valuesData.labels.map((label, idx) => ({
          name: label,
          count: valuesData.counts[idx]
        })));

      } catch (e) {
        console.error("Failed to load tenders data:", e);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  if (loading) {
    return <div className="loading-state">Loading tender analytics...</div>;
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="recharts-default-tooltip">
          <p className="recharts-tooltip-item">{payload[0].payload.name}</p>
          <p style={{ color: 'var(--text-secondary)' }}>Count: <strong>{new Intl.NumberFormat('en-IN').format(payload[0].value || payload[0].payload.count)}</strong></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1 className="page-title">Tender Analytics</h1>
        <p className="page-subtitle">Categorical breakdown of tender types and value brackets</p>
      </div>

      <div className="dashboard-grid kpi-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card chart-card">
          <div className="card-header">
            <div className="card-title">Tender Types</div>
            <div className="card-subtitle">Distribution by procurement category (Open, Limited, etc)</div>
          </div>
          <div className="chart-wrapper" style={{ height: 350, display: 'flex', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={types} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={2} dataKey="value">
                  {types?.map((entry, index) => (
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
            <div className="card-title">Value Bracket Distribution</div>
            <div className="card-subtitle">Volume of contracts by estimated value segment</div>
          </div>
          <div className="chart-wrapper" style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={values} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" tick={{fill: 'var(--text-secondary)', fontSize: 11}} tickLine={false} axisLine={false} />
                <YAxis tick={{fill: 'var(--text-secondary)', fontSize: 12}} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? (val/1000)+'k' : val} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'var(--bg-main)'}} />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tenders;
