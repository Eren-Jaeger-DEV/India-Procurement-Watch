import { useState, useRef, useEffect } from 'react';
import { streamAiChat } from '../lib/api';
import { Cpu, ArrowRight, Scan, Flag, Network, Trash2, User, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const AiChat = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState('gemini-3.5-flash');
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
    
    // Append user message & placeholder for AI response
    const userMsg = { role: 'user', content: queryText };
    setMessages(prev => [...prev, userMsg, { role: 'ai', content: '' }]);
    setInput('');
    setLoading(true);

    await streamAiChat(
      queryText,
      model,
      (chunk) => {
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'ai') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: updated[lastIdx].content + chunk
            };
          }
          return updated;
        });
      },
      (err) => {
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'ai') {
            updated[lastIdx] = {
              role: 'ai',
              content: `⚠️ Error: ${err.message || 'Failed to connect to Darshi AI engine.'}`
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

      {/* Chat Conversation Body */}
      {messages.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Sparkles size={32} color="var(--accent-primary)" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)', textAlign: 'center' }}>How can Darshi help your investigation today?</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 460, textAlign: 'center', lineHeight: 1.6, fontSize: 14, marginBottom: 32 }}>
            Ask natural language questions to query tenders, detect vendor single-bid anomalies, map director networks, or summarize organization spend.
          </p>

          {/* Prompt Suggestion Chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, maxWidth: 800, width: '100%' }}>
            <div 
              onClick={() => sendQuery('Run anomaly detection on the top winning organizations and flag suspicious single-bid patterns')}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all 0.2s' }}
              className="hover-row"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                <Scan size={16} color="#3b82f6" /> Anomaly Audit
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>Identify top organizations with single-bid tender distributions.</div>
            </div>

            <div 
              onClick={() => sendQuery('Flag all single-bid contracts over 1 crore INR awarded in the last 2 years')}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all 0.2s' }}
              className="hover-row"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                <Flag size={16} color="#f59e0b" /> Single-Bid Contracts
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>Extract high-value tenders awarded with zero competitive bidding.</div>
            </div>

            <div 
              onClick={() => sendQuery('Map vendor relationships and list repeat award winners in Maharashtra')}
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px', maxWidth: 880, margin: '0 auto', width: '100%' }}>
          {messages.map((m, idx) => (
            <div key={idx} style={{ marginBottom: 24, display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', gap: 14, alignItems: 'flex-start' }}>
              {m.role === 'user' ? (
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white' }}>
                  <User size={18} />
                </div>
              ) : (
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white' }}>
                  <Sparkles size={18} />
                </div>
              )}

              <div style={{ 
                maxWidth: '80%', 
                padding: m.role === 'user' ? '12px 18px' : '16px 20px', 
                borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', 
                background: m.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-card)', 
                color: m.role === 'user' ? 'white' : 'var(--text-primary)', 
                border: m.role === 'user' ? 'none' : '1px solid var(--border-color)', 
                boxShadow: 'var(--shadow-sm)',
                lineHeight: 1.6,
                fontSize: 14
              }}>
                {m.role === 'ai' ? (
                  m.content ? (
                    <div className="markdown-body" style={{ color: 'var(--text-primary)' }}>
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                      <Sparkles className="animate-spin-slow" size={16} />
                      Thinking and searching data warehouse...
                    </div>
                  )
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* Input Dock */}
      <div style={{ padding: '16px 24px 24px 24px', maxWidth: 880, width: '100%', margin: '0 auto' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 14, boxShadow: 'var(--shadow-md)' }}>
          <textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(); } }}
            placeholder="Ask Darshi to investigate..."
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
                <option value="gemini-3.5-flash">Gemini 3.5 Flash Engine</option>
                <option value="gpt-5.5">GPT-5.5 Engine</option>
                <option value="grok-4.3">Grok 4.3 Engine</option>
                <option value="deepseek-v4-pro">DeepSeek V4 Pro Engine</option>
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
          Darshi AI can make mistakes. Verify critical findings independently before publication.
        </div>
      </div>
    </div>
  );
};

export default AiChat;
