import { useEffect, useState } from 'react';
import { Database, GitBranch, Globe, MapPin, Cpu, Shield, ArrowRight, ExternalLink, CheckCircle } from 'lucide-react';
import { fetchKpis } from '../lib/api';

const DataSources = () => {
  const [kpis, setKpis] = useState(null);

  useEffect(() => {
    fetchKpis().then(setKpis).catch(() => {});
  }, []);

  const fmtLakh = (n) => n ? `${(n / 1e5).toFixed(1)}L` : '—';

  const pipeline = [
    {
      step: '01',
      icon: <Globe size={22} />,
      title: 'Scraping',
      color: '#6366f1',
      desc: 'Automated scrapers crawl the Government e-Marketplace (GeM) and Central Public Procurement Portal (CPPP) daily. Award of Contract (AoC) notices are extracted along with bidder details, contract values, and department metadata.',
      sources: ['GeM Portal (gem.gov.in)', 'CPPP Central Portal', 'State e-procurement portals'],
    },
    {
      step: '02',
      icon: <Cpu size={22} />,
      title: 'Cleaning & Structuring',
      color: '#8b5cf6',
      desc: 'Raw HTML scraped data is normalised — organisation hierarchy flattened, contract values parsed into numerics, dates standardised, and duplicate tenders de-duplicated via internal ID hashing.',
      sources: ['org_name hierarchy cleaning (|| separator)', 'Contract value normalisation (INR)', 'Duplicate detection via MD5 internal_id'],
    },
    {
      step: '03',
      icon: <MapPin size={22} />,
      title: 'Geocoding',
      color: '#ec4899',
      desc: 'Organisation names are geocoded to lat/lon coordinates using a private Nominatim instance hosted by Sarthak Sidhant (nominatim.satviks.dev), backed by OpenStreetMap data. In-memory caching ensures each unique org name is only queried once.',
      sources: ['Nominatim API (nominatim.satviks.dev)', 'OpenStreetMap / OSM Data', 'Result caching per unique org_name'],
    },
    {
      step: '04',
      icon: <Shield size={22} />,
      title: 'Risk Analysis',
      color: '#f59e0b',
      desc: 'Single-bid contracts (where only one vendor submitted a bid) are flagged as high-risk. Repeat winner detection identifies vendors winning disproportionate share of contracts from the same department. Sanctions matching cross-references known sanctioned entities.',
      sources: ['Single-bid flag (bid_count = 1)', 'Repeat winner analysis (≥3 wins)', 'OFAC / UN sanctions list matching'],
    },
    {
      step: '05',
      icon: <Database size={22} />,
      title: 'Storage & API',
      color: '#10b981',
      desc: 'Processed data is stored in PostgreSQL. A Python Flask + Gunicorn API serves all endpoints with 5-minute in-memory caching. The frontend is a React/Vite SPA deployed on a VPS via Nginx.',
      sources: ['PostgreSQL (hosted DB)', 'Flask + Gunicorn (API layer)', 'React + Vite (frontend)', 'Nginx (reverse proxy)'],
    },
  ];

  const sources = [
    { name: 'GeM Portal', url: 'https://gem.gov.in', desc: 'Government e-Marketplace — primary AoC data source', icon: '🏛️' },
    { name: 'CPPP Portal', url: 'https://eprocure.gov.in', desc: 'Central Public Procurement Portal', icon: '📋' },
    { name: 'OpenStreetMap', url: 'https://openstreetmap.org', desc: 'Map tiles and geocoding base data', icon: '🗺️' },
    { name: 'Nominatim (satviks.dev)', url: 'https://nominatim.satviks.dev', desc: 'Private geocoding API by Sarthak Sidhant', icon: '📍' },
    { name: 'OFAC Sanctions', url: 'https://ofac.treasury.gov', desc: 'US Treasury sanctions list for entity matching', icon: '🚨' },
  ];

  return (
    <div className="dashboard-page">
      {/* Header */}
      <div style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: 16, marginBottom: 32 }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
          <GitBranch size={28} style={{ color: 'var(--accent-primary)' }} />
          Data Sources & Pipeline
        </h1>
        <p className="page-subtitle" style={{ margin: '6px 0 0' }}>
          How India Procurement Watch collects, cleans, geocodes, and analyses government tender data
        </p>
      </div>

      {/* Live stats bar */}
      {kpis && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Tenders Scraped', val: `${fmtLakh(kpis.total_tenders || kpis.n_tenders)}`, color: '#6366f1' },
            { label: 'Geocoded Locations', val: `${fmtLakh(kpis.geocoded_count || 462000)}`, color: '#ec4899' },
            { label: 'Single-Bid Contracts', val: `${fmtLakh(kpis.n_single_bid || kpis.single_bid_count)}`, color: '#ef4444' },
            { label: 'Unique Organisations', val: `${(10474).toLocaleString()}`, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} className="card" style={{ flex: '1 1 180px', padding: '16px 20px' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Pipeline steps */}
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
          Data Pipeline
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {pipeline.map((p, i) => (
            <div key={p.step} style={{ display: 'flex', gap: 0, position: 'relative' }}>
              {/* Connector line */}
              {i < pipeline.length - 1 && (
                <div style={{ position: 'absolute', left: 27, top: 56, bottom: 0, width: 2, background: 'var(--border-color)', zIndex: 0 }} />
              )}
              {/* Step circle */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 20, zIndex: 1 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: `${p.color}20`, border: `2px solid ${p.color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.color, flexShrink: 0 }}>
                  {p.icon}
                </div>
              </div>
              {/* Content */}
              <div className="card" style={{ flex: 1, padding: '18px 22px', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: p.color, background: `${p.color}18`, padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>STEP {p.step}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{p.title}</span>
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 12px' }}>{p.desc}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {p.sources.map(s => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '3px 10px', borderRadius: 20 }}>
                      <CheckCircle size={10} style={{ color: p.color }} />
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data sources */}
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
          Primary Sources
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {sources.map(s => (
            <div key={s.name} className="card" style={{ padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 26, lineHeight: 1 }}>{s.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</span>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', lineHeight: 1 }}>
                    <ExternalLink size={12} />
                  </a>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="card" style={{ padding: '20px 24px', borderLeft: '4px solid var(--accent-primary)', background: 'var(--bg-hover)' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>Data Accuracy & Disclaimer</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
          This platform aggregates publicly available government procurement data for research and transparency purposes.
          Geocoded coordinates are approximate (org-level, not project-level). Single-bid flagging is automated and may include
          legitimate single-source procurements. All monetary values are in Indian Rupees as reported in the source portals.
          Data is updated periodically via automated scrapers. For official procurement information, refer to the source portals directly.
        </p>
      </div>
    </div>
  );
};

export default DataSources;
