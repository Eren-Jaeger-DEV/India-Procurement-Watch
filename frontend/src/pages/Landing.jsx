import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, ArrowRight, Activity, Globe, Bot,
  AlertTriangle, BarChart2, Network, ChevronDown, Users
} from 'lucide-react';
import { motion } from 'framer-motion';
import AnimatedHeroArtwork from '../components/AnimatedHeroArtwork';
import './Landing.css';

// =============================================
// CONFIG - flip to true to show maintenance UI
const IS_MAINTENANCE = false;
// =============================================

// - Intersection Observer hook (fires once)
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

// - Animated number counter
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
      
      <AnimatedHeroArtwork />

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
        <h1 className="lp-hero-title">
          <span className="lp-gradient-text">Government Procurement</span>
          <br />
          <span className="lp-accent-text">Finally Transparent.</span>
        </h1>

        <p className="lp-hero-sub">
          India Procurement Watch turns hundreds of thousands of public tender records into actionable intelligence - surfacing anomalies, mapping vendor networks, and enabling investigative journalism at scale.
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
      <motion.div 
        id="data-sources"
        className="lp-stats"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
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
      </motion.div>

      <div className="lp-section-divider" />

      {/* ── Features ── */}
      <motion.section 
        className="lp-features" id="features"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
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
                  <span className="lp-feature-number">{f.number}</span>
                  <div className="lp-feature-icon" style={{ background: f.bg }}>
                    <Icon size={26} color={f.color} className="lp-feature-icon-inner" />
                  </div>
                  <h3 className="lp-feature-title">{f.title}</h3>
                  <p className="lp-feature-desc">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </motion.section>

      <div className="lp-section-divider" />

      {/* ── CTA ── */}
      <motion.section 
        className="lp-cta-section" id="methodology"
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
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
            All findings are derived exclusively from government procurement portals under the Right to Information Act. Anomaly scores are statistical indicators - not legal conclusions. Every methodology is documented and open.
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
      </motion.section>

      {/* ── Community Section ── */}
      <section className="lp-community-section">
        <div className="lp-community-card">
          <div className="lp-community-icon">
            <Users size={28} color="#ffffff" />
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
            <div className="discord-btn-glow"></div>
            <svg width="22" height="22" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true" style={{ position: 'relative', zIndex: 2 }}>
              <path d="M297.2 314.9c-15.7 0-28.5 14-28.5 31.1s12.8 31.1 28.5 31.1 28.5-14 28.5-31.1-12.8-31.1-28.5-31.1zm-146.4 0c-15.7 0-28.5 14-28.5 31.1s12.8 31.1 28.5 31.1 28.5-14 28.5-31.1-12.8-31.1-28.5-31.1zm227.1-196.4C353.4 97.4 322.3 83.3 289 77.6c-.3-.1-.5-.2-.7 0-2.3 4.1-4.9 9.5-6.8 13.9-35.9-5.4-71.8-5.4-106.9 0-1.9-4.5-4.5-9.8-6.9-13.9-.2-.2-.4-.3-.7 0-33.3 5.7-64.4 19.8-88.9 40.9-.3.2-.4.4-.4.7C20.7 236 1.7 348 24.3 457.7c.1.4.3.7.6.9 43.1 31.7 84.8 51.1 125.7 64 .4.1.8-.1 1-.5 9.7-13.3 18.4-27.4 26-42.3.2-.5 0-1.1-.5-1.3-14.3-5.4-28-11.9-41-19.1-.6-.3-.7-1-.3-1.4 2.7-2 5.4-4.1 8-6.3.3-.2.6-.3.9-.2 85.5 39 177.3 39 262.2 0 .3-.1.7-.1.9.2 2.6 2.2 5.3 4.3 8 6.3.4.4.3 1.1-.3 1.4-13 7.2-26.7 13.7-41 19.1-.6.2-.8.8-.5 1.3 7.6 14.9 16.3 29 26 42.3.2.4.6.6 1 .5 40.9-12.9 82.6-32.3 125.7-64 .3-.2.5-.5.6-.9 28.3-137.9 1-253.6-53.6-338.4-.2-.5-.5-.7-.8-.9zM224 416c-84.5 0-128.5-59.5-128.5-59.5s3.2-12.4 20-31.4c21.8 13.1 50.1 21.6 88 24 14.8 1 29.8 1 44.8 0 38-2.4 66.2-10.9 88-24 16.8 19 20 31.4 20 31.4S308.5 416 224 416zm-59.1-85.3c-24.1 0-43.6-21.5-43.6-47.8 0-26.4 19.2-47.8 43.6-47.8 24.5 0 44 21.6 43.6 47.8 0 26.4-19.1 47.8-43.6 47.8zm118.2 0c-24.1 0-43.6-21.5-43.6-47.8 0-26.4 19.2-47.8 43.6-47.8 24.5 0 44 21.6 43.6 47.8 0 26.4-19.1 47.8-43.6 47.8z"/>
            </svg>
            <span style={{ position: 'relative', zIndex: 2 }}>Join on Discord</span>
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
            <svg width="16" height="16" viewBox="0 0 448 512" fill="currentColor" style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} aria-hidden="true">
              <path d="M297.2 314.9c-15.7 0-28.5 14-28.5 31.1s12.8 31.1 28.5 31.1 28.5-14 28.5-31.1-12.8-31.1-28.5-31.1zm-146.4 0c-15.7 0-28.5 14-28.5 31.1s12.8 31.1 28.5 31.1 28.5-14 28.5-31.1-12.8-31.1-28.5-31.1zm227.1-196.4C353.4 97.4 322.3 83.3 289 77.6c-.3-.1-.5-.2-.7 0-2.3 4.1-4.9 9.5-6.8 13.9-35.9-5.4-71.8-5.4-106.9 0-1.9-4.5-4.5-9.8-6.9-13.9-.2-.2-.4-.3-.7 0-33.3 5.7-64.4 19.8-88.9 40.9-.3.2-.4.4-.4.7C20.7 236 1.7 348 24.3 457.7c.1.4.3.7.6.9 43.1 31.7 84.8 51.1 125.7 64 .4.1.8-.1 1-.5 9.7-13.3 18.4-27.4 26-42.3.2-.5 0-1.1-.5-1.3-14.3-5.4-28-11.9-41-19.1-.6-.3-.7-1-.3-1.4 2.7-2 5.4-4.1 8-6.3.3-.2.6-.3.9-.2 85.5 39 177.3 39 262.2 0 .3-.1.7-.1.9.2 2.6 2.2 5.3 4.3 8 6.3.4.4.3 1.1-.3 1.4-13 7.2-26.7 13.7-41 19.1-.6.2-.8.8-.5 1.3 7.6 14.9 16.3 29 26 42.3.2.4.6.6 1 .5 40.9-12.9 82.6-32.3 125.7-64 .3-.2.5-.5.6-.9 28.3-137.9 1-253.6-53.6-338.4-.2-.5-.5-.7-.8-.9zM224 416c-84.5 0-128.5-59.5-128.5-59.5s3.2-12.4 20-31.4c21.8 13.1 50.1 21.6 88 24 14.8 1 29.8 1 44.8 0 38-2.4 66.2-10.9 88-24 16.8 19 20 31.4 20 31.4S308.5 416 224 416zm-59.1-85.3c-24.1 0-43.6-21.5-43.6-47.8 0-26.4 19.2-47.8 43.6-47.8 24.5 0 44 21.6 43.6 47.8 0 26.4-19.1 47.8-43.6 47.8zm118.2 0c-24.1 0-43.6-21.5-43.6-47.8 0-26.4 19.2-47.8 43.6-47.8 24.5 0 44 21.6 43.6 47.8 0 26.4-19.1 47.8-43.6 47.8z"/>
            </svg>
            Discord
          </a>
          <a className="lp-footer-link" href="mailto:contact@darshi.app">Contact</a>
        </nav>
      </footer>
    </div>
  );
}
