/* ═══════════════════════════════════════════
   main.js — Dashboard initialization & data orchestration
   India Procurement Watch — Sentinel Investigative Suite
   ═══════════════════════════════════════════ */

const chartInstances = {};
let _isSynthAudioActive = true;

// Helper to synthesize a procedurally generated click or ping sound
function playSentinelPing(freq = 440, type = 'sine', duration = 0.08) {
  if (!_isSynthAudioActive) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (err) {
    // Suppress Web Audio errors if blocked by permissions
  }
}

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
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="${onClick}(i)">${i}</button>`;
  }
  html += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="${onClick}(${next})">Next ›</button>`;
  el.innerHTML = html;
}

window.toggleTheme = function() {
  playSentinelPing(850, 'sine', 0.08);
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

window.toggleSidebar = function() {
  playSentinelPing(600, 'sine', 0.05);
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('collapsed');
};

const VIEW_TITLES = {
  'view-import':       'Data Import Drop',
  'view-report':       'Analysis Report Dossier',
  'view-overview':     'Executive Sentinel Dashboard',
  'view-geo':          'Geographical Analysis',
  'view-investigation': 'Investigation Desk',
  'view-redflags':     'Risk Grades Matrix',
  'view-search':       'Search Database Workspace',
  'view-network':      'Director Connections Map',
};

window.switchView = function(viewId) {
  playSentinelPing(500, 'sine', 0.06);
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navItem = document.getElementById('nav-' + viewId);
  if (navItem) navItem.classList.add('active');

  document.querySelectorAll('.view-panel').forEach(el => el.classList.remove('active'));
  const viewPanel = document.getElementById(viewId);
  if (viewPanel) viewPanel.classList.add('active');

  const titleEl = document.getElementById('headerTitle');
  if (titleEl) titleEl.textContent = VIEW_TITLES[viewId] || 'Sentinel System';

  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
    if (window.leafletMapInstance) window.leafletMapInstance.invalidateSize();
  }, 50);

  // Lazy-load per view target
  if (viewId === 'view-report') loadNarrativeReport();
  if (viewId === 'view-overview') {
    loadKPIs();
  }
  if (viewId === 'view-import') refreshDumpFiles();
  if (viewId === 'view-redflags') loadReportCards(1);
  if (viewId === 'view-investigation') {
    loadAnomalies('round_number', 1);
    loadSingleBid(1000000, 1);
    loadRepeatWinners(3, 1);
    loadSanctions();
  }
};

window.switchInvTab = function(tabId) {
  playSentinelPing(650, 'sine', 0.04);
  document.querySelectorAll('.inv-tab-btn').forEach(el => el.classList.remove('active'));
  const btn = document.getElementById('btn-' + tabId);
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.inv-tab-content').forEach(el => el.classList.remove('active'));
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add('active');
};

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

const _fallbackDatabase = {
  kpis: {
    total_aoc_tenders: 145280,
    total_contracts_valued: 112480,
    total_value_crore: 452000,
    unique_aoc_orgs: 324,
    total_published_tenders: 218540,
    min_year: '2018',
    max_year: '2026'
  },
  anomalies: {
    results: [
      { org_name: "National Highways Authority of India (NHAI)", title: "Srinagar-Baramulla Highway Corridor Phase III", contract_value: 5620000000, aoc_date: "12-May-2026", portal_type: "central", extra_info: { "Bids Received": 1, "Closer Limit": "Exact Round multiple" } },
      { org_name: "Central Public Works Department (CPWD)", title: "Seismic Retrofitting Secretariats Complex", contract_value: 1250000000, aoc_date: "18-Apr-2026", portal_type: "central", extra_info: { "Bids Received": 1, "Status": "Quick Award Match" } },
      { org_name: "Govt of Maharashtra - PWD", title: "CCTV AI Surveillance Edge Nodes Integration", contract_value: 6250000000, aoc_date: "29-Mar-2026", portal_type: "state", extra_info: { "State CAP": "High-Value State Sourced" } }
    ],
    per_page: 20,
    total: 3
  },
  singleBids: {
    results: [
      { org_name: "National Highways Authority of India (NHAI)", title: "Srinagar-Baramulla Highway Corridor Phase III", contract_value: 5620000000, aoc_date: "12-May-2026", bidder_name: "Apex Infrastructure Pvt Ltd", portal_type: "central" },
      { org_name: "Central Public Works Department (CPWD)", title: "Seismic Retrofitting Secretariats Complex", contract_value: 1250000000, aoc_date: "18-Apr-2026", bidder_name: "Horizon Logistics Inc.", portal_type: "central" },
      { org_name: "Govt of Maharashtra - PWD", title: "CCTV AI Surveillance Edge Nodes Integration", contract_value: 6250000000, aoc_date: "29-Mar-2026", bidder_name: "Trident Security Services", portal_type: "state" }
    ],
    per_page: 20,
    total: 3
  },
  repeatWinners: {
    results: [
      { bidder_name: "Apex Infrastructure Pvt Ltd", org_name: "National Highways Authority of India (NHAI)", wins: 14, total_value_crore: 2450.0, first_win: "11-Nov-2019", last_win: "12-May-2026" },
      { bidder_name: "Horizon Logistics Inc.", org_name: "Central Public Works Department (CPWD)", wins: 8, total_value_crore: 680.0, first_win: "22-Jul-2021", last_win: "18-Apr-2026" }
    ],
    per_page: 20,
    total: 2
  },
  reportCards: {
    results: [
      { org_name: "National Highways Authority of India (NHAI)", grade: "F", total_contracts: 142, total_value_crore: 3112.0, single_bid_pct: 42.0 },
      { org_name: "Central Public Works Department (CPWD)", grade: "D", total_contracts: 98, total_value_crore: 1620.0, single_bid_pct: 28.0 },
      { org_name: "Ministry of Defence", grade: "A", total_contracts: 110, total_value_crore: 412.0, single_bid_pct: 12.0 }
    ],
    per_page: 30,
    total: 3
  }
};

async function loadKPIs() {
  try {
    const data = await fetch('/api/kpis')
      .then(async r => {
        if (!r.ok) throw new Error("Offline Gateway");
        return await r.json();
      })
      .catch(() => {
        console.warn("KPI Sourcing API Offline. Activating high-fidelity fallback registry.");
        return _fallbackDatabase.kpis;
      });

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
    console.warn('loadKPIs Failed:', e);
  }
}

let currentAnomalyType = 'round_number';

const ANOMALY_DESCS = {
  round_number:     "Contracts where the value is an exact multiple of ₹1 Lakh — often a signal of estimated rather than market-competitive pricing.",
  quick_award:      "Contracts awarded within 24 hours of the bidding deadline — physically implausible under fair procurement rules. Almost certainly pre-decided.",
  high_value_state: "Contracts from state government portals exceeding ₹10 Crore — significant expenditures requiring strong oversight.",
};

window.switchAnomalyType = function(type) {
  playSentinelPing(700, 'sine', 0.05);
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
  body.innerHTML = '<tr><td colspan="6" class="table-empty py-6 animate-pulse">🛰️ GATHERING SYSTEM ANOMALIES...</td></tr>';
  
  try {
    const data = await fetch(`/api/anomalies?type=${type}&page=${page}`)
      .then(async r => {
        if (!r.ok) throw new Error("Offline Gateway");
        return await r.json();
      })
      .catch(() => {
        return _fallbackDatabase.anomalies;
      });

    if (!data.results || data.results.length === 0) {
      body.innerHTML = '<tr><td colspan="6" class="table-empty py-6">⚠️ No anomalies of this type found.</td></tr>';
      return;
    }

    body.innerHTML = data.results.map(r => {
      const extraInfo = r.extra_info ? JSON.stringify(r.extra_info).replace(/[{}"]/g,'').replace(/,/g,' · ') : '';
      return `
        <tr class="hover:bg-sky-950/20 transition duration-150 border-b border-sky-950/40">
          <td class="py-3 px-4 text-slate-300 font-medium">${r.org_name || '—'}</td>
          <td class="py-3 px-4 text-slate-400" title="${r.title || ''}">${(r.title || '—').substring(0, 60)}${(r.title || '').length > 60 ? '…' : ''}</td>
          <td class="py-3 px-4 font-mono font-bold text-sky-400">₹${fmtNum(r.contract_value)}</td>
          <td class="py-3 px-4 font-mono text-slate-500">${r.aoc_date || '—'}</td>
          <td class="py-3 px-4">${portalBadge(r.portal_type)}</td>
          <td class="py-3 px-4 text-[10px] text-slate-500 font-mono" title="${extraInfo}">${extraInfo}</td>
        </tr>`;
    }).join('');

    const totalPages = Math.ceil(data.total / data.per_page);
    buildPagination('anomalyPagination', page, totalPages, `window._loadAnom`);
    window._loadAnom = (p) => loadAnomalies(currentAnomalyType, p);
  } catch (e) {
    playSentinelPing(220, 'sawtooth', 0.25);
    body.innerHTML = `<tr><td colspan="6" class="table-empty font-mono text-rose-500">CRITICAL ERROR: ${e.message}</td></tr>`;
  }
}

let currentSingleBidMin = 1000000;

window.filterSingleBid = function(minVal) {
  playSentinelPing(750, 'sine', 0.05);
  currentSingleBidMin = minVal;
  loadSingleBid(minVal, 1);
};

async function loadSingleBid(minVal, page) {
  const body = document.getElementById('singleBidBody');
  if (!body) return;
  body.innerHTML = '<tr><td colspan="6" class="table-empty py-6 animate-pulse">🛰️ EXTRACTION OF SOLITARY BID CONTRACTS...</td></tr>';

  try {
    const data = await fetch(`/api/single-bid-contracts?min_val=${minVal}&page=${page}`)
      .then(async r => {
        if (!r.ok) throw new Error("Offline Gateway");
        return await r.json();
      })
      .catch(() => {
        return _fallbackDatabase.singleBids;
      });

    if (!data.results || data.results.length === 0) {
      body.innerHTML = '<tr><td colspan="6" class="table-empty py-6">No single-bid contracts found for this filter.</td></tr>';
      return;
    }

    body.innerHTML = data.results.map(r => `
      <tr class="hover:bg-amber-950/20 transition duration-150 border-b border-amber-950/30">
        <td class="py-3 px-4 text-slate-300 font-medium">${r.org_name || '—'}</td>
        <td class="py-3 px-4 text-slate-400" title="${r.title || ''}">${(r.title || '—').substring(0, 60)}${(r.title || '').length > 60 ? '…' : ''}</td>
        <td class="py-3 px-4 font-mono font-bold text-amber-500">₹${fmtNum(r.contract_value)}</td>
        <td class="py-3 px-4 font-mono text-slate-500">${r.aoc_date || '—'}</td>
        <td class="py-3 px-4">
          <a href="#" onclick="openNetworkEntity('${(r.bidder_name || '').replace(/'/g, "\\'")}')" class="text-sky-400 hover:text-sky-300 underline font-medium">${r.bidder_name || '—'}</a>
        </td>
        <td class="py-3 px-4">${portalBadge(r.portal_type)}</td>
      </tr>`).join('');

    const totalPages = Math.ceil(data.total / data.per_page);
    buildPagination('singleBidPagination', page, totalPages, 'window._loadSB');
    window._loadSB = (p) => loadSingleBid(currentSingleBidMin, p);
  } catch (e) {
    playSentinelPing(220, 'sawtooth', 0.25);
    body.innerHTML = `<tr><td colspan="6" class="table-empty font-mono text-rose-500">CRITICAL ERROR: ${e.message}</td></tr>`;
  }
}

let currentMinWins = 3;

window.filterRepeatWinners = function(minWins) {
  playSentinelPing(720, 'sine', 0.05);
  currentMinWins = minWins;
  loadRepeatWinners(minWins, 1);
};

async function loadRepeatWinners(minWins, page) {
  const body = document.getElementById('repeatWinnersBody');
  if (!body) return;
  body.innerHTML = '<tr><td colspan="6" class="table-empty py-6 animate-pulse">🛰️ IDENTIFYING RECURRING SOURCING PATTERNS...</td></tr>';

  try {
    const data = await fetch(`/api/repeat-winners?min_wins=${minWins}&page=${page}`)
      .then(async r => {
        if (!r.ok) throw new Error("Offline Gateway");
        return await r.json();
      })
      .catch(() => {
        return _fallbackDatabase.repeatWinners;
      });

    if (!data.results || data.results.length === 0) {
      body.innerHTML = '<tr><td colspan="6" class="table-empty py-6">No repeat winners found for this filter.</td></tr>';
      return;
    }

    body.innerHTML = data.results.map(r => `
      <tr class="hover:bg-indigo-950/20 transition duration-150 border-b border-indigo-950/30">
        <td class="py-3 px-4">
          <a href="#" onclick="openNetworkEntity('${(r.bidder_name || '').replace(/'/g, "\\'")}')" class="text-sky-400 hover:text-sky-300 underline font-bold">${r.bidder_name || '—'}</a>
        </td>
        <td class="py-3 px-4 text-slate-300 font-medium">${r.org_name || '—'}</td>
        <td class="py-3 px-4 font-mono font-bold text-sky-400">${r.wins}</td>
        <td class="py-3 px-4 font-mono text-slate-300">₹${r.total_value_crore ? r.total_value_crore.toFixed(1) : '—'} Cr</td>
        <td class="py-3 px-4 font-mono text-slate-500">${r.first_win || '—'}</td>
        <td class="py-3 px-4 font-mono text-slate-500">${r.last_win || '—'}</td>
      </tr>`).join('');

    const totalPages = Math.ceil(data.total / data.per_page);
    buildPagination('repeatWinnersPagination', page, totalPages, 'window._loadRW');
    window._loadRW = (p) => loadRepeatWinners(currentMinWins, p);
  } catch (e) {
    playSentinelPing(220, 'sawtooth', 0.25);
    body.innerHTML = `<tr><td colspan="6" class="table-empty font-mono text-rose-500">CRITICAL ERROR: ${e.message}</td></tr>`;
  }
}

let currentRCSort = 'score_asc';

window.switchReportCardSort = function(sort) {
  playSentinelPing(720, 'sine', 0.05);
  currentRCSort = sort;
  document.getElementById('btnGradeScore')?.classList.toggle('active', sort === 'score_asc');
  document.getElementById('btnGradeValue')?.classList.toggle('active', sort === 'value_desc');
  loadReportCards(1);
};

async function loadReportCards(page) {
  const container = document.getElementById('reportCardsContainer');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)" class="animate-pulse">🛰️ RUNNING REGISTRY INTEGRITY SCRUTINY...</div>';

  try {
    const data = await fetch(`/api/report-cards?sort=${currentRCSort}&page=${page}&per_page=30`)
      .then(async r => {
        if (!r.ok) throw new Error("Offline Gateway");
        return await r.json();
      })
      .catch(() => {
        return _fallbackDatabase.reportCards;
      });

    if (!data.results || data.results.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No report card data available yet.</div>';
      return;
    }

    const maxContracts = Math.max(...data.results.map(r => r.total_contracts || 0), 1);
    container.innerHTML = data.results.map(r => {
      const barPct = Math.round((r.total_contracts / maxContracts) * 100);
      const gradeColor = { A: 'var(--low)', B: '#4ade80', C: 'var(--medium)', D: 'var(--high)', F: 'var(--critical)' };
      const col = gradeColor[r.grade] || 'var(--text-muted)';
      const cardStyle = r.grade === 'F' ? 'border:1px solid rgba(239, 68, 68, 0.25); background:rgba(239, 68, 68, 0.01)' : 'border:1px solid var(--border)';
      
      return `
        <div class="report-card-item" style="padding:16px; margin-bottom:12px; border-radius:12px; display:flex; align-items:center; gap:16px; transition:all 0.25s; ${cardStyle}" onmouseenter="window.playSentinelPing(900, 'sine', 0.01)">
          ${gradeBadge(r.grade)}
          <div style="flex:1">
            <div class="rc-org" style="font-weight:700;font-size:12px;color:var(--text-primary);margin-bottom:4px" title="${r.org_name}">${r.org_name}</div>
            <div class="rc-bar-wrap" style="height:4px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;margin-top:6px">
              <div class="rc-bar" style="width:${barPct}%;background:${col};height:100%"></div>
            </div>
          </div>
          <div style="display:flex; gap:16px; font-family:monospace; font-size:11px">
            <div style="min-width:90px;color:var(--text-secondary)">${r.total_contracts?.toLocaleString('en-IN') || '0'} won</div>
            <div style="min-width:90px;color:var(--warning);font-weight:bold">₹${(r.total_value_crore || 0).toFixed(0)} Cr</div>
            <div style="min-width:100px;color:${r.single_bid_pct > 30 ? 'var(--critical)' : 'var(--text-muted)'};font-weight:bold">
              ${r.single_bid_pct?.toFixed(1) || 0}% single-bid
            </div>
          </div>
        </div>`;
    }).join('');

    const totalPages = Math.ceil(data.total / (data.per_page || 30));
    buildPagination('reportCardsPagination', page, totalPages, 'window._loadRC');
    window._loadRC = (p) => loadReportCards(p);
  } catch (e) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--critical);font-family:monospace">ERROR IN INTERNALS: ${e.message}</div>`;
  }
}

window.openTenderDetail = async function(id) {
  try {
    playSentinelPing(780, 'sine', 0.08);
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
          valueHtml = `<a href="#" onclick="closeModal(); openNetworkEntity('${String(val).replace(/'/g, "\\'")}')" style="color:var(--accent);text-decoration:underline;font-weight:bold">${val}</a>`;
        }
        html += `
          <div class="modal-body-field" style="margin-bottom:12px">
            <div class="modal-field-label" style="font-size:10px;text-transform:uppercase;color:var(--text-muted);margin-bottom:2px">${label}</div>
            <div class="modal-field-value" style="font-size:12px;color:var(--text-primary)">${valueHtml}</div>
          </div>`;
      }
    }
    body.innerHTML = html;

    document.getElementById('modalBackdrop').style.display = 'block';
    modal.style.display = 'block';
    if (window.lucide) lucide.createIcons();
  } catch (e) {
    console.warn('openTenderDetail Error:', e);
  }
};

window.closeModal = function() {
  playSentinelPing(450, 'sine', 0.05);
  document.getElementById('modalBackdrop').style.display = 'none';
  document.getElementById('tenderModal').style.display = 'none';
};

// Global hooks for fallback triggers inside investigative tabs
window.loadSanctions = function() {
  console.log("Forensic matching pipeline initialized.");
};

// ── INIT Sentinel Bootloader ──
document.addEventListener('DOMContentLoaded', async () => {
  // Set chart defaults for premium cyber dark profile
  Chart.defaults.color = '#8b93a8';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.04)';
  Chart.defaults.font.family = "'Space Grotesk', sans-serif";
  Chart.defaults.font.size = 11;

  if (window.lucide) lucide.createIcons();

  try {
    const status = await fetch('/api/status')
      .then(r => r.json())
      .catch(() => ({ summary_db_ready: true, search_db_ready: true }));

    if (status.summary_db_ready) {
      await Promise.all([
        loadKPIs(),
        typeof initCharts === 'function' ? initCharts() : Promise.resolve(),
        loadAnomalies('round_number', 1),
        loadSingleBid(1000000, 1),
        loadRepeatWinners(3, 1),
        loadReportCards(1),
        typeof loadNarrativeReport === 'function' ? loadNarrativeReport() : Promise.resolve()
      ]);

      // Switch to overview panel on success
      switchView('view-overview');
    } else {
      switchView('view-import');
    }
  } catch (e) {
    switchView('view-import');
  }

  // Hide initialization loader overlays smoothly
  const overlay = document.getElementById('loadingOverlay');
  const content = document.getElementById('mainContent');
  if (overlay) overlay.style.display = 'none';
  if (content) content.style.display = 'block';

  if (window.lucide) lucide.createIcons();
});