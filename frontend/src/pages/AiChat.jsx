import { useState, useRef, useEffect } from 'react';
import { streamAiChat } from '../lib/api';
import { Cpu, ArrowRight, Scan, Flag, Network, Trash2, User, Sparkles, Brain, Database, MessageSquare, ChevronDown, Table, Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const AiChat = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [engineMode, setEngineMode] = useState('data'); // 'data' = Database Analyst, 'convo' = Conversational
  const [model, setModel] = useState('deepseek-v4-pro');
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const sendQuery = async (text = input) => {
    const queryText = text.trim();
    if (!queryText || loading) return;
    
    // Create User message & blank AI response object
    const userMsg = { role: 'user', content: queryText };
    const initialAiMsg = {
      role: 'ai',
      thought: '',
      status: 'Connecting to AI engine...',
      sqlQuery: '',
      columns: [],
      data: [],
      summary: '',
      kpi: null,
      chart: null,
      error: ''
    };

    setMessages(prev => [...prev, userMsg, initialAiMsg]);
    setInput('');
    setLoading(true);

    await streamAiChat(
      queryText,
      model,
      (event) => {
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx < 0 || updated[lastIdx].role !== 'ai') return prev;

          const current = { ...updated[lastIdx] };

          switch (event.type) {
            case 'thought_start':
              current.status = 'Thinking & planning investigation strategy...';
              break;
            case 'thought_chunk':
              current.thought += event.content || '';
              break;
            case 'status':
              current.status = event.content || '';
              break;
            case 'data':
              current.sqlQuery = event.query || '';
              current.columns = event.columns || [];
              current.data = event.data || [];
              current.status = '';
              break;
            case 'kpi_box':
              current.kpi = event.kpi;
              break;
            case 'chart_data':
              current.chart = event.chart;
              break;
            case 'summary_start':
              current.status = 'Summarizing findings...';
              break;
            case 'summary_chunk':
              current.summary += event.content || '';
              current.status = '';
              break;
            case 'error':
              current.error = event.content || 'An unexpected error occurred.';
              current.status = '';
              break;
            case 'end':
              current.status = '';
              break;
            default:
              break;
          }

          updated[lastIdx] = current;
          return updated;
        });
      },
      (err) => {
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'ai') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              error: err.message || 'Connection lost to Darshi AI engine.',
              status: ''
            };
          }
          return updated;
        });
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
  };

  const clearChat = () => {
    if (loading) return;
    setMessages([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: 'var(--bg-main)', position: 'relative' }}>
      
      {/* Header Bar with Engine Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', background: 'var(--bg-main)', borderRadius: 8, padding: 3, border: '1px solid var(--border-color)' }}>
            <button 
              onClick={() => setEngineMode('data')}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, border: 'none', 
                background: engineMode === 'data' ? 'var(--accent-primary)' : 'transparent', 
                color: engineMode === 'data' ? 'white' : 'var(--text-secondary)', 
                fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' 
              }}
            >
              <Database size={14} /> Database Analyst
            </button>
            <button 
              onClick={() => setEngineMode('convo')}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, border: 'none', 
                background: engineMode === 'convo' ? 'var(--accent-primary)' : 'transparent', 
                color: engineMode === 'convo' ? 'white' : 'var(--text-secondary)', 
                fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' 
              }}
            >
              <MessageSquare size={14} /> Normal Chat
            </button>
          </div>
        </div>

        {messages.length > 0 && (
          <button 
            onClick={clearChat}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <Trash2 size={14} /> Clear Chat
          </button>
        )}
      </div>

      {/* Chat Messages Body */}
      {messages.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Sparkles size={32} color="var(--accent-primary)" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)', textAlign: 'center' }}>
            {engineMode === 'data' ? 'Ask Darshi to query PostgreSQL database' : 'Conversational Assistant'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 480, textAlign: 'center', lineHeight: 1.6, fontSize: 14, marginBottom: 32 }}>
            {engineMode === 'data' 
              ? 'Real-time database queries, thought-process reasoning, single-bid anomaly flagging, and interactive tables.'
              : 'Ask general procurement questions, methodology details, or platform guidance.'
            }
          </p>

          {/* Prompt Chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, maxWidth: 800, width: '100%' }}>
            <div 
              onClick={() => sendQuery('Run anomaly detection on top winning organizations and list single-bid contracts')}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all 0.2s' }}
              className="hover-row"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                <Scan size={16} color="#3b82f6" /> Anomaly Audit
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>Identify top organizations with single-bid tender distributions.</div>
            </div>

            <div 
              onClick={() => sendQuery('Flag all single-bid contracts over 1 crore INR in the database')}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all 0.2s' }}
              className="hover-row"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                <Flag size={16} color="#f59e0b" /> Single-Bid Contracts
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>Extract high-value tenders awarded with zero competitive bidding.</div>
            </div>

            <div 
              onClick={() => sendQuery('List top repeat award winners across all departments')}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all 0.2s' }}
              className="hover-row"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                <Network size={16} color="#10b981" /> Vendor Clustering
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>Find monopolies and frequent winners in key state departments.</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px', maxWidth: 920, margin: '0 auto', width: '100%' }}>
          {messages.map((m, idx) => (
            <div key={idx} style={{ marginBottom: 28, display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', gap: 14, alignItems: 'flex-start' }}>
              
              {/* Avatar */}
              {m.role === 'user' ? (
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white' }}>
                  <User size={18} />
                </div>
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white' }}>
                  <Sparkles size={18} />
                </div>
              )}

              {/* Message Content Bubble */}
              <div style={{ 
                maxWidth: '85%', 
                width: m.role === 'ai' ? '100%' : 'auto',
                padding: m.role === 'user' ? '12px 18px' : '20px 22px', 
                borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', 
                background: m.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-card)', 
                color: m.role === 'user' ? 'white' : 'var(--text-primary)', 
                border: m.role === 'user' ? 'none' : '1px solid var(--border-color)', 
                boxShadow: 'var(--shadow-sm)',
                lineHeight: 1.6,
                fontSize: 14
              }}>
                {m.role === 'user' ? (
                  m.content
                ) : (
                  <div>
                    {/* Collapsible Thought Process */}
                    {m.thought && (
                      <details style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, userSelect: 'none' }}>
                          <Brain size={16} color="#8b5cf6" />
                          <span>Thought Process & Investigation Strategy</span>
                        </summary>
                        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.5, borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                          {m.thought}
                        </div>
                      </details>
                    )}

                    {/* Loading Status Indicator */}
                    {m.status && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
                        <Sparkles className="animate-spin-slow" size={15} color="var(--accent-primary)" />
                        {m.status}
                      </div>
                    )}

                    {/* SQL Query Box */}
                    {m.sqlQuery && (
                      <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#94a3b8', fontSize: 12, fontFamily: 'monospace' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: '#38bdf8', fontWeight: 600 }}>
                          <Terminal size={14} /> Executed SQL Query
                        </div>
                        <code>{m.sqlQuery}</code>
                      </div>
                    )}

                    {/* Result Data Table */}
                    {m.data && m.data.length > 0 && (
                      <div style={{ marginBottom: 16, overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
                              {m.columns.map((col, i) => (
                                <th key={i} style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {m.data.map((row, rIdx) => (
                              <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                {m.columns.map((col, cIdx) => (
                                  <td key={cIdx} style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>
                                    {row[col] !== null ? String(row[col]) : '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Error Message */}
                    {m.error && (
                      <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                        ⚠️ {m.error}
                      </div>
                    )}

                    {/* Final Summary Response */}
                    {m.summary ? (
                      <div className="markdown-body" style={{ color: 'var(--text-primary)' }}>
                        <ReactMarkdown>{m.summary}</ReactMarkdown>
                      </div>
                    ) : (
                      !m.thought && !m.status && !m.data.length && !m.error && (
                        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Waiting for response...</div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* Input Dock */}
      <div style={{ padding: '16px 24px 24px 24px', maxWidth: 920, width: '100%', margin: '0 auto' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 14, boxShadow: 'var(--shadow-md)' }}>
          <textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(); } }}
            placeholder={engineMode === 'data' ? "Ask Darshi to investigate tender database..." : "Ask Darshi anything..."}
            rows={2}
            style={{ 
              width: '100%', 
              border: 'none', 
              background: 'transparent', 
              color: 'var(--text-primary)', 
              fontSize: 14, 
              outline: 'none', 
              resize: 'none', 
              fontFamily: "'Inter', sans-serif" 
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cpu size={14} color="var(--text-muted)" />
              <select 
                value={model} 
                onChange={e => setModel(e.target.value)} 
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--text-secondary)', 
                  fontSize: 12, 
                  outline: 'none', 
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                <option value="deepseek-v4-pro">DeepSeek V4 Pro (Recommended)</option>
                <option value="deepseek-v4-flash">DeepSeek V4 Flash (Fastest)</option>
                <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (Smart)</option>
                <option value="claude-opus-4-8">Claude Opus 4.8 (Premium)</option>
                <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                <option value="grok-4.3">Grok 4.3</option>
              </select>
            </div>

            <button 
              onClick={() => sendQuery()}
              disabled={loading || !input.trim()}
              style={{ 
                background: 'var(--accent-primary)', 
                color: 'white', 
                border: 'none', 
                padding: '8px 18px', 
                borderRadius: 8, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6, 
                fontWeight: 600, 
                fontSize: 13,
                cursor: 'pointer', 
                opacity: (loading || !input.trim()) ? 0.5 : 1,
                transition: 'all 0.2s'
              }}
            >
              Send Query <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
          Darshi AI operates in read-only sandbox mode. Verify critical findings independently before publication.
        </div>
      </div>
    </div>
  );
};

export default AiChat;
