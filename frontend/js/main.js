/* ═══════════════════════════════════════════
   main.js — Dashboard initialization & data orchestration
   India Procurement Watch — Power Analysis Tool
   ═══════════════════════════════════════════ */

// ── GLOBALS ──
const chartInstances = {};

// ── HELPERS ──
function fmtNum(n) {
  if (n === null || n === undefined) return '—';
  n = Number(n);
  if (n >= 1e7) return (n / 1e7).toFixed(1) + ' Cr';
  if (n >= 1e5) return (n / 1e5).toFixed(1) + ' L';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString('en-IN');
}

function fmtCrore(v) {
  if (!v && v !== 0) return '—';
  v = Number(v);
  if (v >= 1e5) return '₹' + (v / 1e5).toFixed(1) + ' L Cr';
  if (v >= 1000) return '₹' + (v / 1000).toFixed(1) + 'K Cr';
  return '₹' + v.toFixed(1) + ' Cr';
}

function portalBadge(p) {
  const cls = p === 'central' ? 'portal-central' : p === 'state' ? 'portal-state' : 'portal-org';
  return `<span class="portal-badge ${cls}">${p || 'n/a'}</span>`;
}

function gradeBadge(g) {
  return `<div class="grade-badge grade-${g}">${g}</div>`;
}

function buildPagination(containerId, currentPage, totalPages, onClick) {
  const el = document.getElementById(containerId);
  if (!el) return;
  let html = '';
  const prev = currentPage - 1;
  const next = currentPage + 1;
  html += `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="${onClick}(${prev})">‹ Prev</button>`;
  const start = Math.max(1, currentPage - 2);
  const end   = Math.min(totalPages, currentPage + 2);
  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="${onClick}(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="${onClick}(${next})">Next ›</button>`;
  el.innerHTML = html;
}

// ── THEME TOGGLE ──
window.toggleTheme = function() {
  document.body.classList.toggle('light-mode');
  const isLight = document.body.classList.contains('light-mode');
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    btn.innerHTML = `<i data-lucide="${isLight ? 'moon' : 'sun'}"></i><span>${isLight ? 'Dark Mode' : 'Light Mode'}</span>`;
  }
  Chart.defaults.color = isLight ? '#475569' : '#8b93a8';
  Chart.defaults.borderColor = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
  if (window.lucide) lucide.createIcons();
  window.dispatchEvent(new Event('resize'));
};

// ── SIDEBAR TOGGLE ──
window.toggleSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('collapsed');
};

// ── VIEW SWITCHING ──
const VIEW_TITLES = {
  'view-import':      'Data Import',
  'view-report':      'Analysis Report',
  'view-overview':    'Overview Dashboard',
  'view-geo':         'Geographical Analysis',
  'view-investigation': 'Investigation Desk',
  'view-redflags':    'Risk Grades',
  'view-search':      'Search Database',
  'view-network':     'Director Networks',
};

window.switchView = function(viewId) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navItem = document.getElementById('nav-' + viewId);
  if (navItem) navItem.classList.add('active');

  document.querySelectorAll('.view-panel').forEach(el => el.classList.remove('active'));
  const viewPanel = document.getElementById(viewId);
  if (viewPanel) viewPanel.classList.add('active');

  const titleEl = document.getElementById('headerTitle');
  if (titleEl) titleEl.textContent = VIEW_TITLES[viewId] || 'Dashboard';

  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
    if (window.leafletMapInstance) window.leafletMapInstance.invalidateSize();
  }, 50);

  // Lazy-load per view
  if (viewId === 'view-report') loadNarrativeReport();
  if (viewId === 'view-import') refreshDumpFiles();
  if (viewId === 'view-redflags') loadReportCards(1);
  if (viewId === 'view-investigation') {
    loadAnomalies('round_number', 1);
    loadSingleBid(1000000, 1);
    loadRepeatWinners(3, 1);
  }
};

// ── INVESTIGATION DESK INNER TABS ──
window.switchInvTab = function(tabId) {
  document.querySelectorAll('.inv-tab-btn').forEach(el => el.classList.remove('active'));
  const btn = document.getElementById('btn-' + tabId);
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.inv-tab-content').forEach(el => el.classList.remove('active'));
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add('active');
};

// ── COUNTER ANIMATION ──
function animateCounter(elementId, targetValue, duration = 1200, formatter) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const start = performance.now();
  function step(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    const current  = Math.round(targetValue * eased);
    el.textContent = formatter ? formatter(current, progress) : fmtNum(current);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── LOAD KPIs ──
async function loadKPIs() {
  try {
    const res  = await fetch('/api/kpis');
    if (!res.ok) return;
    const data = await res.json();
    if (data.error) return;

    const total    = parseInt(data.total_aoc_tenders || 0);
    const valued   = parseInt(data.total_contracts_valued || 0);
    const value_cr = parseFloat(data.total_value_crore || 0);
    const orgs     = parseInt(data.unique_aoc_orgs || 0);
    const pub      = parseInt(data.total_published_tenders || 0);
    const minYr    = data.min_year || '';
    const maxYr    = data.max_year || '';

    animateCounter('kpiContracts', total);
    animateCounter('kpiOrgs', orgs);
    animateCounter('kpiPublished', pub);

    const valEl = document.getElementById('kpiValue');
    if (valEl) {
      animateCounter('kpiValue', Math.round(value_cr), 1200, (v, p) => {
        if (p < 1) return fmtNum(v);
        return fmtCrore(value_cr);
      });
    }

    const cvEl = document.getElementById('kpiContractsValued');
    if (cvEl) cvEl.textContent = `${fmtNum(valued)} with value data`;

    const yrEl = document.getElementById('kpiYearRange');
    if (yrEl && minYr && maxYr) yrEl.textContent = `${minYr} – ${maxYr}`;
  } catch (e) {
    console.warn('loadKPIs:', e);
  }
}

// ── ANOMALIES ──
let currentAnomalyType = 'round_number';

const ANOMALY_DESCS = {
  round_number:    "Contracts where the value is an exact multiple of ₹1 Lakh — often a signal of estimated rather than market-competitive pricing.",
  quick_award:     "Contracts awarded within 24 hours of the bidding deadline — physically implausible under fair procurement rules. Almost certainly pre-decided.",
  high_value_state: "Contracts from state government portals exceeding ₹10 Crore — significant expenditures requiring strong oversight.",
};

window.switchAnomalyType = function(type) {
  currentAnomalyType = type;
  document.querySelectorAll('#btn-inv-anomaly .btn-pill, #view-investigation .btn-pill').forEach(b => b.classList.remove('active'));
  const activeMap = { round_number: 'btnRound', quick_award: 'btnQuick', high_value_state: 'btnHvState' };
  const el = document.getElementById(activeMap[type]);
  if (el) el.classList.add('active');
  const desc = document.getElementById('anomalyDesc');
  if (desc) desc.textContent = ANOMALY_DESCS[type] || '';
  loadAnomalies(type, 1);
};

async function loadAnomalies(type, page) {
  const body = document.getElementById('anomalyBody');
  if (!body) return;
  body.innerHTML = '<tr><td colspan="6" class="table-empty">Loading…</td></tr>';
  try {
    const res  = await fetch(`/api/anomalies?type=${type}&page=${page}`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      body.innerHTML = '<tr><td colspan="6" class="table-empty">No anomalies of this type found.</td></tr>';
      return;
    }
    body.innerHTML = data.results.map(r => {
      const extraInfo = r.extra_info ? JSON.stringify(r.extra_info).replace(/[{}"]/g,'').replace(/,/g,' · ') : '';
      return `<tr>
        <td class="td-org">${r.org_name || '—'}</td>
        <td class="td-title" title="${r.title || ''}">${(r.title || '—').substring(0, 60)}${(r.title || '').length > 60 ? '…' : ''}</td>
        <td class="td-value">₹${fmtNum(r.contract_value)}</td>
        <td class="td-date">${r.aoc_date || '—'}</td>
        <td>${portalBadge(r.portal_type)}</td>
        <td style="font-size:11px;color:var(--text-muted);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${extraInfo}">${extraInfo}</td>
      </tr>`;
    }).join('');
    const totalPages = Math.ceil(data.total / data.per_page);
    buildPagination('anomalyPagination', page, totalPages, `window._loadAnom`);
    window._loadAnom = (p) => loadAnomalies(currentAnomalyType, p);
  } catch (e) {
    body.innerHTML = `<tr><td colspan="6" class="table-empty">Error: ${e.message}</td></tr>`;
  }
}

// ── SINGLE-BID CONTRACTS ──
let currentSingleBidMin = 1000000;

window.filterSingleBid = function(minVal) {
  currentSingleBidMin = minVal;
  loadSingleBid(minVal, 1);
};

async function loadSingleBid(minVal, page) {
  const body = document.getElementById('singleBidBody');
  if (!body) return;
  body.innerHTML = '<tr><td colspan="6" class="table-empty">Loading…</td></tr>';
  try {
    const res  = await fetch(`/api/single-bid-contracts?min_val=${minVal}&page=${page}`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      body.innerHTML = '<tr><td colspan="6" class="table-empty">No single-bid contracts found for this filter.</td></tr>';
      return;
    }
    body.innerHTML = data.results.map(r => `<tr>
      <td class="td-org">${r.org_name || '—'}</td>
      <td class="td-title" title="${r.title || ''}">${(r.title || '—').substring(0, 60)}${(r.title || '').length > 60 ? '…' : ''}</td>
      <td class="td-value">₹${fmtNum(r.contract_value)}</td>
      <td class="td-date">${r.aoc_date || '—'}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px" title="${r.bidder_name || ''}">
        <a href="#" onclick="openNetworkEntity('${(r.bidder_name || '').replace(/'/g, "\\'")}')" style="color:var(--accent);text-decoration:underline">${r.bidder_name || '—'}</a>
      </td>
      <td>${portalBadge(r.portal_type)}</td>
    </tr>`).join('');
    const totalPages = Math.ceil(data.total / data.per_page);
    buildPagination('singleBidPagination', page, totalPages, 'window._loadSB');
    window._loadSB = (p) => loadSingleBid(currentSingleBidMin, p);
  } catch (e) {
    body.innerHTML = `<tr><td colspan="6" class="table-empty">Error: ${e.message}</td></tr>`;
  }
}

// ── REPEAT WINNERS ──
let currentMinWins = 3;

window.filterRepeatWinners = function(minWins) {
  currentMinWins = minWins;
  loadRepeatWinners(minWins, 1);
};

async function loadRepeatWinners(minWins, page) {
  const body = document.getElementById('repeatWinnersBody');
  if (!body) return;
  body.innerHTML = '<tr><td colspan="6" class="table-empty">Loading…</td></tr>';
  try {
    const res  = await fetch(`/api/repeat-winners?min_wins=${minWins}&page=${page}`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      body.innerHTML = '<tr><td colspan="6" class="table-empty">No repeat winners found for this filter.</td></tr>';
      return;
    }
    body.innerHTML = data.results.map(r => `<tr>
      <td style="font-weight:600;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.bidder_name || ''}">
        <a href="#" onclick="openNetworkEntity('${(r.bidder_name || '').replace(/'/g, "\\'")}')" style="color:var(--accent);text-decoration:underline;font-weight:600">${r.bidder_name || '—'}</a>
      </td>
      <td class="td-org">${r.org_name || '—'}</td>
      <td style="font-weight:700;color:var(--accent);font-family:monospace">${r.wins}</td>
      <td class="td-value">₹${r.total_value_crore ? r.total_value_crore.toFixed(1) : '—'} Cr</td>
      <td class="td-date">${r.first_win || '—'}</td>
      <td class="td-date">${r.last_win || '—'}</td>
    </tr>`).join('');
    const totalPages = Math.ceil(data.total / data.per_page);
    buildPagination('repeatWinnersPagination', page, totalPages, 'window._loadRW');
    window._loadRW = (p) => loadRepeatWinners(currentMinWins, p);
  } catch (e) {
    body.innerHTML = `<tr><td colspan="6" class="table-empty">Error: ${e.message}</td></tr>`;
  }
}

// ── REPORT CARDS ──
let currentRCSort = 'score_asc';

window.switchReportCardSort = function(sort) {
  currentRCSort = sort;
  document.getElementById('btnGradeScore')?.classList.toggle('active', sort === 'score_asc');
  document.getElementById('btnGradeValue')?.classList.toggle('active', sort === 'value_desc');
  loadReportCards(1);
};

async function loadReportCards(page) {
  const container = document.getElementById('reportCardsContainer');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Loading…</div>';
  try {
    const res  = await fetch(`/api/report-cards?sort=${currentRCSort}&page=${page}&per_page=30`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No report card data available yet.</div>';
      return;
    }
    const maxContracts = Math.max(...data.results.map(r => r.total_contracts || 0), 1);
    container.innerHTML = data.results.map(r => {
      const barPct = Math.round((r.total_contracts / maxContracts) * 100);
      const gradeColor = { A: 'var(--low)', B: '#4ade80', C: 'var(--medium)', D: 'var(--high)', F: 'var(--critical)' };
      const col = gradeColor[r.grade] || 'var(--text-muted)';
      return `<div class="report-card-item">
        ${gradeBadge(r.grade)}
        <div class="rc-org" title="${r.org_name}">${r.org_name}</div>
        <div class="rc-bar-wrap"><div class="rc-bar" style="width:${barPct}%;background:${col}"></div></div>
        <div class="rc-stat">${r.total_contracts?.toLocaleString('en-IN') || '0'} contracts</div>
        <div class="rc-stat" style="min-width:90px">₹${(r.total_value_crore || 0).toFixed(0)} Cr</div>
        <div class="rc-stat" style="color:${r.single_bid_pct > 30 ? 'var(--critical)' : 'var(--text-muted)'};min-width:80px">
          ${r.single_bid_pct?.toFixed(1) || 0}% single-bid
        </div>
      </div>`;
    }).join('');
    const totalPages = Math.ceil(data.total / (data.per_page || 30));
    buildPagination('reportCardsPagination', page, totalPages, 'window._loadRC');
    window._loadRC = (p) => loadReportCards(p);
  } catch (e) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">Error loading data.</div>`;
  }
}

// ── MODAL (Tender Detail) ──
window.openTenderDetail = async function(id) {
  try {
    const res  = await fetch(`/api/tender/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    const modal = document.getElementById('tenderModal');
    const title = document.getElementById('modalTitle');
    const body  = document.getElementById('modalBody');
    if (!modal || !title || !body) return;

    title.textContent = data.title || 'Tender Detail';
    const details = data.details || {};
    let html = '';
    const fields = [
      ['Organisation', data.org_name],
      ['Portal', data.portal_type],
      ['Award Date', data.aoc_date],
      ['Closing Date', data.closing_date],
      ['Year', data.year],
      ['Contract Value', details['Contract Value']],
      ['Tender Type', details['Tender Type']],
      ['Tender Ref No.', details['Tender Ref. No.']],
      ['No. of Bids', details['Number of bids received']],
      ['Selected Bidder', details['Name of the selected bidder(s)']],
    ];
    for (const [label, val] of fields) {
      if (val) {
        let valueHtml = val;
        if (label === 'Selected Bidder') {
          valueHtml = `<a href="#" onclick="closeModal(); openNetworkEntity('${String(val).replace(/'/g, "\\'")}')" style="color:var(--accent);text-decoration:underline">${val}</a>`;
        }
        html += `<div class="modal-body-field">
          <div class="modal-field-label">${label}</div>
          <div class="modal-field-value">${valueHtml}</div>
        </div>`;
      }
    }
    body.innerHTML = html;

    document.getElementById('modalBackdrop').style.display = 'block';
    modal.style.display = 'block';
    if (window.lucide) lucide.createIcons();
  } catch (e) {
    console.warn('openTenderDetail:', e);
  }
};

window.closeModal = function() {
  document.getElementById('modalBackdrop').style.display = 'none';
  document.getElementById('tenderModal').style.display = 'none';
};

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  // Set chart defaults for dark theme
  Chart.defaults.color = '#8b93a8';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.04)';
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 11;

  // Init Lucide icons
  if (window.lucide) lucide.createIcons();

  // Check if data is available
  try {
    const status = await fetch('/api/status').then(r => r.json());
    if (status.summary_db_ready) {
      // We have data — load everything
      await Promise.all([
        loadKPIs(),
        initCharts(),
        loadAnomalies('round_number', 1),
        loadSingleBid(1000000, 1),
        loadRepeatWinners(3, 1),
        loadReportCards(1),
        loadNarrativeReport(),
        updateHeaderStatus(),
      ]);

      // Populate year filter
      try {
        const kpis = await fetch('/api/kpis').then(r => r.json());
        const minY = parseInt(kpis.min_year) || 2018;
        const maxY = parseInt(kpis.max_year) || new Date().getFullYear();
        const sel  = document.getElementById('filterYear');
        if (sel) {
          for (let y = maxY; y >= minY; y--) {
            const o = document.createElement('option');
            o.value = y; o.textContent = y;
            sel.appendChild(o);
          }
        }
        if (document.getElementById('searchIndexNote') && status.search_db_ready) {
          document.getElementById('searchIndexNote').style.display = 'inline';
        }
      } catch (e) {}

      // Switch to overview by default
      switchView('view-overview');
    } else {
      // No data yet — show import view
      switchView('view-import');
      updateHeaderStatus();
    }
  } catch (e) {
    switchView('view-import');
  }

  // Hide loader
  const overlay = document.getElementById('loadingOverlay');
  const content = document.getElementById('mainContent');
  if (overlay) overlay.style.display = 'none';
  if (content) content.style.display = 'block';

  // Init analysis module
  await initAnalysis();

  // Re-render icons (some may have been added dynamically)
  if (window.lucide) lucide.createIcons();
});
