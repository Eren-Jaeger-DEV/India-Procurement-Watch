import React, { useEffect, useState, useRef, useCallback } from 'react';
import Map, { Source, Layer, NavigationControl, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Search, Loader2, MapPin, Layers, Info, Check, ChevronRight, Hash, X } from 'lucide-react';
import './MapExplorer.css';

const INDIA_DEFAULT_BOUNDS = {
  min_lat: 6.0,
  max_lat: 38.0,
  min_lon: 68.0,
  max_lon: 98.0
};

const MAP_STYLES = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
};

const NOMINATIM_BASE = 'https://nominatim.satviks.dev';
const API_KEY = '4ec7ecc992cbd862b27fae04790e6796c97c91d64158f57f';

export default function MapExplorer() {
  const mapRef = useRef(null);
  
  const [isDark, setIsDark] = useState(() => document.body.classList.contains('dark-theme'));
  
  // Search state
  const [geoQuery, setGeoQuery] = useState('');
  const [geoResults, setGeoResults] = useState([]);
  const [showGeoDropdown, setShowGeoDropdown] = useState(false);
  const [isGeoLoading, setIsGeoLoading] = useState(false);
  
  // Inspector state
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isInspecting, setIsInspecting] = useState(false);
  
  // Map drawing state
  const [markerCoords, setMarkerCoords] = useState(null);
  const [bboxGeoJSON, setBboxGeoJSON] = useState(null);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.body.classList.contains('dark-theme'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Forward Geocoding Search
  useEffect(() => {
    if (!geoQuery.trim() || geoQuery.length < 3) {
      setGeoResults([]);
      setIsGeoLoading(false);
      return;
    }
    
    setIsGeoLoading(true);
    const timer = setTimeout(() => {
      fetch(`${NOMINATIM_BASE}/search?q=${encodeURIComponent(geoQuery)}&format=jsonv2&limit=5&addressdetails=1`, {
        headers: { 'X-API-Key': API_KEY }
      })
        .then(res => res.json())
        .then(data => {
          setGeoResults(data || []);
        })
        .catch(() => setGeoResults([]))
        .finally(() => setIsGeoLoading(false));
    }, 400);
    
    return () => clearTimeout(timer);
  }, [geoQuery]);

  const parseBoundingBox = (bboxStrArr) => {
    if (!bboxStrArr || bboxStrArr.length !== 4) return null;
    const [minLat, maxLat, minLon, maxLon] = bboxStrArr.map(parseFloat);
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [minLon, minLat],
            [maxLon, minLat],
            [maxLon, maxLat],
            [minLon, maxLat],
            [minLon, minLat]
          ]]
        }
      }]
    };
  };

  const handleGeoSelect = (place) => {
    setGeoQuery(place.name || place.display_name.split(',')[0]);
    setShowGeoDropdown(false);
    
    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);
    
    setMarkerCoords({ lat, lon });
    setSelectedLocation(place);
    setIsInspecting(true);
    
    const bboxData = parseBoundingBox(place.boundingbox);
    setBboxGeoJSON(bboxData);

    if (mapRef.current) {
      if (bboxData) {
        const [minLat, maxLat, minLon, maxLon] = place.boundingbox.map(parseFloat);
        mapRef.current.fitBounds(
          [[minLon, minLat], [maxLon, maxLat]],
          { padding: 100, duration: 2000 }
        );
      } else {
        mapRef.current.flyTo({ center: [lon, lat], zoom: 14, duration: 2000 });
      }
    }
  };

  // Reverse Geocoding on Map Click
  const onMapClick = useCallback((e) => {
    const { lng, lat } = e.lngLat;
    setMarkerCoords({ lat, lon: lng });
    setBboxGeoJSON(null);
    setIsInspecting(true);
    setSelectedLocation({ _loading: true, lat, lon: lng });
    
    fetch(`${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1`, {
      headers: { 'X-API-Key': API_KEY }
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setSelectedLocation({ error: data.error, lat, lon: lng });
        } else {
          setSelectedLocation(data);
          if (data.boundingbox) {
             setBboxGeoJSON(parseBoundingBox(data.boundingbox));
          }
        }
      })
      .catch(err => {
        setSelectedLocation({ error: 'Failed to reverse geocode', lat, lon: lng });
      });
  }, []);

  return (
    <div className="map-explorer-container">
      <Map
        ref={mapRef}
        initialViewState={{
          bounds: [
            [INDIA_DEFAULT_BOUNDS.min_lon, INDIA_DEFAULT_BOUNDS.min_lat],
            [INDIA_DEFAULT_BOUNDS.max_lon, INDIA_DEFAULT_BOUNDS.max_lat]
          ],
          fitBoundsOptions: { padding: 40 }
        }}
        mapStyle={isDark ? MAP_STYLES.dark : MAP_STYLES.light}
        onClick={onMapClick}
        interactiveLayerIds={[]}
        cursor="crosshair"
      >
        <NavigationControl position="bottom-left" showCompass={false} />

        {/* Marker for selected point */}
        {markerCoords && (
          <Marker longitude={markerCoords.lon} latitude={markerCoords.lat} anchor="bottom">
            <div style={{ color: '#ef4444', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}>
              <MapPin size={32} strokeWidth={2.5} fill="#fee2e2" />
            </div>
          </Marker>
        )}

        {/* Bounding Box Polygon */}
        {bboxGeoJSON && (
          <Source id="bbox-src" type="geojson" data={bboxGeoJSON}>
            <Layer 
              id="bbox-fill" 
              type="fill" 
              paint={{
                'fill-color': '#6366f1',
                'fill-opacity': 0.1
              }} 
            />
            <Layer 
              id="bbox-line" 
              type="line" 
              paint={{
                'line-color': '#6366f1',
                'line-width': 2,
                'line-dasharray': [2, 2]
              }} 
            />
          </Source>
        )}
      </Map>

      {/* Top Search Engine */}
      <div className="map-top-search-container" style={{ maxWidth: '600px', left: '50%', transform: 'translateX(-50%)', margin: '20px 0' }}>
        <div className="map-top-search-bar" style={{ padding: '0 16px' }}>
          <div className="search-input-wrapper" style={{ width: '100%', padding: '12px 0' }}>
            <Search size={18} style={{ color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search via Nominatim API..."
              value={geoQuery}
              onChange={(e) => {
                setGeoQuery(e.target.value);
                setShowGeoDropdown(true);
              }}
              onFocus={() => setShowGeoDropdown(true)}
              onBlur={() => setTimeout(() => setShowGeoDropdown(false), 200)}
              style={{ fontSize: '16px' }}
            />
            {isGeoLoading && <Loader2 size={18} className="spin" style={{ color: '#6366f1' }} />}
          </div>
        </div>

        {showGeoDropdown && geoResults.length > 0 && (
          <div className="map-top-autocomplete">
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

      {/* Inspector Sidebar */}
      {isInspecting && selectedLocation && (
        <div className="nominatim-inspector-panel">
          <div className="inspector-header">
            <h3>API Data Inspector</h3>
            <button className="inspector-close" onClick={() => { setIsInspecting(false); setBboxGeoJSON(null); setMarkerCoords(null); }}>
              <X size={18} />
            </button>
          </div>
          
          <div className="inspector-content">
            {selectedLocation._loading ? (
              <div className="inspector-loading">
                <Loader2 size={24} className="spin" />
                <span>Reverse geocoding...</span>
              </div>
            ) : selectedLocation.error ? (
              <div className="inspector-error">
                {selectedLocation.error}
              </div>
            ) : (
              <>
                <div className="inspector-section">
                  <h4>Core Identification</h4>
                  <div className="data-row">
                    <span className="data-key">Name</span>
                    <span className="data-value highlight">{selectedLocation.name || 'N/A'}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-key">Display Name</span>
                    <span className="data-value">{selectedLocation.display_name}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-key">Place ID</span>
                    <span className="data-value mono">{selectedLocation.place_id}</span>
                  </div>
                </div>

                <div className="inspector-section">
                  <h4>OpenStreetMap Entities</h4>
                  <div className="data-row">
                    <span className="data-key">OSM Type</span>
                    <span className="data-value tag">{selectedLocation.osm_type}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-key">OSM ID</span>
                    <span className="data-value mono">{selectedLocation.osm_id}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-key">Category</span>
                    <span className="data-value">{selectedLocation.category}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-key">Type</span>
                    <span className="data-value">{selectedLocation.type}</span>
                  </div>
                </div>

                {selectedLocation.address && Object.keys(selectedLocation.address).length > 0 && (
                  <div className="inspector-section">
                    <h4>Deep Address Hierarchy</h4>
                    {Object.entries(selectedLocation.address).map(([key, val]) => (
                      <div className="data-row" key={key}>
                        <span className="data-key capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="data-value">{val}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="inspector-section">
                  <h4>Algorithmic & Spatial</h4>
                  <div className="data-row">
                    <span className="data-key">Importance</span>
                    <span className="data-value">{parseFloat(selectedLocation.importance || 0).toFixed(4)}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-key">Place Rank</span>
                    <span className="data-value">{selectedLocation.place_rank}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-key">Coordinates</span>
                    <span className="data-value mono">{parseFloat(selectedLocation.lat).toFixed(4)}, {parseFloat(selectedLocation.lon).toFixed(4)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
