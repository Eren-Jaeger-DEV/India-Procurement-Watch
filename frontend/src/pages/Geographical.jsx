import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Tooltip } from 'react-leaflet';
import { fetchStateStats } from '../lib/api';
import 'leaflet/dist/leaflet.css';

const Geographical = () => {
  const [geoData, setGeoData] = useState(null);
  const [stats, setStats] = useState({});
  const [mode, setMode] = useState('count'); // 'count' or 'value'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMapAndData = async () => {
      try {
        const [geoRes, statsData] = await Promise.all([
          fetch('/india-states.json?v=2').then(res => res.json()),
          fetchStateStats()
        ]);
        
        setGeoData(geoRes);
        setStats(statsData);
      } catch (e) {
        console.error("Failed to load map data:", e);
      } finally {
        setLoading(false);
      }
    };
    
    loadMapAndData();
  }, []);

  // Find max value to calculate color intensity
  const maxStat = useMemo(() => {
    if (!stats || Object.keys(stats).length === 0) return 1;
    const values = Object.values(stats).map(s => s[mode] || 0);
    return Math.max(...values, 1);
  }, [stats, mode]);

  const getColor = (val) => {
    // Generate a heat map from light blue to dark blue based on intensity
    if (!val) return '#f8fafc';
    const intensity = val / maxStat;
    
    // Example gradient from very light blue to very dark blue
    if (intensity > 0.8) return '#1e3a8a'; // blue-900
    if (intensity > 0.6) return '#1d4ed8'; // blue-700
    if (intensity > 0.4) return '#2563eb'; // blue-600
    if (intensity > 0.2) return '#3b82f6'; // blue-500
    if (intensity > 0.05) return '#60a5fa'; // blue-400
    return '#bfdbfe'; // blue-200
  };

  const style = (feature) => {
    const stateName = feature.properties.st_nm; // Assuming "st_nm" is the state name property in the geojson
    const stateData = stats[stateName];
    const val = stateData ? stateData[mode] : 0;
    
    return {
      fillColor: getColor(val),
      weight: 1,
      opacity: 1,
      color: 'white',
      dashArray: '3',
      fillOpacity: 0.8
    };
  };

  const formatValue = (val) => {
    if (!val) return '0';
    if (mode === 'value') return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val)} Cr`;
    return new Intl.NumberFormat('en-IN').format(val);
  };

  const onEachFeature = (feature, layer) => {
    const stateName = feature.properties.st_nm;
    const stateData = stats[stateName];
    const val = stateData ? stateData[mode] : 0;
    
    layer.bindTooltip(`
      <div style="font-family: 'Inter', sans-serif;">
        <strong>${stateName}</strong><br/>
        ${mode === 'count' ? 'Contracts' : 'Value'}: ${formatValue(val)}
      </div>
    `, { sticky: true });
  };

  if (loading) {
    return <div className="loading-state">Loading Geographical Data...</div>;
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1 className="page-title">Geographical Overview</h1>
        <p className="page-subtitle">Interactive state-by-state heatmap of procurement activity</p>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h3 className="card-title">State-by-State Heatmap</h3>
            <p className="card-subtitle">Showing {mode === 'count' ? 'volume' : 'estimated total value'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              onClick={() => setMode('count')}
              className="search-button" 
              style={{ background: mode === 'count' ? 'var(--accent-primary)' : 'var(--bg-main)', color: mode === 'count' ? 'white' : 'var(--text-secondary)' }}
            >
              Volume
            </button>
            <button 
              onClick={() => setMode('value')}
              className="search-button" 
              style={{ background: mode === 'value' ? 'var(--accent-primary)' : 'var(--bg-main)', color: mode === 'value' ? 'white' : 'var(--text-secondary)' }}
            >
              Value (Cr)
            </button>
          </div>
        </div>
        
        <div style={{ height: 600, width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <MapContainer 
            center={[22.5937, 78.9629]} // Center of India
            zoom={5} 
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
            />
            {geoData && (
              <GeoJSON 
                data={geoData} 
                style={style} 
                onEachFeature={onEachFeature} 
              />
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default Geographical;
