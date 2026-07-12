import { useEffect, useState, useCallback } from 'react';
import { fetchSystemStatus } from '../lib/api';
import { Activity, Database, Clock, Zap, CheckCircle, XCircle, RefreshCw, Server, HardDrive, Shield } from 'lucide-react';

const SystemStatus = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchSystemStatus();
      setStatus(data);
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Failed to fetch system status", e);
      setStatus({ db_online: false, error: e.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  const formatNumber = (n) => n?.toLocaleString() ?? '-';

  const getStatusColor = (online) => online ? 'var(--success, #22c55e)' : 'var(--error, #ef4444)';

  const tableCategories = {
    'Core Data': ['aoc_tenders', 'aoc_details'],
    'Dashboard Analytics': ['kpi_stats', 'yearly_trends', 'monthly_trends', 'top_orgs', 'tender_type_dist', 'portal_breakdown', 'value_brackets'],
    'Investigation': ['single_bid_contracts', 'repeat_winners', 'org_report_cards'],
    'Publishing & Status': ['tenders_status', 'published_monthly', 'top_published_orgs'],
    'Geo & Network': ['state_stats', 'sector_distribution', 'network_nodes', 'network_edges'],
  };

  if (loading) {
    return (
      <div className="dashboard-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={40} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)', marginBottom: 16 }} />
          <p style={{ color: 'var(--text-secondary)' }}>Connecting to database...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Server size={28} />
            System Status
          </h1>
          <p className="page-subtitle" style={{ fontSize: 14, marginTop: 4 }}>
            Live health monitoring for the IPW infrastructure
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastRefresh && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={loadStatus}
            disabled={refreshing}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: refreshing ? 0.6 : 1,
              background: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md, 8px)',
              fontWeight: 500,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            <RefreshCw size={14} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
            Refresh
          </button>
        </div>
      </div>

      {/* Connection Status Banner */}
      <div className="card" style={{
        marginBottom: 24,
        borderLeft: `4px solid ${getStatusColor(status?.db_online)}`,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '20px 24px',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: status?.db_online ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {status?.db_online
            ? <CheckCircle size={24} color="var(--success, #22c55e)" />
            : <XCircle size={24} color="var(--error, #ef4444)" />
          }
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
            {status?.db_online ? 'PostgreSQL Database Online' : 'Database Offline'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {status?.db_online
              ? 'Secure connection established over Tailscale private network'
              : (status?.error || 'Unable to connect to the database server')
            }
          </div>
        </div>
        <div style={{
          width: 12, height: 12, borderRadius: '50%',
          background: getStatusColor(status?.db_online),
          boxShadow: `0 0 8px ${getStatusColor(status?.db_online)}`,
          animation: status?.db_online ? 'pulse 2s ease-in-out infinite' : 'none',
        }} />
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      </div>

      {/* KPI Cards */}
      <div className="dashboard-grid kpi-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 32, gap: 16 }}>
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <Zap size={22} color="var(--accent-primary)" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Latency</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            {status?.latency_ms != null ? `${status.latency_ms}ms` : '-'}
          </div>
        </div>
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <HardDrive size={22} color="var(--accent-primary)" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Database Size</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            {status?.db_size_mb ?? '-'}
          </div>
        </div>
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <Clock size={22} color="var(--accent-primary)" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Server Uptime</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            {status?.uptime ?? '-'}
          </div>
        </div>
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <Shield size={22} color="var(--accent-primary)" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Network</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            Tailscale
          </div>
        </div>
      </div>

      {/* PostgreSQL Version */}
      {status?.pg_version && (
        <div className="card" style={{ marginBottom: 24, padding: '16px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Database Engine
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {status.pg_version}
          </div>
        </div>
      )}

      {/* Architecture Diagram */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Activity size={18} />
          Infrastructure Architecture
        </h3>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, flexWrap: 'wrap', padding: '16px 0' }}>
          {/* App Server */}
          <div style={{
            background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md, 12px)',
            padding: '20px 24px', textAlign: 'center', minWidth: 200,
          }}>
            <Server size={28} color="var(--accent-primary)" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>App Server</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>4-core · 4 GB RAM</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>100.119.181.36</div>
            <div style={{ fontSize: 11, color: 'var(--accent-primary)', marginTop: 6 }}>React + Flask API</div>
          </div>

          {/* Connection Arrow */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tailscale</div>
            <div style={{ width: 60, height: 2, background: status?.db_online ? 'var(--success, #22c55e)' : 'var(--error, #ef4444)', borderRadius: 1 }} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Encrypted</div>
          </div>

          {/* DB Server */}
          <div style={{
            background: 'var(--bg-main)', border: `1px solid ${status?.db_online ? 'var(--success, #22c55e)' : 'var(--border-color)'}`, borderRadius: 'var(--radius-md, 12px)',
            padding: '20px 24px', textAlign: 'center', minWidth: 200,
          }}>
            <Database size={28} color={status?.db_online ? 'var(--success, #22c55e)' : 'var(--text-muted)'} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Database Server</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>8-core · 8 GB RAM</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>100.112.20.56</div>
            <div style={{ fontSize: 11, color: status?.db_online ? 'var(--success, #22c55e)' : 'var(--text-muted)', marginTop: 6 }}>PostgreSQL</div>
          </div>
        </div>
      </div>

      {/* Table Health */}
      <div className="card">
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Database size={18} />
          Table Health
        </h3>

        {Object.entries(tableCategories).map(([category, tableNames]) => {
          const tables = (status?.tables || []).filter(t => tableNames.includes(t.name));
          if (tables.length === 0) return null;

          return (
            <div key={category} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontWeight: 600 }}>
                {category}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {tables.map(t => (
                  <div key={t.name} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', background: 'var(--bg-main)',
                    borderRadius: 'var(--radius-sm, 8px)', border: '1px solid var(--border-color)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {t.status === 'ok'
                        ? <CheckCircle size={14} color="var(--success, #22c55e)" />
                        : <XCircle size={14} color="var(--error, #ef4444)" />
                      }
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{t.name}</span>
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: t.rows > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                      background: t.rows > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      padding: '2px 8px', borderRadius: 4,
                    }}>
                      {formatNumber(t.rows)} rows
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* SHA-256 Hashes */}
      <div className="card" style={{ marginTop: 24, borderLeft: '4px solid var(--accent-primary)' }}>
        <h3 className="card-title" style={{ marginBottom: 12 }}>Data Integrity (SHA-256)</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
          Verified hashes of the raw data dumps used to seed this database.
        </p>
        <div style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--bg-main)', padding: 16, borderRadius: 'var(--radius-sm, 8px)' }}>
          <div style={{ marginBottom: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)', minWidth: 140 }}>aoc_tenders.db</span>
            <span style={{ color: 'var(--accent-primary)', wordBreak: 'break-all' }}>ec8ef7711a17b7cae9e0414c2403b119a0a31c4dec49ed7055b38ec0df5f7586</span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)', minWidth: 140 }}>tenders_vps.db</span>
            <span style={{ color: 'var(--accent-primary)', wordBreak: 'break-all' }}>b1994cfb6dd2d5da9ed1d9ac8d6bbc7083178f155e92a65628e87a38e4c64d01</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemStatus;
