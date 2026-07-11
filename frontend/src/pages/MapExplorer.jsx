import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import debounce from 'lodash.debounce';
import Map, { Source, Layer, NavigationControl, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { fetchMapTenders, fetchLocations } from '../lib/api';
import { Search, AlertTriangle, ShieldAlert, Building, Loader2, Layers, X, Info, TrendingUp, MapPin, ChevronDown, Check } from 'lucide-react';
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
  
  const [popupInfo, setPopupInfo] = useState(null);
  const [popupReverseData, setPopupReverseData] = useState(null);

  useEffect(() => {
    if (popupInfo) {
      setPopupReverseData(null);
      fetch(`https://nominatim.satviks.dev/reverse?lat=${popupInfo.lat}&lon=${popupInfo.lon}&format=jsonv2&addressdetails=1&key=4ec7ecc992cbd862b27fae04790e6796c97c91d64158f57f`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) setPopupReverseData(data);
        })
        .catch(err => console.error("Reverse geocoding failed", err));
    }
  }, [popupInfo]);

  // Geocoding States
  const [geoQuery, setGeoQuery] = useState('');
  const [geoResults, setGeoResults] = useState([]);
  const [showGeoDropdown, setShowGeoDropdown] = useState(false);
  const [isGeoLoading, setIsGeoLoading] = useState(false);
  const [contextLocation, setContextLocation] = useState(null);
  const [locationsData, setLocationsData] = useState({});
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [viewBounds, setViewBounds] = useState(null);

  const fetchFilteredTenders = (params = {}) => {
    setFetching(true);
    fetchMapTenders(params)
      .then(d => {
        setTenders(d || []);
        setError(null);
      })
      .catch(() => setError('Failed to load map data.'))
      .finally(() => {
        setFetching(false);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLocations().then(data => setLocationsData(data || {})).catch(() => {});
    fetchFilteredTenders(INDIA_DEFAULT_BOUNDS);
  }, []);

  useEffect(() => {
    if (!geoQuery.trim() || geoQuery.length < 3) {
      setGeoResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setIsGeoLoading(true);
      fetch(`https://nominatim.satviks.dev/search?q=${encodeURIComponent(geoQuery)}&countrycodes=in&format=jsonv2&limit=5&key=4ec7ecc992cbd862b27fae04790e6796c97c91d64158f57f`)
        .then(res => res.json())
        .then(data => {
          setGeoResults(data || []);
          setIsGeoLoading(false);
        })
        .catch(err => {
          console.error("Geocoding failed", err);
          setIsGeoLoading(false);
        });
    }, 600);
    return () => clearTimeout(timer);
  }, [geoQuery]);

  const handleGeoSelect = (place) => {
    if (mapRef.current && place.boundingbox) {
      const [latS, latN, lonW, lonE] = place.boundingbox;
      
      const boundsParams = {
        min_lat: Number(latS),
        max_lat: Number(latN),
        min_lon: Number(lonW),
        max_lon: Number(lonE)
      };
      
      mapRef.current.fitBounds([
        [Number(lonW), Number(latS)],
        [Number(lonE), Number(latN)]
      ], { padding: 40, duration: 2000 });
      
      // TRIGGER THE SPATIAL FILTER ON THE POSTGRES DATABASE
      fetchFilteredTenders(boundsParams);
      setBounds(boundsParams);
    }
    const title = place.display_name.split(',')[0].trim();
    setGeoQuery(title);
    setShowGeoDropdown(false);
  };

  const handleDropdownSelect = (type, value, state = null) => {
    setShowLocationDropdown(false);
    
    if (type === 'all') {
      setContextLocation(null);
      fetchFilteredTenders(INDIA_DEFAULT_BOUNDS);
      setBounds(INDIA_DEFAULT_BOUNDS);
      if (mapRef.current) {
        mapRef.current.fitBounds([
          [INDIA_DEFAULT_BOUNDS.min_lon, INDIA_DEFAULT_BOUNDS.min_lat],
          [INDIA_DEFAULT_BOUNDS.max_lon, INDIA_DEFAULT_BOUNDS.max_lat]
        ], { padding: 40, duration: 2000 });
      }
      return;
    }

    setContextLocation({ type, value, state });
    
    const query = type === 'state' ? `${value}, India` : `${value}, ${state}, India`;
    
    fetch(`https://nominatim.satviks.dev/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&key=4ec7ecc992cbd862b27fae04790e6796c97c91d64158f57f`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0 && mapRef.current) {
          const place = data[0];
          const [latS, latN, lonW, lonE] = place.boundingbox;
          
          const boundsParams = {
            min_lat: Number(latS),
            max_lat: Number(latN),
            min_lon: Number(lonW),
            max_lon: Number(lonE)
          };
          
          mapRef.current.fitBounds([
            [Number(lonW), Number(latS)],
            [Number(lonE), Number(latN)]
          ], { padding: 40, duration: 2000 });
          
          fetchFilteredTenders(boundsParams);
          setBounds(boundsParams);
        } else {
          fetchFilteredTenders({state, city: type === 'city' ? value : undefined});
        }
      })
      .catch(() => {
        fetchFilteredTenders({state, city: type === 'city' ? value : undefined});
      });
  };

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

  const filtered = useMemo(() => {
    let res = tenders;
    if (filterMode === 'single') res = res.filter(t => t.is_single_bid === 1);
    if (filterMode === 'regular') res = res.filter(t => t.is_single_bid === 0);
    if (portal !== 'all') res = res.filter(t => t.portal === portal);
    
    if (searchQuery) {
      const sq = searchQuery.toLowerCase();
      res = res.filter(t => 
        (t.title || '').toLowerCase().includes(sq) || 
        (t.org_name || '').toLowerCase().includes(sq) ||
        (t.resolved_address || '').toLowerCase().includes(sq)
      );
    }
    
    if (viewBounds) {
      res = res.filter(t => {
        const lng = Number(t.lon);
        const lat = Number(t.lat);
        if (isNaN(lng) || isNaN(lat)) return false;
        return lat >= viewBounds.minLat && lat <= viewBounds.maxLat &&
               lng >= viewBounds.minLng && lng <= viewBounds.maxLng;
      });
    }
    return res;
  }, [tenders, filterMode, portal, searchQuery, viewBounds]);

  const handleMapChange = () => {
    if (!mapRef.current) return;
    const bounds = mapRef.current.getBounds();
    setViewBounds({
      minLng: bounds.getWest(),
      minLat: bounds.getSouth(),
      maxLng: bounds.getEast(),
      maxLat: bounds.getNorth()
    });
  };

  const geojsonData = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: filtered.map(t => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [t.lon, t.lat] },
        properties: t
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

  const onClick = useCallback((event) => {
    const feature = event.features[0];
    if (!feature) {
      setPopupInfo(null);
      return;
    }

    if (feature.layer.id === 'clusters' || feature.layer.id === 'cluster-count') {
      const clusterId = feature.properties.cluster_id;
      const mapboxSource = mapRef.current.getMap().getSource('tenders');
      
      mapboxSource.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        mapRef.current.easeTo({
          center: feature.geometry.coordinates,
          zoom: zoom,
          duration: 500
        });
      });
    } else if (feature.layer.id === 'unclustered-point') {
      setPopupInfo(feature.properties);
    }
  }, []);

  const onMouseEnter = useCallback(() => {
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = 'pointer';
  }, []);
  
  const onMouseLeave = useCallback(() => {
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = '';
  }, []);

  const handleInspect = (item) => {
    window.dispatchEvent(new CustomEvent('openTenderModal', { detail: item }));
  };

  const [loadingText, setLoadingText] = useState('Establishing secure connection...');
  useEffect(() => {
    if (!loading) return;
    const texts = [
      'Establishing secure connection...',
      'Fetching procurement records...',
      'Geocoding tender locations...',
      'Initializing hardware-accelerated map...'
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % texts.length;
      setLoadingText(texts[i]);
    }, 800);
    return () => clearInterval(interval);
  }, [loading]);

  if (loading) return (
    <div className="map-fullscreen-loader">
      <div className="minimal-loader-container">
        <div className="minimal-loader-brand">INDIA PROCUREMENT WATCH</div>
        <div className="minimal-loader-title">Area Intelligence</div>
        <div className="minimal-loader-bar">
          <div className="minimal-loader-progress"></div>
        </div>
        <div className="minimal-loader-text">{loadingText}</div>
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
        onMoveEnd={handleMapChange}
        onLoad={handleMapChange}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        interactiveLayerIds={['clusters', 'cluster-count', 'unclustered-point']}
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
                <div className="popup-row">
                  <span>Location</span>
                  <span>
                    {popupReverseData 
                      ? (popupReverseData.address?.city || popupReverseData.address?.town || popupReverseData.address?.county || popupReverseData.address?.state_district || popupReverseData.address?.state || '').split(',')[0] 
                        + (popupReverseData.address?.state ? `, ${popupReverseData.address.state}` : '')
                      : <Loader2 size={10} className="spin" />
                    }
                  </span>
                </div>
              <div className="popup-footer">
                <span className="popup-value">{fmtCr(popupInfo.contract_value)}</span>
                <button onClick={() => handleInspect(popupInfo)} className="popup-btn">Inspect →</button>
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* Top Global Search Engine */}
      <div className="map-top-search-container">
        <div className="map-top-search-bar">
          
          {/* Location Context Dropdown */}
          <div className="search-context-wrapper" style={{ position: 'relative' }}>
            <div 
              className="search-location-pill" 
              onClick={() => setShowLocationDropdown(!showLocationDropdown)}
              style={{ cursor: 'pointer' }}
            >
              <MapPin size={14} style={{ color: '#94a3b8' }} />
              <span>{contextLocation ? contextLocation.value : 'India'}</span>
              <ChevronDown size={14} style={{ color: '#64748b', marginLeft: '4px' }} />
            </div>
            
            {showLocationDropdown && (
              <div className="context-dropdown" onWheel={(e) => e.stopPropagation()}>
                <div 
                  className="context-item"
                  onClick={(e) => { e.stopPropagation(); handleDropdownSelect('all', null); }}
                  style={{ fontWeight: !contextLocation ? 700 : 400 }}
                >
                  <MapPin size={14} style={{ color: '#64748b' }} />
                  <span>All India</span>
                  {!contextLocation && <Check size={14} style={{ color: '#10b981', marginLeft: 'auto' }} />}
                </div>

                {Object.keys(locationsData).map(state => (
                  <React.Fragment key={state}>
                    <div 
                      className="context-item" 
                      style={{ fontWeight: 600, color: 'var(--accent-primary)', marginTop: 4, background: 'rgba(99, 102, 241, 0.05)' }} 
                      onClick={(e) => { e.stopPropagation(); handleDropdownSelect('state', state); }}
                    >
                      {state} {contextLocation?.value === state && <Check size={14} color="#10b981" style={{marginLeft:'auto'}}/>}
                    </div>
                    {(locationsData[state] || []).map(city => (
                      <div 
                        className="context-item" 
                        key={`${state}-${city}`} 
                        style={{ paddingLeft: '32px', fontSize: '12px' }} 
                        onClick={(e) => { e.stopPropagation(); handleDropdownSelect('city', city, state); }}
                      >
                        {city} {contextLocation?.value === city && <Check size={14} color="#10b981" style={{marginLeft:'auto'}}/>}
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          <div className="search-divider"></div>
          <div className="search-input-wrapper">
            <Search size={14} style={{ color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search cities, states, districts..."
              value={geoQuery}
              onChange={(e) => {
                setGeoQuery(e.target.value);
                setShowGeoDropdown(true);
              }}
              onFocus={() => setShowGeoDropdown(true)}
              onBlur={() => setTimeout(() => setShowGeoDropdown(false), 200)}
            />
            {isGeoLoading && <Loader2 size={14} className="spin" style={{ color: '#6366f1' }} />}
          </div>
        </div>

        {/* Rich Autocomplete Dropdown */}
        {showGeoDropdown && geoResults.length > 0 && (
          <div className="map-top-autocomplete" onWheel={(e) => e.stopPropagation()}>
            {geoResults.map((place, idx) => {
              const parts = place.display_name.split(',');
              const title = parts[0].trim();
              const subtitle = parts.slice(1).join(',').trim();
              return (
                <div 
                  key={idx}
                  onClick={() => handleGeoSelect(place)}
                  className="autocomplete-item"
                >
                  <div className="ac-title">{title}</div>
                  <div className="ac-subtitle">{subtitle}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
