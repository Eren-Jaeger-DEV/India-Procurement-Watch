import { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { fetchMapTenders } from '../lib/api';
import { Search, AlertTriangle, ShieldAlert, Building, Loader2, Layers, X, Info, TrendingUp } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './MapExplorer.css';

// Fix leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom dot icons
const createPinIcon = (color, size = 10) => new L.DivIcon({
  html: `<div class="map-pin" style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 6px ${color}88;"></div>`,
  className: '',
  iconSize: [size, size],
  iconAnchor: [size / 2, size / 2],
});

// Custom cluster icon
const createClusterIcon = (cluster) => {
  const count = cluster.getChildCount();
  const size = count > 1000 ? 48 : count > 100 ? 40 : 32;
  const color = '#6366f1';
  return new L.DivIcon({
    html: `<div class="cluster-icon" style="width:${size}px;height:${size}px;line-height:${size}px;background:${color};border:2px solid rgba(255,255,255,0.3);border-radius:50%;text-align:center;font-size:${size > 40 ? 13 : 11}px;font-weight:700;color:white;box-shadow:0 0 12px ${color}66;">${count > 999 ? Math.round(count / 1000) + 'k' : count}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const fmtCr = (v) => v ? `₹${(v / 1e7).toFixed(1)}Cr` : '—';
const fmtBig = (n) => n >= 1e7 ? `₹${(n / 1e7).toFixed(0)}Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(0)}L` : `₹${n?.toLocaleString()}`;

// Fit India bounds on load
function FitIndia() {
  const map = useMap();
  useEffect(() => { map.setView([22.5, 82], 5); }, [map]);
  return null;
}

// Controller to fly the map view to a specific coordinate / zoom
function MapFlyController({ flyTo }) {
  const map = useMap();
  useEffect(() => {
    if (flyTo) {
      map.flyTo(flyTo.center, flyTo.zoom, { animate: true, duration: 1.5 });
    }
  }, [flyTo, map]);
  return null;
}

// Bounding box handler to capture viewport coordinates
function MapBoundsHandler({ onBoundsChange }) {
  const map = useMapEvents({
    moveend() {
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      onBoundsChange({
        min_lat: sw.lat,
        max_lat: ne.lat,
        min_lon: sw.lng,
        max_lon: ne.lng,
      });
    },
  });

  useEffect(() => {
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    onBoundsChange({
      min_lat: sw.lat,
      max_lat: ne.lat,
      min_lon: sw.lng,
      max_lon: ne.lng,
    });
  }, [map]);

  return null;
}

const STATE_COORDS = {
  "Andaman & Nicobar": { center: [11.7401, 92.6586], zoom: 7 },
  "Andhra Pradesh": { center: [15.9129, 79.7400], zoom: 7 },
  "Arunachal Pradesh": { center: [28.2180, 94.7278], zoom: 7 },
  "Assam": { center: [26.2006, 92.9376], zoom: 7 },
  "Bihar": { center: [25.0961, 85.3131], zoom: 7 },
  "Chandigarh": { center: [30.7333, 76.7794], zoom: 11 },
  "Chhattisgarh": { center: [21.2787, 81.8661], zoom: 7 },
  "Delhi": { center: [28.6139, 77.2090], zoom: 10 },
  "Goa": { center: [15.2993, 74.1240], zoom: 9 },
  "Gujarat": { center: [22.2587, 71.1924], zoom: 7 },
  "Haryana": { center: [29.0588, 76.0856], zoom: 7 },
  "Himachal Pradesh": { center: [31.1048, 77.1734], zoom: 7 },
  "Jammu & Kashmir": { center: [34.0837, 74.7973], zoom: 7 },
  "Jharkhand": { center: [23.6102, 85.2799], zoom: 7 },
  "Karnataka": { center: [15.3173, 75.7139], zoom: 7 },
  "Kerala": { center: [10.8505, 76.2711], zoom: 7 },
  "Ladakh": { center: [34.1526, 77.5770], zoom: 7 },
  "Madhya Pradesh": { center: [22.9734, 78.6569], zoom: 6 },
  "Maharashtra": { center: [19.7515, 75.7139], zoom: 7 },
  "Manipur": { center: [24.6637, 93.9063], zoom: 8 },
  "Meghalaya": { center: [25.4670, 91.3662], zoom: 8 },
  "Mizoram": { center: [23.1645, 92.9376], zoom: 8 },
  "Nagaland": { center: [26.1584, 94.5624], zoom: 8 },
  "Odisha": { center: [20.9517, 85.0985], zoom: 7 },
  "Puducherry": { center: [11.9416, 79.8083], zoom: 10 },
  "Punjab": { center: [31.1471, 75.3412], zoom: 8 },
  "Rajasthan": { center: [27.0238, 74.2179], zoom: 7 },
  "Sikkim": { center: [27.5330, 88.5122], zoom: 9 },
  "Tamil Nadu": { center: [11.1271, 78.6569], zoom: 7 },
  "Telangana": { center: [18.1124, 79.0193], zoom: 7 },
  "Tripura": { center: [23.9408, 91.9882], zoom: 9 },
  "Uttar Pradesh": { center: [26.8467, 80.9462], zoom: 7 },
  "Uttarakhand": { center: [30.0668, 79.0193], zoom: 7 },
  "West Bengal": { center: [22.9868, 87.8550], zoom: 7 }
};

const TILE_LAYERS = {
  dark:    { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',   label: 'Dark' },
  osm:     { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',              label: 'Streets' },
  hybrid:  { url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',             label: 'Satellite' },
};

const INDIA_DEFAULT_BOUNDS = {
  min_lat: 6.0,
  max_lat: 38.0,
  min_lon: 68.0,
  max_lon: 98.0
};

const MapExplorer = () => {
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [bounds, setBounds] = useState(INDIA_DEFAULT_BOUNDS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'single' | 'regular'
  const [portal, setPortal] = useState('all');
  const [tileKey, setTileKey] = useState('dark');
  const [panelOpen, setPanelOpen] = useState(true);
  const [layerOpen, setLayerOpen] = useState(false);
  const [selectedState, setSelectedState] = useState('');
  const [flyTo, setFlyTo] = useState(null);

  const handleStateChange = (e) => {
    const val = e.target.value;
    setSelectedState(val);
    if (val && STATE_COORDS[val]) {
      setFlyTo(STATE_COORDS[val]);
    }
  };

  useEffect(() => {
    if (!bounds) return;
    setFetching(true);
    fetchMapTenders(bounds)
      .then(d => {
        setTenders(d || []);
        setError(null);
      })
      .catch(() => setError('Failed to load map data.'))
      .finally(() => {
        setLoading(false);
        setFetching(false);
      });
  }, [bounds]);

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

  const stats = useMemo(() => ({
    total: filtered.length,
    singleBid: filtered.filter(t => t.is_single_bid === 1).length,
    totalValue: filtered.reduce((s, t) => s + (t.contract_value || 0), 0),
  }), [filtered]);

  const handleInspect = (item) => {
    window.dispatchEvent(new CustomEvent('openTenderModal', { detail: item }));
  };

  if (loading) return (
    <div className="map-fullscreen-loader">
      <div className="map-loader-inner">
        <Loader2 size={32} className="spin" />
        <span>Loading procurement map…</span>
      </div>
    </div>
  );

  if (error && tenders.length === 0) return (
    <div className="map-fullscreen-loader">
      <div className="map-error-card">
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    </div>
  );

  const tileLayer = TILE_LAYERS[tileKey];

  return (
    <div className="map-fullscreen-root">
      {/* Full-viewport map */}
      <MapContainer
        center={[22.5, 82]}
        zoom={5}
        zoomControl={false}
        className="map-leaflet-container"
        preferCanvas
      >
        <TileLayer key={tileKey} url={tileLayer.url} />
        <ZoomControl position="bottomright" />
        <FitIndia />
        <MapBoundsHandler onBoundsChange={setBounds} />
        <MapFlyController flyTo={flyTo} />

        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createClusterIcon}
          maxClusterRadius={60}
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
          zoomToBoundsOnClick
        >
          {filtered.map((item, idx) => (
            <Marker
              key={`${item.internal_id || idx}`}
              position={[item.lat, item.lon]}
              icon={createPinIcon(item.is_single_bid === 1 ? '#ef4444' : '#6366f1')}
            >
              <Popup className="map-popup" maxWidth={260}>
                <div className="popup-inner">
                  <div className={`popup-badge ${item.is_single_bid === 1 ? 'badge-red' : 'badge-blue'}`}>
                    {item.is_single_bid === 1 ? <><ShieldAlert size={11} /> Single-Bid Risk</> : <><Building size={11} /> Regular</>}
                  </div>
                  <div className="popup-title">{item.title || '—'}</div>
                  <div className="popup-row"><span>Dept</span><span>{(item.org_name || '').split('||')[0]}</span></div>
                  {item.bidder_name && <div className="popup-row"><span>Winner</span><span>{item.bidder_name}</span></div>}
                  <div className="popup-row"><span>Location</span><span>{(item.resolved_address || '').split(',').slice(0, 3).join(',')}</span></div>
                  <div className="popup-footer">
                    <span className="popup-value">{fmtCr(item.contract_value)}</span>
                    <button onClick={() => handleInspect(item)} className="popup-btn">Inspect →</button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>

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

      {/* Layer switcher - top right */}
      <div className="map-layer-switcher">
        <button onClick={() => setLayerOpen(o => !o)} className="layer-btn" title="Switch map layer">
          <Layers size={18} />
        </button>
        {layerOpen && (
          <div className="layer-menu">
            {Object.entries(TILE_LAYERS).map(([k, v]) => (
              <button key={k} onClick={() => { setTileKey(k); setLayerOpen(false); }} className={`layer-option ${tileKey === k ? 'layer-active' : ''}`}>
                {v.label}
              </button>
            ))}
          </div>
        )}
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

          {/* Stats */}
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

          {/* State Selector */}
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
              <option value="" style={{ background: '#0a0c14' }}>All India</option>
              {Object.keys(STATE_COORDS).sort().map(s => (
                <option key={s} value={s} style={{ background: '#0a0c14' }}>{s}</option>
              ))}
            </select>
          </div>


          {/* Search */}
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

          {/* Legend */}
          <div className="panel-legend">
            <div className="legend-item"><span className="dot dot-red" /><span>Single-Bid (High Risk)</span></div>
            <div className="legend-item"><span className="dot dot-blue" /><span>Regular Procurement</span></div>
          </div>

          {/* Recent results preview */}
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
            <span>Geocoded via Nominatim · OSM Data</span>
          </div>
        </div>
      ) : (
        <button onClick={() => setPanelOpen(true)} className="panel-reopen">
          Area Intelligence
        </button>
      )}
    </div>
  );
};

export default MapExplorer;
