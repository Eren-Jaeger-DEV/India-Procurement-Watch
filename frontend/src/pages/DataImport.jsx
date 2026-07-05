import { useEffect, useState } from 'react';
import { fetchDumpFiles } from '../lib/api';
import { DownloadCloud, CheckCircle, Database } from 'lucide-react';

const DataImport = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const data = await fetchDumpFiles();
      setFiles(data.files || []);
    } catch (e) {
      console.error("Failed to fetch dump files", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  return (
    <div className="dashboard-page">
      <div className="page-header" style={{ textAlign: 'center', marginBottom: 48, marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: '50%', boxShadow: 'var(--shadow-md)' }}>
            <DownloadCloud size={48} color="var(--accent-primary)" />
          </div>
        </div>
        <h1 className="page-title" style={{ fontSize: 32 }}>Drop Your Data. Get Full Transparency.</h1>
        <p className="page-subtitle" style={{ fontSize: 16, maxWidth: 600, margin: '12px auto' }}>
          This tool turns raw government procurement SQLite databases into deep investigative analysis. No coding required.
        </p>
      </div>

      <div className="dashboard-grid kpi-row" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 48 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ marginBottom: 12 }}>1. Get Your Data</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Download the SQLite .db file from the procurement portal or cloud storage.</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ marginBottom: 12 }}>2. Drop the File</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Copy your .db file into the <code>data_dump/</code> folder in the project.</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ marginBottom: 12 }}>3. Click Analyse</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>The tool does everything else — analysis, scoring, and reports — automatically.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={18} /> Files Detected in data_dump/
          </h3>
          <button onClick={loadFiles} className="search-button" style={{ padding: '6px 12px', fontSize: 12 }}>
            ↻ Refresh
          </button>
        </div>
        
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Checking files...</p>
        ) : files.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {files.map(f => (
              <li key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                <CheckCircle size={18} color="var(--success)" />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  ({(f.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ padding: 24, textAlign: 'center', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)' }}>
            No .db files found in data_dump/ yet.<br />Drop your file there and click Refresh.
          </div>
        )}
      </div>

      <div className="card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
        <h3 className="card-title" style={{ marginBottom: 12 }}>VERIFYING FILE INTEGRITY (SHA-256)</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
          After downloading, verify the file has not been corrupted or tampered with by comparing its SHA-256 hash against the values below.
        </p>
        <div style={{ fontFamily: 'monospace', fontSize: 13, background: 'var(--bg-main)', padding: 16, borderRadius: 'var(--radius-md)' }}>
          <div style={{ marginBottom: 8 }}><span style={{ color: 'var(--text-muted)', display: 'inline-block', width: 140 }}>aoc_tenders.db :</span> <span style={{ color: 'var(--accent-primary)', wordBreak: 'break-all' }}>ec8ef7711a17b7cae9e0414c2403b119a0a31c4dec49ed7055b38ec0df5f7586</span></div>
          <div><span style={{ color: 'var(--text-muted)', display: 'inline-block', width: 140 }}>tenders_vps.db :</span> <span style={{ color: 'var(--accent-primary)', wordBreak: 'break-all' }}>b1994cfb6dd2d5da9ed1d9ac8d6bbc7083178f155e92a65628e87a38e4c64d01</span></div>
        </div>
      </div>
    </div>
  );
};

export default DataImport;
