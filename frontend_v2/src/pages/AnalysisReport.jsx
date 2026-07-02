import { useEffect, useState, useRef } from 'react';
import { fetchNarrativeReport } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { FileText, Download, Printer } from 'lucide-react';
import html2pdf from 'html2pdf.js';

const AnalysisReport = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reportRef = useRef();

  useEffect(() => {
    const loadReport = async () => {
      try {
        const data = await fetchNarrativeReport();
        if (data && data.markdown) {
          setReport(data.markdown);
        } else if (data && data.content) {
          setReport(data.content);
        } else if (typeof data === 'string') {
          setReport(data);
        } else {
          setReport("Failed to parse report format.");
        }
      } catch (e) {
        console.error("Failed to fetch report", e);
        setError("No Report Available. Go to Data Import, drop your .db file, and click Analyse Data.");
      } finally {
        setLoading(false);
      }
    };
    
    loadReport();
  }, []);

  const handlePrint = () => {
    const element = reportRef.current;
    const opt = {
      margin:       1,
      filename:     'India_Procurement_Analysis_Report.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="dashboard-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="status-dot ready" style={{ width: 12, height: 12 }}></span>
            Analysis Report
          </h1>
          <p className="page-subtitle">Executive summary of the procurement dataset</p>
        </div>
        
        {report && !loading && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handlePrint} className="search-button" style={{ background: 'var(--accent-primary)', padding: '8px 16px', fontSize: 13 }}>
              <Printer size={16} /> Print / PDF
            </button>
            <a href="/api/export/html" className="search-button" style={{ background: 'var(--text-primary)', textDecoration: 'none', padding: '8px 16px', fontSize: 13 }}>
              <Download size={16} /> Download HTML
            </a>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '40px' }}>
        {loading ? (
          <div className="loading-state">Loading narrative report...</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-secondary)' }}>
            <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
            <h3>{error}</h3>
          </div>
        ) : (
          <div ref={reportRef} className="ai-content" style={{ color: 'var(--text-primary)', fontSize: 15, lineHeight: 1.8 }}>
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisReport;
