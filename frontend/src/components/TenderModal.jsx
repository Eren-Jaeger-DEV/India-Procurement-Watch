import { useState, useEffect } from 'react';
import { X, ExternalLink, ShieldAlert, Building2, Calendar, IndianRupee, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { fetchTenderDetail } from '../lib/api';

const TenderModal = ({ isOpen, onClose, initialData }) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'details' | 'json'
  const [fullData, setFullData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !initialData) {
      setFullData(null);
      return;
    }

    const internalId = initialData.internal_id || initialData.id;
    if (internalId) {
      setLoading(true);
      fetchTenderDetail(internalId)
        .then(res => setFullData(res))
        .catch(err => console.error("Failed to load full tender detail:", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, initialData]);

  if (!isOpen || !initialData) return null;

  const title = initialData.title || initialData.tender_title || fullData?.title || 'Tender Detail';
  const org = initialData.org_name || fullData?.org_name || 'N/A';
  const value = initialData.contract_value 
    ? `₹${(initialData.contract_value / 1e7).toFixed(2)} Cr`
    : initialData.value_lakh 
      ? `₹${initialData.value_lakh} Lakh`
      : fullData?.contract_value 
        ? `₹${(fullData.contract_value / 1e7).toFixed(2)} Cr`
        : 'N/A';
  const winner = initialData.bidder_name || initialData.vendor_name || fullData?.bidder_name || 'N/A';
  const date = initialData.aoc_date || initialData.published_date || fullData?.aoc_date || 'N/A';
  const portalUrl = initialData.detail_url || fullData?.detail_url;
  const isSingleBid = initialData.is_single_bid || initialData.single_bid || fullData?.is_single_bid;

  let parsedDetails = null;
  if (fullData?.details) {
    try {
      parsedDetails = typeof fullData.details === 'string' ? JSON.parse(fullData.details) : fullData.details;
    } catch (e) {
      parsedDetails = null;
    }
  }

  return (
    <>
      <div 
        className="modal-backdrop" 
        onClick={onClose} 
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', zIndex: 9998 }} 
      />
      <div 
        className="modal" 
        style={{ 
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', 
          background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', zIndex: 9999, 
          width: '92%', maxWidth: 750, maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          border: '1px solid var(--border-color)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'var(--accent-primary)', color: 'white', textTransform: 'uppercase' }}>
                {initialData.portal_type || fullData?.portal_type || 'TENDER'}
              </span>
              {isSingleBid && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={12} /> SINGLE-BID CONTRACT
                </span>
              )}
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
              {title}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <X size={22} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 24px', gap: 16, background: 'var(--bg-main)' }}>
          <button 
            onClick={() => setActiveTab('overview')}
            style={{ padding: '12px 0', border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: activeTab === 'overview' ? 'var(--accent-primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'overview' ? '2px solid var(--accent-primary)' : '2px solid transparent', cursor: 'pointer' }}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('details')}
            style={{ padding: '12px 0', border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: activeTab === 'details' ? 'var(--accent-primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'details' ? '2px solid var(--accent-primary)' : '2px solid transparent', cursor: 'pointer' }}
          >
            Parsed Scraped Details
          </button>
          {parsedDetails && (
            <button 
              onClick={() => setActiveTab('json')}
              style={{ padding: '12px 0', border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: activeTab === 'json' ? 'var(--accent-primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'json' ? '2px solid var(--accent-primary)' : '2px solid transparent', cursor: 'pointer' }}
            >
              Raw JSON
            </button>
          )}
        </div>

        {/* Modal Content Area */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: 'var(--bg-main)', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Building2 size={13} /> PROCURING ORGANIZATION
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{org}</div>
                </div>

                <div style={{ background: 'var(--bg-main)', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <IndianRupee size={13} /> CONTRACT VALUE
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>{value}</div>
                </div>

                <div style={{ background: 'var(--bg-main)', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={13} /> WINNING BIDDER
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{winner}</div>
                </div>

                <div style={{ background: 'var(--bg-main)', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={13} /> AWARD DATE
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{date}</div>
                </div>
              </div>

              {(initialData.ref_no || fullData?.ref_no || initialData.tender_id) && (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  <strong>Reference / Tender ID:</strong> <code style={{ background: 'var(--bg-main)', padding: '2px 6px', borderRadius: 4 }}>{initialData.ref_no || fullData?.ref_no || initialData.tender_id}</code>
                </div>
              )}

              {portalUrl && (
                <div style={{ marginTop: 8 }}>
                  <a 
                    href={portalUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', 
                      background: 'var(--accent-primary)', color: 'white', textDecoration: 'none', 
                      borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 13 
                    }}
                  >
                    Open Official Government Portal <ExternalLink size={15} />
                  </a>
                </div>
              )}
            </div>
          )}

          {activeTab === 'details' && (
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>Loading scraped details from database…</div>
              ) : parsedDetails ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Object.entries(parsedDetails).map(([k, v], idx) => (
                    <div key={idx} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2, wordBreak: 'break-word' }}>
                        {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No additional JSON details available for this record.</div>
              )}
            </div>
          )}

          {activeTab === 'json' && parsedDetails && (
            <pre style={{ background: 'var(--bg-main)', padding: 16, borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-primary)', overflowX: 'auto', border: '1px solid var(--border-color)' }}>
              {JSON.stringify(parsedDetails, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </>
  );
};

export default TenderModal;
