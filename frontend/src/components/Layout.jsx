import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Search, FileSearch, Bot, Sun, Moon, X, PanelLeftClose, PanelLeftOpen, Map, Network, Menu, Activity, Flag, TrendingUp, ShieldAlert, Building2, MapPin, GitBranch } from 'lucide-react';
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
  const [isDark, setIsDark]           = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < 1200);
  const [isHovered, setIsHovered]     = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [modalOpen, setModalOpen]     = useState(false);
  const [modalData, setModalData]     = useState(null);
  const location = useLocation();

  // Auto-collapse based on screen resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1200) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Collapse sidebar when a route changes (navigation) if screen is small
  useEffect(() => {
    setMobileMenuOpen(false);
    if (window.innerWidth < 1200) {
      setIsCollapsed(true);
      setIsHovered(false);
    }
  }, [location]);

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

  // Compute visual collapsed state (collapsed only if state is collapsed and not hovered)
  const isVisuallyCollapsed = isCollapsed && !isHovered;

  const handleNavItemClick = () => {
    if (window.innerWidth < 1200) {
      setIsCollapsed(true);
      setIsHovered(false);
    }
  };

  return (
    <div className="app-container">
      <aside 
        className={`sidebar ${isVisuallyCollapsed ? 'collapsed' : ''}`}
        onMouseEnter={() => { if (isCollapsed) setIsHovered(true); }}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="sidebar-header" style={{ justifyContent: isVisuallyCollapsed ? 'center' : 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
            <div className="brand-icon" style={{ padding: 0, overflow: 'hidden', borderRadius: '50%', width: 32, height: 32, minWidth: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/logo.jpg" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            {!isVisuallyCollapsed && (
              <div className="brand-text">
                <div className="brand-title">India Procurement</div>
                <div className="brand-sub">Watch · Analysis Tool</div>
              </div>
            )}
          </div>
        </div>
        
        <div className="sidebar-nav">
          <div className="nav-section">
            {!isVisuallyCollapsed && <div className="nav-label">Main</div>}
            <NavLink to="/dashboard" onClick={handleNavItemClick} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isVisuallyCollapsed ? "Overview" : ""}>
              <LayoutDashboard size={18} />
              {!isVisuallyCollapsed && <span>Overview</span>}
            </NavLink>
            <NavLink to="/search" onClick={handleNavItemClick} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isVisuallyCollapsed ? "Search Database" : ""}>
              <Search size={18} />
              {!isVisuallyCollapsed && <span>Search Database</span>}
            </NavLink>
            <NavLink to="/chat" onClick={handleNavItemClick} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isVisuallyCollapsed ? "Ask AI" : ""}>
              <Bot size={18} />
              {!isVisuallyCollapsed && <span>Ask AI</span>}
            </NavLink>
            <NavLink to="/report" onClick={handleNavItemClick} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isVisuallyCollapsed ? "Analysis Report" : ""}>
              <FileText size={18} />
              {!isVisuallyCollapsed && <span>Analysis Report</span>}
            </NavLink>
          </div>

          <div className="nav-section">
            {!isVisuallyCollapsed && <div className="nav-label">Analytics & Risk</div>}
            <NavLink to="/geo" onClick={handleNavItemClick} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isVisuallyCollapsed ? "Geographical" : ""}>
              <Map size={18} />
              {!isVisuallyCollapsed && <span>Geographical</span>}
            </NavLink>
            <NavLink to="/tenders-map" onClick={handleNavItemClick} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isVisuallyCollapsed ? "Tender Map" : ""}>
              <MapPin size={18} />
              {!isVisuallyCollapsed && <span>Tender Map</span>}
            </NavLink>
            <NavLink to="/insights" onClick={handleNavItemClick} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isVisuallyCollapsed ? "Insights" : ""}>
              <TrendingUp size={18} />
              {!isVisuallyCollapsed && <span>Insights</span>}
            </NavLink>
            <NavLink to="/departments" onClick={handleNavItemClick} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isVisuallyCollapsed ? "Department Radar" : ""}>
              <Building2 size={18} />
              {!isVisuallyCollapsed && <span>Department Radar</span>}
            </NavLink>
            <NavLink to="/collusion" onClick={handleNavItemClick} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isVisuallyCollapsed ? "Cartel Radar" : ""}>
              <ShieldAlert size={18} style={{ color: '#ef4444' }} />
              {!isVisuallyCollapsed && <span>Cartel Radar</span>}
            </NavLink>
            <NavLink to="/redflag" onClick={handleNavItemClick} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isVisuallyCollapsed ? "Red-Flag Explorer" : ""}>
              <Flag size={18} />
              {!isVisuallyCollapsed && <span>Red-Flag Explorer</span>}
            </NavLink>
            <NavLink to="/investigation" onClick={handleNavItemClick} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isVisuallyCollapsed ? "Investigation Desk" : ""}>
              <FileSearch size={18} />
              {!isVisuallyCollapsed && <span>Investigation Desk</span>}
            </NavLink>
            <NavLink to="/network" onClick={handleNavItemClick} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isVisuallyCollapsed ? "Director Networks" : ""}>
              <Network size={18} />
              {!isVisuallyCollapsed && <span>Director Networks</span>}
            </NavLink>
            <NavLink to="/import" onClick={handleNavItemClick} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isVisuallyCollapsed ? "System Status" : ""}>
              <Activity size={18} />
              {!isVisuallyCollapsed && <span>System Status</span>}
            </NavLink>
            <NavLink to="/data-sources" onClick={handleNavItemClick} className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isVisuallyCollapsed ? "Data Sources" : ""}>
              <GitBranch size={18} />
              {!isVisuallyCollapsed && <span>Data Sources</span>}
            </NavLink>
          </div>
        </div>

        <div className="sidebar-footer" style={{ flexDirection: isVisuallyCollapsed ? 'column' : 'row', gap: isVisuallyCollapsed ? '6px' : '8px' }}>
          <button 
            className="nav-item collapse-toggle-btn" 
            onClick={() => { setIsCollapsed(!isCollapsed); setIsHovered(false); }} 
            style={{ flex: isVisuallyCollapsed ? 'none' : 1, margin: 0, justifyContent: 'center', padding: '8px', minHeight: '36px' }}
            title={isVisuallyCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isVisuallyCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!isVisuallyCollapsed && <span style={{ fontSize: 13, fontWeight: 600 }}>Collapse</span>}
          </button>
          <button 
            className="nav-item theme-toggle-btn" 
            onClick={() => setIsDark(!isDark)} 
            style={{ width: isVisuallyCollapsed ? '100%' : '40px', margin: 0, justifyContent: 'center', padding: '8px', flexShrink: 0, minHeight: '36px' }}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            <div className={`theme-icon-wrapper ${isDark ? 'dark' : 'light'}`}>
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </div>
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
