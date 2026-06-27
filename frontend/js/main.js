/* ═══════════════════════════════════════════
   main.js — Dashboard initialization & data orchestration
   ═══════════════════════════════════════════ */

// Chart instances (kept for destroy/re-create on toggle)
const chartInstances = {};

// ── THEME TOGGLE ──
window.toggleTheme = function() {
  document.body.classList.toggle('light-mode');
  const isLight = document.body.classList.contains('light-mode');
  document.getElementById('themeToggleText').innerText = isLight ? 'Dark Mode' : 'Light Mode';
  document.getElementById('themeToggleBtn').innerHTML = `<i data-lucide="${isLight ? 'moon' : 'sun'}"></i> <span id="themeToggleText">${isLight ? 'Dark Mode' : 'Light Mode'}</span>`;
  
  if (isLight) {
    Chart.defaults.color = '#475569';
    Chart.defaults.borderColor = 'rgba(0,0,0,0.05)';
  } else {
    document.getElementById('themeToggleText').innerText = 'Light Mode';
    document.getElementById('themeToggleBtn').innerHTML = '<i data-lucide="sun"></i> <span id="themeToggleText">Light Mode</span>';
    // Revert chart global fonts/colors
    Chart.defaults.color = '#8b93a8';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.04)';
  }
  if (window.lucide) lucide.createIcons();
  
  // Re-render charts so grid lines update
  window.dispatchEvent(new Event('resize'));
};

// ── SIDEBAR TOGGLE ──
window.toggleSidebar = function() {
  document.getElementById('appLayout').classList.toggle('collapsed');
};

// ── VIEW SWITCHING ──
window.switchView = function(viewId) {
  // Update sidebar active state
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navItem = document.getElementById('nav-' + viewId);
  if (navItem) navItem.classList.add('active');

  // Update visible panel
  document.querySelectorAll('.view-panel').forEach(el => el.classList.remove('active'));
  const viewPanel = document.getElementById(viewId);
  if (viewPanel) viewPanel.classList.add('active');

  // Trigger resize to fix chart.js canvas sizes when unhidden
  setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
};

// ── INVESTIGATION DESK INNER TABS ──
window.switchInvTab = function(tabId) {
  document.querySelectorAll('.inv-tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('btn-' + tabId).classList.add('active');

  document.querySelectorAll('.inv-tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
};

// ── COUNTER ANIMATION ──
function animateCounter(elementId, targetValue, duration = 1200, formatter) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const start = performance.now();
  const startVal = 0;

  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = Math.round(startVal + (targetValue - startVal) * eased);
    el.textContent = formatter ? formatter(current, progress) : fmtNum(current);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── LOAD KPIs ──
async function loadKpis() {
  try {
    const data = await fetch('/api/kpis').then(r => r.json());

    if (data.error) {
      document.getElementById('headerLastUpdated').textContent = '⚠️ ' + data.error;
      document.getElementById('statusDot').style.background = '#f87171';
      return;
    }

    const totalContracts = parseInt(data.total_aoc_tenders || 0);
    const totalValued    = parseInt(data.total_contracts_valued || 0);
    const totalValue     = parseFloat(data.total_value_crore || 0);
    const avgValue       = parseFloat(data.avg_value_crore || 0);
    const uniqueOrgs     = parseInt(data.unique_aoc_orgs || 0);
    const totalPub       = parseInt(data.total_published_tenders || 0);
    const minYear        = data.min_year || '';
    const maxYear        = data.max_year || '';
    const lastUpdated    = data.last_updated || '';

    // Animate KPI counters
    animateCounter('kpiContracts', totalContracts, 1400);
    animateCounter('kpiValue', totalValue, 1500, (v, p) => {
      if (p >= 1) return fmtCrore(totalValue);
      return `₹${fmtNum(Math.round(v))} Cr`;
    });
    animateCounter('kpiOrgs', uniqueOrgs, 1200);
    animateCounter('kpiPublished', totalPub, 1300);

    document.getElementById('kpiContractsValued').textContent =
      `${fmtNum(totalValued)} with value data`;
    document.getElementById('kpiYearRange').textContent =
      minYear && maxYear ? `${minYear} – ${maxYear}` : '';

    // Header
    if (lastUpdated) {
      document.getElementById('headerLastUpdated').textContent =
        'Updated ' + lastUpdated.split(' ')[0];
    }

    // Year filter options
    const yearSelect = document.getElementById('filterYear');
    const minY = parseInt(minYear) || 2015;
    const maxY = parseInt(maxYear) || new Date().getFullYear();
    for (let y = maxY; y >= minY; y--) {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      yearSelect.appendChild(opt);
    }

  } catch(e) {
    console.error('KPI load error:', e);
    document.getElementById('statusDot').style.background = '#f87171';
  }
}

// ── TREND CHART ──
let currentTrend = 'yearly';

async function loadTrendChart(grain = 'yearly', dataset = 'aoc') {
  const params = new URLSearchParams({ grain, dataset });
  const data = await fetch(`/api/trends?${params}`).then(r => r.json());

  if (chartInstances.trend) {
    chartInstances.trend.destroy();
    delete chartInstances.trend;
  }

  chartInstances.trend = createTrendChart('trendChart', data.labels, data.counts, data.values);
}

function switchTrend(type) {
  currentTrend = type;
  document.querySelectorAll('#btnYearly,#btnMonthly,#btnPublished').forEach(b => b.classList.remove('active'));

  if (type === 'yearly') {
    document.getElementById('btnYearly').classList.add('active');
    loadTrendChart('yearly', 'aoc');
  } else if (type === 'monthly') {
    document.getElementById('btnMonthly').classList.add('active');
    loadTrendChart('monthly', 'aoc');
  } else {
    document.getElementById('btnPublished').classList.add('active');
    loadTrendChart('yearly', 'published');
  }
}

// ── TOP ORGS CHART ──
let currentOrgMetric = 'count';

async function loadOrgsChart(by = 'count') {
  currentOrgMetric = by;
  const data = await fetch(`/api/top-orgs?by=${by}&limit=15`).then(r => r.json());

  if (chartInstances.orgs) {
    chartInstances.orgs.destroy();
    delete chartInstances.orgs;
  }

  chartInstances.orgs = createOrgsChart('orgsChart', data.labels, data.values, data.metric);
}

function switchOrgs(by) {
  document.getElementById('orgByCount').classList.toggle('active', by === 'count');
  document.getElementById('orgByValue').classList.toggle('active', by === 'value');
  loadOrgsChart(by);
}

// ── TENDER TYPE CHART ──
async function loadTenderTypeChart() {
  const data = await fetch('/api/tender-types').then(r => r.json());

  // Limit to top 8 types + "Other"
  const MAX = 8;
  let labels = data.labels.slice(0, MAX);
  let counts = data.counts.slice(0, MAX);

  if (data.labels.length > MAX) {
    const otherCount = data.counts.slice(MAX).reduce((a, b) => a + b, 0);
    labels.push('Other');
    counts.push(otherCount);
  }

  if (chartInstances.type) {
    chartInstances.type.destroy();
    delete chartInstances.type;
  }
  chartInstances.type = createDonutChart('typeChart', labels, counts);
}

// ── VALUE BRACKET CHART ──
async function loadValueBracketChart() {
  const data = await fetch('/api/value-distribution').then(r => r.json());

  if (chartInstances.brackets) {
    chartInstances.brackets.destroy();
    delete chartInstances.brackets;
  }
  chartInstances.brackets = createBarChart('valueBracketChart', data.labels, data.counts, COLORS.amber);
}

// ── PORTAL BREAKDOWN CHART ──
async function loadPortalChart() {
  const data = await fetch('/api/portal-breakdown').then(r => r.json());

  if (chartInstances.portal) {
    chartInstances.portal.destroy();
    delete chartInstances.portal;
  }
  chartInstances.portal = createPieChart('portalChart', data.labels, data.counts);
}

// ── PUBLISHED ORGS CHART ──
async function loadPubOrgsChart() {
  const data = await fetch('/api/top-orgs?dataset=published&limit=12').then(r => r.json());

  if (chartInstances.pubOrgs) {
    chartInstances.pubOrgs.destroy();
    delete chartInstances.pubOrgs;
  }
  chartInstances.pubOrgs = createOrgsChart('pubOrgsChart', data.labels, data.values, 'tenders published');
}

// ── INDIA MAP ──
let currentMapMode = 'count';
async function loadStateMap() {
  const data = await fetch('/api/state-stats').then(r => r.json());
  
  if (chartInstances.indiaMap) {
    chartInstances.indiaMap.destroy();
    delete chartInstances.indiaMap;
  }
  
  const chart = await createIndiaMap('indiaMapChart', data, currentMapMode);
  if (chart) {
    chartInstances.indiaMap = chart;
  } else {
    document.getElementById('indiaMapChart').parentElement.innerHTML += `<div style="text-align:center;padding:40px;color:var(--text-muted)">Map data could not be loaded. Are you offline?</div>`;
  }
}

window.switchMap = function(mode) {
  currentMapMode = mode;
  document.getElementById('btnMapCount').classList.toggle('active', mode === 'count');
  document.getElementById('btnMapValue').classList.toggle('active', mode === 'value');
  loadStateMap();
};

// ── DEPARTMENT REPORT CARDS ──
let currentReportCardSort = 'score_asc';
async function loadReportCards() {
  const data = await fetch(`/api/report-cards?sort=${currentReportCardSort}`).then(r => r.json());
  const container = document.getElementById('reportCardsContainer');
  
  if (!data.results || data.results.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">No graded departments yet.</div>`;
    return;
  }
  
  container.innerHTML = data.results.map(org => {
    return `
      <div class="report-card">
        <div class="report-card-info">
          <div class="report-card-org" title="${esc(org.org_name)}">${esc(org.org_name)}</div>
          <div class="report-card-stats">
            <span><strong>${fmtNum(org.total_contracts)}</strong> contracts</span>
            <span><strong>₹${fmtNum(Math.round(org.total_value_crore))}</strong> Cr</span>
            <span style="color:var(--amber)"><strong>${org.single_bid_pct}%</strong> single-bid</span>
          </div>
        </div>
        <div class="grade-badge grade-${org.grade}">
          ${org.grade}
        </div>
      </div>
    `;
  }).join('');
}

window.switchReportCardSort = function(sort) {
  currentReportCardSort = sort;
  document.getElementById('btnGradeScore').classList.toggle('active', sort === 'score_asc');
  document.getElementById('btnGradeValue').classList.toggle('active', sort === 'value_desc');
  document.getElementById('reportCardsContainer').innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">Loading...</div>`;
  loadReportCards();
};

// ── SHOW MAIN / HIDE LOADER ──
function showDashboard() {
  document.getElementById('loadingOverlay').style.opacity = '0';
  setTimeout(() => {
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('mainContent').style.display   = 'block';
    // Stagger animate sections
    document.querySelectorAll('.kpi-card, .chart-card, .anomaly-section, .search-section').forEach((el, i) => {
      el.style.animationDelay = `${i * 40}ms`;
      el.classList.add('anim-in');
    });
  }, 400);
}

// ── PARALLEL DATA LOAD ──
async function initDashboard() {
  try {
    // Check status first
    const status = await fetch('/api/status').then(r => r.json());

    if (!status.summary_db_ready) {
      document.getElementById('loadingOverlay').innerHTML = `
        <div class="loader-box" style="max-width:400px;text-align:center">
          <div style="font-size:48px;margin-bottom:16px">⏳</div>
          <h2 style="color:var(--text-primary);margin-bottom:12px">Building Summary Database…</h2>
          <p style="color:var(--text-secondary);line-height:1.6">
            Run <code style="color:var(--blue)">python build_summary.py</code> in your terminal.<br>
            This takes 10–25 minutes on first run. Refresh when complete.
          </p>
        </div>
      `;
      return;
    }

    // Show FTS search indicator
    if (status.search_db_ready) {
      const note = document.getElementById('searchIndexNote');
      if (note) note.style.display = 'inline-flex';
    }

    // Load all data in parallel
    await Promise.all([
      loadKpis(),
      loadTrendChart('yearly', 'aoc'),
      loadOrgsChart('count'),
      loadTenderTypeChart(),
      loadValueBracketChart(),
      loadPortalChart(),
      loadPubOrgsChart(),
    ]);

    // Load anomalies and new panels
    loadAnomalies('round_number', 1);
    loadSingleBid(1);
    loadRepeatWinners(1);
    loadStateMap();
    loadReportCards();

    // Lucide icons
    if (window.lucide) lucide.createIcons();

    showDashboard();

  } catch(e) {
    console.error('Dashboard init error:', e);
    document.getElementById('loadingOverlay').innerHTML = `
      <div class="loader-box">
        <div style="font-size:48px;margin-bottom:16px">⚠️</div>
        <h2 style="color:var(--red);margin-bottom:8px">Could not connect to API</h2>
        <p style="color:var(--text-secondary)">Make sure <code style="color:var(--blue)">python app.py</code> is running on port 5000.</p>
      </div>
    `;
  }
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', initDashboard);
