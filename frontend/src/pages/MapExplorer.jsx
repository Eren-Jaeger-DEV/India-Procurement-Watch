import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import debounce from 'lodash.debounce';
import Map, { Source, Layer, NavigationControl, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { fetchMapTenders } from '../lib/api';
import { Search, AlertTriangle, ShieldAlert, Building, Loader2, Layers, X, Info, TrendingUp, MapPin } from 'lucide-react';
import './MapExplorer.css';

const fmtCr = (v) => v ? `₹${(v / 1e7).toFixed(1)}Cr` : '—';
const fmtBig = (n) => n >= 1e7 ? `₹${(n / 1e7).toFixed(0)}Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(0)}L` : `₹${n?.toLocaleString()}`;

const INDIA_DEFAULT_BOUNDS = {
  min_lat: 6.0,
  max_lat: 38.0,
  min_lon: 68.0,
  max_lon: 98.0
};

const STATE_COORDS = {
  "Andaman & Nicobar": { center: [92.6586, 11.7401], zoom: 6 },
  "Andhra Pradesh": { center: [79.7400, 15.9129], zoom: 6 },
  "Arunachal Pradesh": { center: [94.7278, 28.2180], zoom: 6 },
  "Assam": { center: [92.9376, 26.2006], zoom: 6 },
  "Bihar": { center: [85.3131, 25.0961], zoom: 6 },
  "Chandigarh": { center: [76.7794, 30.7333], zoom: 10 },
  "Chhattisgarh": { center: [81.8661, 21.2787], zoom: 6 },
  "Delhi": { center: [77.2090, 28.6139], zoom: 9 },
  "Goa": { center: [74.1240, 15.2993], zoom: 8 },
  "Gujarat": { center: [71.1924, 22.2587], zoom: 6 },
  "Haryana": { center: [76.0856, 29.0588], zoom: 6 },
  "Himachal Pradesh": { center: [77.1734, 31.1048], zoom: 6 },
  "Jammu & Kashmir": { center: [74.7973, 34.0837], zoom: 6 },
  "Jharkhand": { center: [85.2799, 23.6102], zoom: 6 },
  "Karnataka": { center: [75.7139, 15.3173], zoom: 6 },
  "Kerala": { center: [76.2711, 10.8505], zoom: 6 },
  "Ladakh": { center: [77.5770, 34.1526], zoom: 6 },
  "Madhya Pradesh": { center: [78.6569, 22.9734], zoom: 5 },
  "Maharashtra": { center: [75.7139, 19.7515], zoom: 6 },
  "Manipur": { center: [93.9063, 24.6637], zoom: 7 },
  "Meghalaya": { center: [91.3662, 25.4670], zoom: 7 },
  "Mizoram": { center: [92.9376, 23.1645], zoom: 7 },
  "Nagaland": { center: [94.5624, 26.1584], zoom: 7 },
  "Odisha": { center: [85.0985, 20.9517], zoom: 6 },
  "Puducherry": { center: [79.8083, 11.9416], zoom: 9 },
  "Punjab": { center: [75.3412, 31.1471], zoom: 7 },
  "Rajasthan": { center: [74.2179, 27.0238], zoom: 6 },
  "Sikkim": { center: [88.5122, 27.5330], zoom: 8 },
  "Tamil Nadu": { center: [78.6569, 11.1271], zoom: 6 },
  "Telangana": { center: [79.0193, 18.1124], zoom: 6 },
  "Tripura": { center: [91.9882, 23.9408], zoom: 8 },
  "Uttar Pradesh": { center: [80.9462, 26.8467], zoom: 6 },
  "Uttarakhand": { center: [79.0193, 30.0668], zoom: 6 },
  "West Bengal": { center: [87.8550, 22.9868], zoom: 6 }
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
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
};

export default function MapExplorer() {
  const mapRef = useRef(null);
  
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [bounds, setBounds] = useState(INDIA_DEFAULT_BOUNDS);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [portal, setPortal] = useState('all');
  
  const [isDark, setIsDark] = useState(() => document.body.classList.contains('dark-theme'));
  
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.body.classList.contains('dark-theme'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const [layerOpen, setLayerOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [selectedState, setSelectedState] = useState('');
  
  const [popupInfo, setPopupInfo] = useState(null);

  // Layout fix: completely remove parent padding to prevent cutoff and scrollbars
  useEffect(() => {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.style.padding = '0';
      mainContent.style.overflow = 'hidden';
      mainContent.style.position = 'relative';
    }
    return () => {
      if (mainContent) {
        mainContent.style.padding = '';
        mainContent.style.overflow = '';
        mainContent.style.position = '';
      }
    };
  }, []);

  useEffect(() => {
    setFetching(true);
    // Fetch a massive chunk of data ONCE on mount to ensure 0 lag during panning
    fetchMapTenders(INDIA_DEFAULT_BOUNDS)
      .then(d => {
        setTenders(d || []);
        setError(null);
      })
      .catch(() => setError('Failed to load map data.'))
      .finally(() => {
        setLoading(false);
        setFetching(false);
      });
  }, []);

  const filtered = useMemo(() => {
    return tenders.filter(t => {
      if (filterMode === 'single' && t.is_single_bid !== 1) return false;
      if (filterMode === 'regular' && t.is_single_bid === 1) return false;
      if (portal !== 'all' && t.portal_type !== portal) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (t.title || '').toLowerCase().includes(q) ||
               (t.org_name || '').toLowerCase().includes(q) ||
               (t.resolved_address || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [tenders, filterMode, portal, searchQuery]);

  const geojsonData = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: filtered.map(t => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [t.lon, t.lat] },
        properties: t // pass reference directly to avoid slow object spread
      }))
    };
  }, [filtered]);

  const stats = useMemo(() => {
    let singleBid = 0;
    let totalValue = 0;
    for (let i = 0; i < filtered.length; i++) {
      const t = filtered[i];
      if (t.is_single_bid === 1) singleBid++;
      if (t.contract_value) totalValue += t.contract_value;
    }
    return { total: filtered.length, singleBid, totalValue };
  }, [filtered]);

  const handleStateChange = (e) => {
    const val = e.target.value;
    setSelectedState(val);
    if (val && STATE_COORDS[val] && mapRef.current) {
      mapRef.current.flyTo({
        center: STATE_COORDS[val].center,
        zoom: STATE_COORDS[val].zoom,
        duration: 1500
      });
    }
  };

  // No-op to prevent re-fetching on pan (massive performance boost)
  const handleMoveEnd = useCallback(() => {}, []);

  const onClick = useCallback((event) => {
    const feature = event.features[0];
    if (!feature) {
      setPopupInfo(null);
      return;
    }

    if (feature.layer.id === 'clusters') {
      const clusterId = feature.properties.cluster_id;
      const mapboxSource = mapRef.current.getSource('tenders');
      
      mapboxSource.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        mapRef.current.easeTo({
          center: feature.geometry.coordinates,
          zoom: zoom + 1,
          duration: 500
        });
      });
    } else if (feature.layer.id === 'unclustered-point') {
      setPopupInfo(feature.properties);
    }
  }, []);

  const handleInspect = (item) => {
    window.dispatchEvent(new CustomEvent('openTenderModal', { detail: item }));
  };

  if (loading) return (
    <div className="map-fullscreen-loader">
      <div className="map-loader-inner">
        <Loader2 size={32} className="spin" />
        <span>Initializing hardware-accelerated map…</span>
      </div>
    </div>
  );

  return (
    <div className="map-fullscreen-root">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 82,
          latitude: 22.5,
          zoom: 4
        }}
        mapStyle={isDark ? MAP_STYLES.dark : MAP_STYLES.light}
        onMoveEnd={handleMoveEnd}
        onClick={onClick}
        interactiveLayerIds={['clusters', 'unclustered-point']}
        className="map-container"
        minZoom={3}
      >
        <NavigationControl position="bottom-right" />

        <Source
          id="tenders"
          type="geojson"
          data={geojsonData}
          cluster={true}
          clusterMaxZoom={13}
          clusterRadius={50}
        >
          <Layer
            id="clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': ['step', ['get', 'point_count'], '#6366f1', 100, '#4f46e5', 750, '#4338ca'],
              'circle-radius': ['step', ['get', 'point_count'], 16, 100, 22, 750, 28],
              'circle-stroke-width': 2,
              'circle-stroke-color': 'rgba(255,255,255,0.4)'
            }}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': '{point_count_abbreviated}',
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-size': 11
            }}
            paint={{ 'text-color': '#ffffff' }}
          />
          <Layer
            id="unclustered-point"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-color': ['case', ['==', ['get', 'is_single_bid'], 1], '#ef4444', '#6366f1'],
              'circle-radius': 5,
              'circle-stroke-width': 2,
              'circle-stroke-color': 'rgba(255,255,255,0.8)'
            }}
          />
        </Source>

        {popupInfo && (
          <Popup
            anchor="bottom"
            longitude={Number(popupInfo.lon)}
            latitude={Number(popupInfo.lat)}
            onClose={() => setPopupInfo(null)}
            closeButton={true}
            closeOnClick={false}
            className="maplibre-popup"
            maxWidth="280px"
          >
            <div className="popup-inner">
              <div className={`popup-badge ${popupInfo.is_single_bid === 1 ? 'badge-red' : 'badge-blue'}`}>
                {popupInfo.is_single_bid === 1 ? <><ShieldAlert size={11} /> Single-Bid Risk</> : <><Building size={11} /> Regular</>}
              </div>
              <div className="popup-title">{popupInfo.title || '—'}</div>
              <div className="popup-row"><span>Dept</span><span>{(popupInfo.org_name || '').split('||')[0]}</span></div>
              {popupInfo.bidder_name && <div className="popup-row"><span>Winner</span><span>{popupInfo.bidder_name}</span></div>}
              <div className="popup-row"><span>Location</span><span>{(popupInfo.resolved_address || '').split(',').slice(0, 3).join(',')}</span></div>
              <div className="popup-footer">
                <span className="popup-value">{fmtCr(popupInfo.contract_value)}</span>
                <button onClick={() => handleInspect(popupInfo)} className="popup-btn">Inspect →</button>
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* Floating filter pills - top center */}
      <div className="map-top-pills">
        {['all', 'single', 'regular'].map(m => (
          <button key={m} onClick={() => setFilterMode(m)} className={`pill ${filterMode === m ? 'pill-active' : ''}`}>
            {m === 'all' ? 'All Tenders' : m === 'single' ? '🔴 Single-Bid Only' : '🔵 Regular Only'}
          </button>
        ))}
        <button onClick={() => setPortal(p => p === 'all' ? 'central' : p === 'central' ? 'state' : 'all')} className={`pill ${portal !== 'all' ? 'pill-active' : ''}`}>
          {portal === 'all' ? 'All Portals' : portal === 'central' ? 'Central Portal' : 'State Portal'}
        </button>
      </div>

      {/* Floating intelligence panel */}
      {panelOpen ? (
        <div className="map-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Procurement Map
                {fetching && <Loader2 size={13} className="spin" style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />}
              </div>
              <div className="panel-sub">India · Geocoded Tenders</div>
            </div>
            <button onClick={() => setPanelOpen(false)} className="panel-close"><X size={14} /></button>
          </div>

          <div className="panel-stats">
            <div className="stat-block">
              <div className="stat-val">{stats.total.toLocaleString()}</div>
              <div className="stat-lbl">Visible</div>
            </div>
            <div className="stat-block">
              <div className="stat-val" style={{ color: '#ef4444' }}>{stats.singleBid.toLocaleString()}</div>
              <div className="stat-lbl">Single-Bid</div>
            </div>
            <div className="stat-block">
              <div className="stat-val" style={{ color: '#10b981' }}>{fmtBig(stats.totalValue)}</div>
              <div className="stat-lbl">Total Value</div>
            </div>
          </div>

          <div className="panel-state-select" style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Focus State</div>
            <select
              value={selectedState}
              onChange={handleStateChange}
              style={{
                width: '100%',
                padding: '8px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                color: '#e2e8f0',
                fontSize: '12.5px',
                outline: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              <option value="" style={{ background: 'transparent' }}>All India</option>
              {Object.keys(STATE_COORDS).sort().map(s => (
                <option key={s} value={s} style={{ background: '#0a0c14' }}>{s}</option>
              ))}
            </select>
          </div>

          <div className="panel-search">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search org, title, location…"
              className="search-input"
            />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="search-clear"><X size={13} /></button>}
          </div>

          <div className="panel-legend">
            <div className="legend-item"><span className="dot dot-red" /><span>Single-Bid (High Risk)</span></div>
            <div className="legend-item"><span className="dot dot-blue" /><span>Regular Procurement</span></div>
          </div>

          <div className="panel-results">
            <div className="results-header">
              <TrendingUp size={13} />
              <span>Top by value</span>
            </div>
            {filtered.slice(0, 6).map((t, i) => (
              <div key={i} className="result-row" onClick={() => handleInspect(t)}>
                <span className={`result-dot ${t.is_single_bid === 1 ? 'dot-red' : 'dot-blue'}`} />
                <div className="result-info">
                  <div className="result-title">{(t.title || '').slice(0, 48)}{t.title?.length > 48 ? '…' : ''}</div>
                  <div className="result-meta">{(t.org_name || '').split('||')[0].slice(0, 30)}</div>
                </div>
                <div className="result-val">{fmtCr(t.contract_value)}</div>
              </div>
            ))}
          </div>

          <div className="panel-footer">
            <Info size={11} />
            <span>MapLibre GL · Hardware Accelerated</span>
          </div>
        </div>
      ) : (
        <button onClick={() => setPanelOpen(true)} className="panel-reopen">
          <MapPin size={14} /> Area Intelligence
        </button>
      )}
    </div>
  );
}
