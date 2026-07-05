import { useEffect, useState, useRef } from 'react';
import { fetchNarrativeReport } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { FileText, Download, Printer, AlertTriangle, CheckCircle, Info, ShieldAlert } from 'lucide-react';
import html2pdf from 'html2pdf.js';

const AnalysisReport = () => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reportRef = useRef();

  useEffect(() => {
    const loadReport = async () => {
      try {
        const data = await fetchNarrativeReport();
        if (data && !data.error) {
          setReportData(data);
        } else {
          setError(data?.error || "Failed to load narrative report.");
        }
      } catch (e) {
        console.error("Failed to fetch report", e);
        setError("No Report Available. Please verify database ingestion.");
      } finally {
        setLoading(false);
      }
    };
    
    loadReport();
  }, []);

  const handlePrint = () => {
    const element = reportRef.current;
    const opt = {
      margin:       0.5,
      filename:     'India_Procurement_Analysis_Report.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  const getSeverityBadge = (severity) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return { bg: 'rgba(220, 38, 38, 0.12)', border: 'rgba(220, 38, 38, 0.3)', color: '#ef4444', label: 'CRITICAL' };
      case 'HIGH':
        return { bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.3)', color: '#f97316', label: 'HIGH RISK' };
      case 'MEDIUM':
        return { bg: 'rgba(234, 179, 8, 0.12)', border: 'rgba(234, 179, 8, 0.3)', color: '#eab308', label: 'MEDIUM RISK' };
      default:
        return { bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.3)', color: '#22c55e', label: 'INFORMATIONAL' };
    }
  };

  const exec = reportData?.executive_summary || {};
  const findings = reportData?.findings || [];

  return (
    <div className="dashboard-page" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="status-dot ready" style={{ width: 12, height: 12 }}></span>
            Executive Analysis Report
          </h1>
          <p className="page-subtitle">Systemic audit summary & data highlight findings</p>
        </div>
        
        {reportData && !loading && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handlePrint} className="search-button" style={{ background: 'var(--accent-primary)', padding: '8px 16px', fontSize: 13 }}>
              <Printer size={16} /> Print / PDF
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading analysis report...
        </div>
      ) : error ? (
        <div className="card" style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--text-secondary)' }}>
          <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
          <h3>{error}</h3>
        </div>
      ) : (
        <div ref={reportRef} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Executive Summary Header Card */}
          <div className="card" style={{ padding: 28, borderLeft: '4px solid var(--accent-primary)' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>
              {exec.title || 'Data Analysis Summary'}
            </h2>
            
            {exec.paragraph_1 && <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-primary)', marginBottom: 10 }}>{exec.paragraph_1}</p>}
            {exec.paragraph_2 && <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 10 }}>{exec.paragraph_2}</p>}
            {exec.paragraph_3 && <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>{exec.paragraph_3}</p>}

            {/* Finding Metric Pills */}
            <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
              <div style={{ padding: '6px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#ef4444' }}>
                {exec.critical_count || 0} Critical Finding
              </div>
              <div style={{ padding: '6px 14px', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.2)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#f97316' }}>
                {exec.high_count || 0} High Risk Findings
              </div>
              <div style={{ padding: '6px 14px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#eab308' }}>
                {exec.medium_count || 0} Medium Risk Findings
              </div>
            </div>
          </div>

          {/* Individual Audit Finding Cards */}
          {findings.length > 0 ? (
            findings.map((item, idx) => {
              const badge = getSeverityBadge(item.severity);
              return (
                <div key={idx} className="card" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ 
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, 
                      letterSpacing: '0.05em', background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color 
                    }}>
                      {badge.label}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                    {item.title}
                  </h3>

                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                    {item.explanation || item.summary}
                  </p>

                  {/* What It Means Box */}
                  {item.what_it_means && (
                    <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Info size={15} color="var(--accent-primary)" /> What It Means
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {item.what_it_means}
                      </div>
                    </div>
                  )}

                  {/* Recommended Next Steps Checklist */}
                  {item.next_steps && item.next_steps.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle size={15} color="#10b981" /> Recommended Investigative Actions
                      </div>
                      <ul style={{ paddingLeft: 20, margin: 0 }}>
                        {item.next_steps.map((step, sIdx) => (
                          <li key={sIdx} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.5 }}>
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            reportData.markdown && (
              <div className="card" style={{ padding: 32 }}>
                <div className="markdown-body" style={{ color: 'var(--text-primary)' }}>
                  <ReactMarkdown>{reportData.markdown}</ReactMarkdown>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default AnalysisReport;
