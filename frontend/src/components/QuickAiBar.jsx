import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, Send, ChevronRight } from 'lucide-react';
import { streamAiChat } from '../lib/api';

const SUGGESTIONS = [
  'Which orgs have most single-bid contracts?',
  'Top states by contract value?',
  'Largest contract awards in 2024?',
  'Show repeat winning vendors',
];

const QuickAiBar = () => {
  const [open,     setOpen]     = useState(false);
  const [query,    setQuery]    = useState('');
  const [answer,   setAnswer]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const inputRef   = useRef(null);
  const answerRef  = useRef(null);
  const navigate   = useNavigate();

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Auto-scroll answer
  useEffect(() => {
    if (answerRef.current) answerRef.current.scrollTop = answerRef.current.scrollHeight;
  }, [answer]);

  const handleSubmit = async (text) => {
    const q = (text || query).trim();
    if (!q) return;
    setAnswer('');
    setLoading(true);

    await streamAiChat(
      q,
      'gemini-2.5-flash',
      (payload) => {
        if (payload.type === 'text' || payload.type === 'summary_chunk') {
          setAnswer(prev => prev + payload.content);
        } else if (payload.type === 'error') {
          setAnswer(`⚠️ ${payload.content || 'An error occurred. Please try again.'}`);
        }
      },
      () => setLoading(false),
      () => setLoading(false),
    );
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') setOpen(false);
  };

  const openFullChat = () => {
    setOpen(false);
    navigate('/chat');
  };

  return (
    <>
      {/* Floating trigger button — bottom right of main content */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Ask AI about procurement data"
          style={{
            position: 'fixed',
            bottom: 80,
            right: 24,
            zIndex: 900,
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,0,0,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)'; }}
        >
          <Sparkles size={22} />
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 400,
            maxHeight: 520,
            zIndex: 901,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 16,
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
              <Sparkles size={18} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Ask the Data</span>
              <span style={{ fontSize: 11, opacity: 0.8 }}>3.2M+ tenders</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={openFullChat}
                title="Open full AI chat"
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 500 }}
              >
                Full Chat
              </button>
              <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 2 }}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Suggestions */}
          {!answer && !loading && (
            <div style={{ padding: '10px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setQuery(s); handleSubmit(s); }}
                  style={{
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    borderRadius: 20,
                    padding: '4px 10px',
                    fontSize: 11,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Answer area */}
          {(answer || loading) && (
            <div
              ref={answerRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 16px',
                fontSize: 13,
                lineHeight: 1.6,
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              {loading && !answer && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', color: 'var(--text-muted)' }}>
                  <span style={{ animation: 'pulse 1s ease-in-out infinite' }}>●</span>
                  <span style={{ animation: 'pulse 1s ease-in-out infinite 0.2s' }}>●</span>
                  <span style={{ animation: 'pulse 1s ease-in-out infinite 0.4s' }}>●</span>
                  <style>{`@keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
                </div>
              )}
              {answer}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about procurement data…"
              disabled={loading}
              style={{
                flex: 1,
                background: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 13,
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
            <button
              onClick={() => handleSubmit()}
              disabled={loading || !query.trim()}
              style={{
                background: 'var(--accent-primary)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 10px',
                color: '#fff',
                cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !query.trim() ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default QuickAiBar;
