import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Search, FileSearch, Bot, Sun, Moon, X, PanelLeftClose, PanelLeftOpen, Map, Network, Menu, Activity, Flag, TrendingUp, ShieldAlert, Building2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import QuickAiBar from './QuickAiBar';
import TenderModal from './TenderModal';
import './Layout.css';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { to: '/search',    icon: Search,          label: 'Search'   },
  { to: '/chat',      icon: Bot,             label: 'Ask AI'   },
  { to: '/investigation', icon: FileSearch,  label: 'Investigate' },
  { to: '/report',    icon: FileText,        label: 'Report'   },
];

const Layout = () => {
  const [isDark, setIsDark]       = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState(null);
  const location = useLocation();

  // Close mobile menu on route change
  useEffect(() => { setMobileMenuOpen(false); }, [location]);

  useEffect(() => {
    document.body.className = isDark ? 'dark-theme' : 'light-theme';
  }, [isDark]);

  // Global event listener for opening the tender modal from any child page
  useEffect(() => {
    const handleOpenModal = (e) => {
      setModalData(e.detail);
      setModalOpen(true);
    };
    window.addEventListener('openTenderModal', handleOpenModal);
    return () => window.removeEventListener('openTenderModal', handleOpenModal);
  }, []);

  return (
    <div className="app-container">
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header" style={{ justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
            <div className="brand-icon" style={{ padding: 0, overflow: 'hidden', borderRadius: '50%', width: 32, height: 32, minWidth: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/logo.jpg" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            {!isCollapsed && (
              <div className="brand-text">
                <div className="brand-title">India Procurement</div>
                <div className="brand-sub">Watch · Analysis Tool</div>
              </div>
            )}
          </div>
        </div>
        
        <div className="nav-section">
          {!isCollapsed && <div className="nav-label">Data</div>}
          <NavLink to="/import" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isCollapsed ? "System Status" : ""}>
            <Activity size={20} />
            {!isCollapsed && <span>System Status</span>}
          </NavLink>
        </div>

        <div className="nav-section">
          {!isCollapsed && <div className="nav-label">Analysis</div>}
          <NavLink to="/report" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isCollapsed ? "Analysis Report" : ""}>
            <FileText size={20} />
            {!isCollapsed && <span>Analysis Report</span>}
          </NavLink>
          <NavLink to="/dashboard" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isCollapsed ? "Overview" : ""}>
            <LayoutDashboard size={20} />
            {!isCollapsed && <span>Overview</span>}
          </NavLink>
          <NavLink to="/geo" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isCollapsed ? "Geographical" : ""}>
            <Map size={20} />
            {!isCollapsed && <span>Geographical</span>}
          </NavLink>
          <NavLink to="/insights" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isCollapsed ? "Insights" : ""}>
            <TrendingUp size={20} />
            {!isCollapsed && <span>Insights</span>}
          </NavLink>
          <NavLink to="/departments" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isCollapsed ? "Department Radar" : ""}>
            <Building2 size={20} />
            {!isCollapsed && <span>Department Radar</span>}
          </NavLink>
          <NavLink to="/collusion" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isCollapsed ? "Cartel Radar" : ""}>
            <ShieldAlert size={20} style={{ color: '#ef4444' }} />
            {!isCollapsed && <span>Cartel Radar</span>}
          </NavLink>
        </div>

        <div className="nav-section">
          {!isCollapsed && <div className="nav-label">Data Points</div>}
          <NavLink to="/investigation" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isCollapsed ? "Investigation Desk" : ""}>
            <FileSearch size={20} />
            {!isCollapsed && <span>Investigation Desk</span>}
          </NavLink>
          <NavLink to="/redflag" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isCollapsed ? "Red-Flag Explorer" : ""}>
            <Flag size={20} />
            {!isCollapsed && <span>Red-Flag Explorer</span>}
          </NavLink>
          <NavLink to="/search" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isCollapsed ? "Search Database" : ""}>
            <Search size={20} />
            {!isCollapsed && <span>Search Database</span>}
          </NavLink>
          <NavLink to="/network" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isCollapsed ? "Director Networks" : ""}>
            <Network size={20} />
            {!isCollapsed && <span>Director Networks</span>}
          </NavLink>
          <NavLink to="/chat" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isCollapsed ? "Ask AI" : ""}>
            <Bot size={20} />
            {!isCollapsed && <span>Ask AI</span>}
          </NavLink>
        </div>

        <div className="sidebar-footer" style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: 12, paddingBottom: 12 }}>
          <button 
            className="nav-item collapse-toggle-btn" 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', justifyContent: isCollapsed ? 'center' : 'flex-start', marginBottom: 6 }}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            {!isCollapsed && <span>Collapse Sidebar</span>}
          </button>
          <button 
            className="nav-item theme-toggle-btn" 
            onClick={() => setIsDark(!isDark)} 
            style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', justifyContent: isCollapsed ? 'center' : 'flex-start' }}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            <div className={`theme-icon-wrapper ${isDark ? 'dark' : 'light'}`}>
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </div>
            {!isCollapsed && <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Top Header — hidden on desktop */}
      <header className="mobile-header">
        <div className="mobile-header-brand">
          <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', minWidth: 28 }}>
            <img src="/logo.jpg" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span className="mobile-header-title">IPW</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="mobile-icon-btn"
            onClick={() => setIsDark(!isDark)}
            title="Toggle Theme"
          >
            <div className={`theme-icon-wrapper ${isDark ? 'dark' : 'light'}`}>
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </div>
          </button>
          <button
            className="mobile-icon-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            title="More pages"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Mobile slide-up menu for secondary pages */}
      {mobileMenuOpen && (
        <>
          <div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)} />
          <div className="mobile-slide-menu">
            <div className="mobile-slide-menu-header">
              <span>All Pages</span>
              <button className="mobile-icon-btn" onClick={() => setMobileMenuOpen(false)}><X size={20} /></button>
            </div>
            <NavLink to="/geo"          className={({isActive}) => `mobile-menu-item ${isActive ? 'active' : ''}`}><Map size={18}/> Geographical</NavLink>
            <NavLink to="/network"      className={({isActive}) => `mobile-menu-item ${isActive ? 'active' : ''}`}><Network size={18}/> Director Networks</NavLink>
            <NavLink to="/organizations" className={({isActive}) => `mobile-menu-item ${isActive ? 'active' : ''}`}><LayoutDashboard size={18}/> Organizations</NavLink>
            <NavLink to="/import"       className={({isActive}) => `mobile-menu-item ${isActive ? 'active' : ''}`}><Activity size={18}/> System Status</NavLink>
          </div>
        </>
      )}

      <main className="main-content">
        <Outlet />
      </main>

      {/* Mobile Bottom Nav — hidden on desktop */}
      <nav className="mobile-bottom-nav">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Global Tender Inspector Modal */}
      <TenderModal isOpen={modalOpen} onClose={() => setModalOpen(false)} initialData={modalData} />

      {/* Persistent floating AI query bar — visible on all pages */}
      <QuickAiBar />
    </div>
  );
};

export default Layout;
