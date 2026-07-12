import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, ArrowRight, Activity, Globe, Bot,
  AlertTriangle, BarChart2, Network, ChevronDown, Users
} from 'lucide-react';
import ParticleNetwork from '../components/ParticleNetwork';
import './Landing.css';

// =============================================
// CONFIG — flip to true to show maintenance UI
const IS_MAINTENANCE = false;
// =============================================

// — Intersection Observer hook (fires once)
function useReveal(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, visible];
}

// — Animated number counter
function Counter({ end, suffix = '' }) {
  const [count, setCount] = useState(0);
  const [ref, visible] = useReveal(0.5);
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const duration = 1800;
    const step = Math.ceil(end / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [visible, end]);
  return <span ref={ref}>{count.toLocaleString('en-IN')}{suffix}</span>;
}

const FEATURES = [
  {
    icon: Activity,
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.1)',
    number: '01',
    title: 'Algorithmic Anomaly Detection',
    desc: 'Instant flagging of high-value single-bid contracts and repeat award patterns that statistically deviate from fair competition norms.',
  },
  {
    icon: Globe,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.1)',
    number: '02',
    title: 'Geospatial Intelligence',
    desc: 'Visualize procurement volume across all Indian states, track regional infrastructure spending, and identify funding concentration.',
  },
  {
    icon: Bot,
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.1)',
    number: '03',
    title: 'AI Investigation Desk',
    desc: 'Query the Darshi Intelligence engine in plain language. Cross-reference vendors with MCA corporate filings and director networks instantly.',
  },
  {
    icon: Network,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
    number: '04',
    title: 'Vendor Network Mapping',
    desc: 'Visualize hidden ownership links between vendors and discover shell company clusters winning related tenders simultaneously.',
  },
  {
    icon: BarChart2,
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.1)',
    number: '05',
    title: 'Live Tender Search',
    desc: 'Full-text search across all ingested tenders. Filter by state, department, value range, and date. Download raw datasets in CSV.',
  },
  {
    icon: Shield,
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.1)',
    number: '06',
    title: 'Open-Source Methodology',
    desc: 'Every algorithm powering the anomaly scores is documented and public. Verify our work, fork our methodology, build on top of it.',
  },
];

const STATS = [
  { value: 450000, suffix: '+', label: 'Tenders Indexed' },
  { value: 28,     suffix: '',  label: 'States Covered'  },
  { value: 12000,  suffix: 'Cr+', label: 'Spend Analysed (₹)' },
  { value: 99,     suffix: '%', label: 'Uptime SLA'      },
];

// ---- Main Component ----
export default function Landing() {
  const navigate = useNavigate();
  const [featRef, featVisible] = useReveal(0.07);
  const [ctaRef,  ctaVisible]  = useReveal(0.3);

  const goToDashboard = useCallback(() => navigate('/dashboard'), [navigate]);

  return (
    <div className="landing-page-wrapper" style={{ background: '#090a0f', color: '#fff', height: '100vh', overflowY: 'auto', overflowX: 'hidden', fontFamily: "'Inter', -apple-system, sans-serif", position: 'relative' }}>
      
      {/* Background Image Container */}
      <div className="lp-custom-bg" style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '100vh',
        backgroundImage: 'url("/landing-hero.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        opacity: 0.3, /* Dimmed so text remains readable */
        zIndex: 0,
        pointerEvents: 'none'
      }}>
        {/* Optional top/bottom gradient fade for blending */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '150px', background: 'linear-gradient(to bottom, #090a0f, transparent)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '150px', background: 'linear-gradient(to top, #090a0f, transparent)' }} />
      </div>

      {/* ── Navbar ── */}
      <nav className="lp-nav">
        <div className="lp-logo">
          <img src="/logo.png" alt="IPW Logo" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
        </div>
        <ul className="lp-nav-links">
          <li><a className="lp-nav-link" href="#features">Features</a></li>
          <li><a className="lp-nav-link" href="#methodology">Methodology</a></li>
          <li><a className="lp-nav-link" href="#data">Data Sources</a></li>
        </ul>
        {IS_MAINTENANCE
          ? <span style={{ fontSize: '13px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} /> Under Maintenance</span>
          : <button className="lp-nav-cta" onClick={goToDashboard}>Launch Dashboard →</button>
        }
      </nav>

      <section className="lp-hero" style={{ background: 'transparent' }}>
        <div className="lp-badge">
          <span className="lp-badge-dot" />
          Live &mdash; {new Date().getFullYear()} data pipeline active
        </div>

        <h1 className="lp-hero-title">
          <span className="lp-gradient-text">Government Procurement</span>
          <br />
          <span className="lp-accent-text">Finally Transparent.</span>
        </h1>

        <p className="lp-hero-sub">
          India Procurement Watch turns hundreds of thousands of public tender records into actionable intelligence — surfacing anomalies, mapping vendor networks, and enabling investigative journalism at scale.
        </p>

        <div className="lp-hero-actions">
          {IS_MAINTENANCE ? (
            <div className="lp-maintenance">
              <AlertTriangle size={22} />
              <div>
                <strong style={{ display: 'block', color: '#f87171', fontSize: '15px' }}>System Under Maintenance</strong>
                <span style={{ fontSize: '14px' }}>The data pipeline is syncing. Please check back soon.</span>
              </div>
            </div>
          ) : (
            <>
              <button className="lp-btn-primary" onClick={goToDashboard}>
                Launch Dashboard <ArrowRight size={18} />
              </button>
              <a className="lp-btn-secondary" href="#features">
                See How It Works
              </a>
            </>
          )}
        </div>

        <div className="lp-scroll-hint">
          <div className="lp-scroll-line" />
          <ChevronDown size={16} />
        </div>
      </section>

      {/* ── Stats ── */}
      <div className="lp-stats">
        <div className="lp-stats-grid">
          {STATS.map((s) => (
            <div key={s.label} className="lp-stat">
              <div className="lp-stat-value">
                <Counter end={s.value} suffix={s.suffix} />
              </div>
              <div className="lp-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="lp-section-divider" />

      {/* ── Features ── */}
      <section className="lp-features" id="features">
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 80px' }}>
            <span className="lp-section-label">Capabilities</span>
            <h2 className="lp-section-title lp-gradient-text">Everything you need to investigate procurement</h2>
            <p className="lp-section-desc" style={{ margin: '0 auto' }}>
              Six analytical lenses built on top of a continuously updated public data pipeline covering all major Indian procurement portals.
            </p>
          </div>

          <div ref={featRef} className="lp-feature-grid">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={`lp-feature-card${featVisible ? ` lp-visible lp-d${Math.min(i + 1, 5)}` : ''}`}
                  style={{ opacity: featVisible ? undefined : 0 }}
                >
                  <div className="lp-feature-icon" style={{ background: f.bg }}>
                    <Icon size={26} color={f.color} className="lp-feature-icon-inner" />
                    <span className="lp-feature-number">{f.number}</span>
                  </div>
                  <h3 className="lp-feature-title">{f.title}</h3>
                  <p className="lp-feature-desc">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="lp-section-divider" />

      {/* ── CTA ── */}
      <section className="lp-cta-section" id="methodology">
        <div
          ref={ctaRef}
          className={`lp-cta-card${ctaVisible ? ' lp-visible' : ''}`}
          style={{ opacity: ctaVisible ? undefined : 0 }}
        >
          <span className="lp-section-label">Open Data</span>
          <h2 className="lp-section-title lp-gradient-text" style={{ marginBottom: 20 }}>
            Built on public records.<br />Open for public scrutiny.
          </h2>
          <p style={{ color: '#71717a', fontSize: '17px', lineHeight: 1.7, maxWidth: 560, margin: '0 auto 48px', }}>
            All findings are derived exclusively from government procurement portals under the Right to Information Act. Anomaly scores are statistical indicators — not legal conclusions. Every methodology is documented and open.
          </p>
          {!IS_MAINTENANCE && (
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="lp-btn-primary" onClick={goToDashboard}>
                Open the Dashboard <ArrowRight size={18} />
              </button>
              <button className="lp-btn-secondary">Read the Methodology</button>
            </div>
          )}
        </div>
      </section>

      {/* ── Community Section ── */}
      <section className="lp-community-section">
        <div className="lp-community-card">
          <div className="lp-community-icon">
            <Users size={28} color="#5865f2" />
          </div>
          <div className="lp-community-text">
            <h3 className="lp-community-title">Join the Community</h3>
            <p className="lp-community-desc">
              Follow progress, contribute ideas, report data gaps, and connect with journalists, researchers, and civic technologists building on IPW.
            </p>
          </div>
          <a
            className="lp-discord-btn"
            href="https://discord.gg/Darshi"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            Join on Discord
          </a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-logo" style={{ gap: 10 }}>
          <img src="/logo.png" alt="IPW Logo" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
          <span className="lp-footer-copy">India Procurement Watch &copy; {new Date().getFullYear()}</span>
        </div>
        <nav className="lp-footer-links">
          <a className="lp-footer-link" href="#methodology">Methodology</a>
          <a className="lp-footer-link" href="#data">Data Sources</a>
          <a
            className="lp-footer-link lp-discord-footer-link"
            href="https://discord.gg/Darshi"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} aria-hidden="true">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            Discord
          </a>
          <a className="lp-footer-link" href="mailto:contact@darshi.app">Contact</a>
        </nav>
      </footer>
    </div>
  );
}
