import { useEffect, useState, useMemo, useCallback } from 'react';
import Map, { Source, Layer, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { fetchStateStats } from '../lib/api';

// Maps GeoJSON ST_NM spellings → DB state_name spellings
const GEO_TO_DB = {
  'Andaman & Nicobar Island': 'Andaman & Nicobar',
  'Arunanchal Pradesh': 'Arunachal Pradesh',
  'Dadara & Nagar Havelli': 'Dadra and Nagar Haveli',
  'Daman & Diu': 'Daman & Diu',
  'Jammu & Kashmir': 'Jammu and Kashmir',
  'NCT of Delhi': 'NCT of Delhi',
};

const getRasterStyle = (url) => ({
  version: 8,
  glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
  sources: {
    'raster-tiles': {
      type: 'raster',
      tiles: [url],
      tileSize: 256,
      attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
    }
  },
  layers: [
    {
      id: 'simple-tiles',
      type: 'raster',
      source: 'raster-tiles',
      minzoom: 0,
      maxzoom: 22
    }
  ]
});

const MAP_STYLES = {
  dark: getRasterStyle('https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'),
  light: getRasterStyle('https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png')
};

const Geographical = () => {
  const [geoData, setGeoData] = useState(null);
  const [stats, setStats] = useState({});
  const [mode, setMode] = useState('count'); // 'count' or 'value'
  const [loading, setLoading] = useState(true);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [isDark, setIsDark] = useState(() => document.body.classList.contains('dark-theme'));
  
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.body.classList.contains('dark-theme'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const loadMapAndData = async () => {
      try {
        const [geoRes, statsArray] = await Promise.all([
          fetch('/india-states.json?v=2').then(res => res.json()),
          fetchStateStats()
        ]);
        
        // Convert array [{state_name, total_contracts, total_value_crore}] → dict keyed by state_name
        const statsDict = {};
        (statsArray || []).forEach(row => {
          statsDict[row.state_name] = {
            count: row.total_contracts,
            value: row.total_value_crore,
          };
        });
        setStats(statsDict);

        // Inject metric values into GeoJSON properties for data-driven styling
        if (geoRes && geoRes.features) {
          geoRes.features = geoRes.features.map(f => {
            const geoName = f.properties.ST_NM;
            const dbName = GEO_TO_DB[geoName] || geoName;
            const stateData = statsDict[dbName];
            f.properties.count = stateData ? stateData.count : 0;
            f.properties.value = stateData ? stateData.value : 0;
            return f;
          });
        }
        setGeoData(geoRes);

      } catch (e) {
        console.error("Failed to load map data:", e);
      } finally {
        setLoading(false);
      }
    };
    
    loadMapAndData();
  }, []);

  const maxStat = useMemo(() => {
    if (!stats || Object.keys(stats).length === 0) return 1;
    const values = Object.values(stats).map(s => s[mode] || 0);
    return Math.max(...values, 1);
  }, [stats, mode]);

  const fillLayerStyle = useMemo(() => {
    return {
      id: 'state-fills',
      type: 'fill',
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', mode], 0], '#f8fafc',
          ['>', ['get', mode], maxStat * 0.8], '#1e3a8a',
          ['>', ['get', mode], maxStat * 0.6], '#1d4ed8',
          ['>', ['get', mode], maxStat * 0.4], '#2563eb',
          ['>', ['get', mode], maxStat * 0.2], '#3b82f6',
          ['>', ['get', mode], maxStat * 0.05], '#60a5fa',
          '#bfdbfe'
        ],
        'fill-opacity': 0.8
      }
    };
  }, [maxStat, mode]);

  const lineLayerStyle = {
    id: 'state-borders',
    type: 'line',
    paint: {
      'line-color': '#ffffff',
      'line-width': 1,
      'line-dasharray': [3, 3]
    }
  };

  const formatValue = (val) => {
    if (!val) return '0';
    if (mode === 'value') return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val)} Cr`;
    return new Intl.NumberFormat('en-IN').format(val);
  };

  const onHover = useCallback(event => {
    const {
      features,
      point: { x, y }
    } = event;
    const hoveredFeature = features && features[0];

    setHoverInfo(
      hoveredFeature
        ? {
            feature: hoveredFeature,
            x,
            y
          }
        : null
    );
  }, []);

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
        
        <div style={{ height: 750, width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative' }}>
          <Map
            initialViewState={{
              longitude: 78.9629,
              latitude: 22.5937,
              zoom: 4
            }}
            mapStyle={isDark ? MAP_STYLES.dark : MAP_STYLES.light}
            interactiveLayerIds={['state-fills']}
            onMouseMove={onHover}
            onMouseLeave={() => setHoverInfo(null)}
          >
            {geoData && (
              <Source type="geojson" data={geoData}>
                <Layer {...fillLayerStyle} />
                <Layer {...lineLayerStyle} />
              </Source>
            )}

            {hoverInfo && (
              <div
                style={{
                  position: 'absolute',
                  left: hoverInfo.x,
                  top: hoverInfo.y,
                  transform: 'translate(-50%, -100%)',
                  marginTop: '-15px',
                  background: 'rgba(255,255,255,0.95)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  pointerEvents: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '13px',
                  border: '1px solid #e2e8f0',
                  color: '#1e293b',
                  zIndex: 9999
                }}
              >
                <strong>{hoverInfo.feature.properties.ST_NM}</strong><br/>
                {mode === 'count' ? 'Contracts' : 'Value'}: {formatValue(hoverInfo.feature.properties[mode])}
              </div>
            )}
          </Map>
        </div>
      </div>
    </div>
  );
};

export default Geographical;
