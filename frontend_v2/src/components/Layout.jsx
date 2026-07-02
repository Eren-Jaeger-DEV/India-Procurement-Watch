import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Search, Activity, Database, Map, FileSearch, Network, Bot, Sun, Moon, X, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState, useEffect } from 'react';
import './Layout.css';

const Layout = () => {
  const [isDark, setIsDark] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState(null);

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
          <NavLink to="/import" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isCollapsed ? "Data Import" : ""}>
            <Database size={20} />
            {!isCollapsed && <span>Data Import</span>}
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
        </div>

        <div className="nav-section">
          {!isCollapsed && <div className="nav-label">Data Points</div>}
          <NavLink to="/investigation" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'} title={isCollapsed ? "Investigation Desk" : ""}>
            <FileSearch size={20} />
            {!isCollapsed && <span>Investigation Desk</span>}
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

      <main className="main-content">
        <Outlet />
      </main>

      {/* Global Tender Modal */}
      {modalOpen && (
        <>
          <div className="modal-backdrop" onClick={() => setModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 998 }}></div>
          <div className="modal" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--bg-card)', padding: 24, borderRadius: 'var(--radius-lg)', zIndex: 999, width: '90%', maxWidth: 600, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)' }}>
            <button onClick={() => setModalOpen(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Tender Detail</h2>
            {modalData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Title:</strong> <div>{modalData.tender_title || 'N/A'}</div></div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Organization:</strong> <div>{modalData.org_name || 'N/A'}</div></div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Value:</strong> <div>{modalData.value_lakh ? `₹${modalData.value_lakh}L` : 'N/A'}</div></div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Winner:</strong> <div>{modalData.vendor_name || 'N/A'}</div></div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Date:</strong> <div>{modalData.published_date || 'N/A'}</div></div>
              </div>
            ) : (
              <div>No data available</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Layout;
