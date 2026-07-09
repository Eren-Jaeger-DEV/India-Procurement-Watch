import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { fetchMapTenders } from '../lib/api';
import { MapPin, Search, AlertTriangle, Building, ShieldAlert, Loader2, Info } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom pin icons
const createPinIcon = (color) => {
  return new L.DivIcon({
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    className: 'custom-map-pin',
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

const MapExplorer = () => {
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [portal, setPortal] = useState('All');
  const [singleBidOnly, setSingleBidOnly] = useState(false);
  const [minValCr, setMinValCr] = useState(0);
  const [mapStyle, setMapStyle] = useState('google-streets');

  useEffect(() => {
    const loadTenders = async () => {
      try {
        const data = await fetchMapTenders();
        setTenders(data || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load geocoded tender coordinates.");
      } finally {
        setLoading(false);
      }
    };
    loadTenders();
  }, []);

  // Filtered tenders
  const filteredTenders = useMemo(() => {
    return tenders.filter(t => {
      const matchSearch = !searchQuery || 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.org_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.resolved_address.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchPortal = portal === 'All' || t.portal_type === portal;
      const matchSingleBid = !singleBidOnly || t.is_single_bid === 1;
      const matchValue = (t.contract_value / 1e7) >= minValCr;

      return matchSearch && matchPortal && matchSingleBid && matchValue;
    });
  }, [tenders, searchQuery, portal, singleBidOnly, minValCr]);

  const handleInspect = (item) => {
    window.dispatchEvent(new CustomEvent('openTenderModal', { detail: item }));
  };

  const fmtCr = (v) => v ? `₹${(v / 1e7).toFixed(2)} Cr` : '—';

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
      <div style={{ textAlign: 'center' }}>
        <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)', marginBottom: 16 }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading geocoded map markers…</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
      <div className="card" style={{ maxWidth: 500, padding: 32, textAlign: 'center', borderLeft: '4px solid #ef4444' }}>
        <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: 12 }}>{error}</p>
        <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Retry</button>
      </div>
    </div>
  );

  return (
    <div className="dashboard-page" style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: 12, marginBottom: 16, flexShrink: 0 }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
          <MapPin size={28} style={{ color: 'var(--accent-primary)' }} /> Geocoded Tender Map Explorer
        </h1>
        <p className="page-subtitle" style={{ margin: '4px 0 0' }}>Spatial rendering of high-risk and high-value single-bid procurement awards across India</p>
      </div>

      {/* Main split dashboard layout */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Left Filters Sidebar */}
        <div className="card" style={{ width: 280, padding: 18, display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            Map Filters
          </h3>

          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder="Search title or location…" 
              style={{ width: '100%', padding: '6px 10px 6px 32px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 12.5, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Portal Type:</span>
            <select value={portal} onChange={(e) => setPortal(e.target.value)} style={{ padding: '6px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 12.5 }}>
              <option value="All">All Portals</option>
              <option value="central">Central Portal</option>
              <option value="state">State Portal</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Map Layer:</span>
            <select value={mapStyle} onChange={(e) => setMapStyle(e.target.value)} style={{ padding: '6px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: 12.5 }}>
              <option value="google-streets">Google Maps (Standard)</option>
              <option value="google-hybrid">Google Maps (Satellite/Hybrid)</option>
              <option value="osm">OpenStreetMap (Free Streets)</option>
              <option value="dark">Sleek Dark Mode (Default)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              <span>Min Value:</span>
              <span style={{ color: 'var(--accent-primary)' }}>≥ ₹{minValCr} Cr</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="20" 
              value={minValCr} 
              onChange={(e) => setMinValCr(Number(e.target.value))} 
              style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer', userSelect: 'none', color: singleBidOnly ? '#ef4444' : 'var(--text-secondary)' }}>
            <input type="checkbox" checked={singleBidOnly} onChange={(e) => setSingleBidOnly(e.target.checked)} />
            <AlertTriangle size={15} style={{ color: '#ef4444' }} /> Single-Bid Only
          </label>

          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            <div>Markers plotted: <strong>{filteredTenders.length}</strong></div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}></span> Single-Bid</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }}></span> Regular</div>
            </div>
          </div>
        </div>

        {/* Right Map Canvas Container */}
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', position: 'relative' }}>
          <MapContainer 
            center={[20.5937, 78.9629]} 
            zoom={5} 
            zoomControl={false}
            style={{ width: '100%', height: '100%', background: 'var(--bg-main)' }}
          >
            <TileLayer
              key={mapStyle}
              attribution={
                mapStyle.includes('google')
                  ? '&copy; Google Maps'
                  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              }
              url={
                mapStyle === 'google-streets' ? 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}' :
                mapStyle === 'google-hybrid' ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}' :
                mapStyle === 'osm' ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' :
                'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
              }
            />
            <ZoomControl position="bottomright" />
            
            {filteredTenders.map((item, idx) => (
              <Marker 
                key={idx} 
                position={[item.lat, item.lon]} 
                icon={createPinIcon(item.is_single_bid === 1 ? '#ef4444' : '#2563eb')}
              >
                <Popup>
                  <div style={{ fontFamily: 'Inter, system-ui, sans-serif', width: 230, color: '#1e293b' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: item.is_single_bid === 1 ? '#dc2626' : '#2563eb', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      {item.is_single_bid === 1 ? <ShieldAlert size={12} /> : <Building size={12} />}
                      {item.is_single_bid === 1 ? 'High-Risk Single-Bid' : 'Regular Procurement'}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 12.5, color: '#0f172a', marginBottom: 6, lineHeight: 1.3 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#475569', marginBottom: 2 }}>
                      <strong>Department:</strong> {item.org_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#475569', marginBottom: 2 }}>
                      <strong>Winner:</strong> {item.bidder_name || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>
                      <strong>Resolved Address:</strong> {item.resolved_address}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{fmtCr(item.contract_value)}</span>
                      <button 
                        onClick={() => handleInspect(item)} 
                        style={{ padding: '3px 8px', fontSize: 11, background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                      >
                        Inspect details
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default MapExplorer;
