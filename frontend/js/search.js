/* ═══════════════════════════════════════════
   search.js — Search & anomaly table rendering
   ═══════════════════════════════════════════ */

let currentSearchPage = 1;
let currentSearchTotal = 0;
let searchDebounceTimer = null;

// ── SEARCH ──
function doSearch(page = 1) {
  const q      = document.getElementById('searchInput').value.trim();
  const year   = document.getElementById('filterYear').value;
  const portal = document.getElementById('filterPortal').value;

  if (!q && !year && !portal) {
    document.getElementById('searchResults').style.display = 'none';
    return;
  }

  currentSearchPage = page;

  // Show loading state
  const btn = document.querySelector('.btn-search');
  const input = document.getElementById('searchInput');
  if (btn) { btn.textContent = '...'; btn.disabled = true; }
  input.style.opacity = '0.6';

  const params = new URLSearchParams({ page });
  if (q)      params.set('q', q);
  if (year)   params.set('year', year);
  if (portal) params.set('portal', portal);

  fetch(`/api/search?${params}`)
    .then(r => r.json())
    .then(data => {
      currentSearchTotal = data.total;
      renderSearchResults(data);
    })
    .catch(err => console.error('Search error:', err))
    .finally(() => {
      if (btn) { btn.textContent = 'Search'; btn.disabled = false; }
      input.style.opacity = '';
    });
}

function renderSearchResults(data) {
  const wrap  = document.getElementById('searchResults');
  const meta  = document.getElementById('resultsMeta');
  const tbody = document.getElementById('resultsBody');
  const pagination = document.getElementById('searchPagination');

  wrap.style.display = 'block';

  const start   = (data.page - 1) * data.per_page + 1;
  const end     = start + (data.results ? data.results.length : 0) - 1;
  const hasMore = data.has_more;

  if (hasMore) {
    meta.textContent = `Showing ${fmtNum(start)}–${fmtNum(end)} of many results`;
  } else {
    meta.textContent = `Showing ${fmtNum(start)}–${fmtNum(end)} of ${fmtNum(data.total)} results`;
  }

  if (!data.results || data.results.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No results found.</td></tr>`;
    pagination.innerHTML = '';
    return;
  }

  tbody.innerHTML = data.results.map(row => `
    <tr>
      <td class="org-cell" title="${esc(row.org_name)}">${esc(truncate(row.org_name, 35))}</td>
      <td class="title-cell" title="${esc(row.title)}">${esc(truncate(row.title, 50))}</td>
      <td style="font-family:var(--font-mono); font-size:12px">${row.year || '—'}</td>
      <td><span class="portal-badge portal-${row.portal_type}">${row.portal_type || '—'}</span></td>
      <td style="font-size:12px; white-space:nowrap">${formatDateStr(row.aoc_date)}</td>
      <td>
        <button class="detail-btn" onclick="loadTenderDetail('${esc(row.internal_id)}', ${JSON.stringify(esc(row.title))})">
          View
        </button>
      </td>
    </tr>
  `).join('');

  // Pagination — use Prev/Next when we don't have an exact count
  renderSearchPagination(pagination, data.page, hasMore);
}

function renderSearchPagination(container, currentPage, hasMore) {
  const parts = [];
  if (currentPage > 1) {
    parts.push(`<button class="page-btn" onclick="doSearch(${currentPage - 1})">← Prev</button>`);
  }
  parts.push(`<span class="page-btn active" style="cursor:default">Page ${currentPage}</span>`);
  if (hasMore) {
    parts.push(`<button class="page-btn" onclick="doSearch(${currentPage + 1})">Next →</button>`);
  }
  container.innerHTML = parts.join('');
}

// ── ANOMALY TABLE ──
let currentAnomalyPage = 1;
let currentAnomalyType = 'round_number';

const ANOMALY_DESCRIPTIONS = {
  round_number: 'Contracts where the value is an exact multiple of ₹1 Lakh — often a signal of estimated rather than market-competitive pricing.',
  quick_award:  'Contracts awarded on the same day or before the bid closing date — a major red flag for pre-determined outcomes.',
  high_value_state: 'Large contracts (> ₹10 Crore) awarded through state portals — often with less oversight than central procurement.',
};

function switchAnomalyType(type) {
  currentAnomalyType = type;
  currentAnomalyPage = 1;

  // Update button styles
  document.querySelectorAll('#btnRound, #btnQuick, #btnHvState').forEach(b => b.classList.remove('active'));
  const btnMap = { round_number: 'btnRound', quick_award: 'btnQuick', high_value_state: 'btnHvState' };
  document.getElementById(btnMap[type]).classList.add('active');

  // Update description
  document.getElementById('anomalyDesc').textContent = ANOMALY_DESCRIPTIONS[type] || '';

  loadAnomalies(type, 1);
}

function loadAnomalies(type, page = 1) {
  currentAnomalyPage = page;
  fetch(`/api/anomalies?type=${type}&page=${page}`)
    .then(r => r.json())
    .then(data => renderAnomalies(data))
    .catch(err => console.error('Anomaly error:', err));
}

function renderAnomalies(data) {
  const tbody = document.getElementById('anomalyBody');
  const pagination = document.getElementById('anomalyPagination');

  if (!data.results || data.results.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No anomalies found for this category.</td></tr>`;
    pagination.innerHTML = '';
    return;
  }

  tbody.innerHTML = data.results.map(row => {
    const extra = row.extra_info || {};
    let infoHtml = '';
    if (extra.days_to_award !== undefined) {
      infoHtml = `<span style="color:var(--red); font-family:var(--font-mono); font-size:11px">Awarded ${extra.days_to_award}d early</span>`;
    } else if (extra.contract_value_crore) {
      infoHtml = `<span style="color:var(--amber); font-family:var(--font-mono); font-size:11px">₹${extra.contract_value_crore} Cr</span>`;
    } else if (extra.tender_type) {
      infoHtml = `<span style="color:var(--text-muted); font-size:11px">${extra.tender_type}</span>`;
    }

    return `
      <tr>
        <td class="org-cell" title="${esc(row.org_name)}">${esc(truncate(row.org_name, 30))}</td>
        <td class="title-cell" title="${esc(row.title)}">${esc(truncate(row.title, 45))}</td>
        <td class="value-cell">${fmtCrore((row.contract_value || 0) / 1e7)}</td>
        <td style="font-size:12px; white-space:nowrap">${formatDateStr(row.aoc_date)}</td>
        <td><span class="portal-badge portal-${row.portal_type}">${row.portal_type || '—'}</span></td>
        <td>${infoHtml}</td>
      </tr>
    `;
  }).join('');

  const totalPages = Math.ceil(data.total / data.per_page);
  renderPagination(pagination, data.page, totalPages, (p) => loadAnomalies(currentAnomalyType, p));
}

// ── SINGLE-BID CONTRACTS ──
let currentSingleBidMin = 1000000;
function filterSingleBid(minVal) {
  currentSingleBidMin = minVal;
  // Update buttons
  const section = document.getElementById('singleBidSection');
  section.querySelectorAll('.btn-pill').forEach(b => {
    b.classList.toggle('active', parseInt(b.getAttribute('onclick').match(/\d+/)[0]) === minVal);
  });
  loadSingleBid(1);
}

function loadSingleBid(page = 1) {
  fetch(`/api/single-bid-contracts?min_val=${currentSingleBidMin}&page=${page}`)
    .then(r => r.json())
    .then(data => {
      const tbody = document.getElementById('singleBidBody');
      const pagination = document.getElementById('singleBidPagination');
      
      if (!data.results || data.results.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No single-bid contracts found in this range.</td></tr>`;
        pagination.innerHTML = '';
        return;
      }
      
      tbody.innerHTML = data.results.map(row => `
        <tr>
          <td class="org-cell" title="${esc(row.org_name)}">${esc(truncate(row.org_name, 30))}</td>
          <td class="title-cell" title="${esc(row.title)}">${esc(truncate(row.title, 45))}</td>
          <td class="value-cell">${fmtCrore((row.contract_value || 0) / 1e7)}</td>
          <td style="font-size:12px; white-space:nowrap">${formatDateStr(row.aoc_date)}</td>
          <td title="${esc(row.bidder_name)}">${esc(truncate(row.bidder_name, 30))}</td>
          <td><span class="portal-badge portal-${row.portal_type}">${row.portal_type || '—'}</span></td>
        </tr>
      `).join('');
      
      const totalPages = Math.ceil(data.total / data.per_page);
      renderPagination(pagination, data.page, totalPages, (p) => loadSingleBid(p));
    })
    .catch(err => console.error('Single bid error:', err));
}

// ── REPEAT WINNERS ──
let currentRepeatMin = 3;
function filterRepeatWinners(minWins) {
  currentRepeatMin = minWins;
  // Update buttons
  const section = document.getElementById('repeatWinnersSection');
  section.querySelectorAll('.btn-pill').forEach(b => {
    b.classList.toggle('active', parseInt(b.getAttribute('onclick').match(/\d+/)[0]) === minWins);
  });
  loadRepeatWinners(1);
}

function loadRepeatWinners(page = 1) {
  fetch(`/api/repeat-winners?min_wins=${currentRepeatMin}&page=${page}`)
    .then(r => r.json())
    .then(data => {
      const tbody = document.getElementById('repeatWinnersBody');
      const pagination = document.getElementById('repeatWinnersPagination');
      
      if (!data.results || data.results.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No repeat winners found with this criteria.</td></tr>`;
        pagination.innerHTML = '';
        return;
      }
      
      tbody.innerHTML = data.results.map(row => `
        <tr>
          <td class="title-cell" style="font-weight:600" title="${esc(row.bidder_name)}">${esc(truncate(row.bidder_name, 40))}</td>
          <td class="org-cell" title="${esc(row.org_name)}">${esc(truncate(row.org_name, 35))}</td>
          <td style="text-align:right; font-weight:600; color:var(--text-primary)">${row.wins}</td>
          <td class="value-cell">${row.total_value_crore ? '₹' + fmtNum(Math.round(row.total_value_crore)) + ' Cr' : '—'}</td>
          <td style="font-size:12px; white-space:nowrap; color:var(--text-muted)">${formatDateStr(row.first_win)}</td>
          <td style="font-size:12px; white-space:nowrap">${formatDateStr(row.last_win)}</td>
        </tr>
      `).join('');
      
      const totalPages = Math.ceil(data.total / data.per_page);
      renderPagination(pagination, data.page, totalPages, (p) => loadRepeatWinners(p));
    })
    .catch(err => console.error('Repeat winners error:', err));
}

// ── TENDER DETAIL MODAL ──
function loadTenderDetail(internalId, title) {
  document.getElementById('modalTitle').textContent = title || 'Tender Detail';
  document.getElementById('modalBody').innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-muted)"><div class="spinner" style="margin:0 auto"></div><p style="margin-top:12px">Loading…</p></div>`;
  document.getElementById('tenderModal').style.display = 'block';
  document.getElementById('modalBackdrop').style.display = 'block';
  document.body.style.overflow = 'hidden';

  fetch(`/api/tender/${internalId}`)
    .then(r => r.json())
    .then(data => renderTenderDetail(data))
    .catch(err => {
      document.getElementById('modalBody').innerHTML = `<p style="color:var(--red)">Failed to load details.</p>`;
    });
}

function renderTenderDetail(data) {
  const mainFields = [
    ['Tender ID',    data.tender_id],
    ['Organisation', data.org_name],
    ['Year',         data.year],
    ['Portal',       data.portal_type],
    ['AOC Date',     data.aoc_date],
    ['Closing Date', data.closing_date],
  ];

  const detailFields = data.details ? Object.entries(data.details) : [];

  const mainHtml = mainFields.map(([k, v]) => v ? `
    <div class="detail-item">
      <div class="detail-key">${esc(k)}</div>
      <div class="detail-val">${esc(String(v))}</div>
    </div>
  ` : '').join('');

  const detailHtml = detailFields.map(([k, v]) => `
    <div class="detail-item">
      <div class="detail-key">${esc(k)}</div>
      <div class="detail-val">${esc(String(v || '—'))}</div>
    </div>
  `).join('');

  document.getElementById('modalBody').innerHTML = `
    <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-muted);margin-bottom:12px">Overview</h3>
    <div class="detail-grid">${mainHtml}</div>
    ${detailHtml ? `
    <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-muted);margin:20px 0 12px">Contract Details</h3>
    <div class="detail-grid">${detailHtml}</div>
    ` : ''}
  `;
}

function closeModal() {
  document.getElementById('tenderModal').style.display    = 'none';
  document.getElementById('modalBackdrop').style.display = 'none';
  document.body.style.overflow = '';
}

// ── PAGINATION HELPER ──
function renderPagination(container, currentPage, totalPages, onPageClick) {
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const pages = [];
  const delta = 2;
  let lo = Math.max(1, currentPage - delta);
  let hi = Math.min(totalPages, currentPage + delta);

  if (lo > 1)  pages.push(1, lo > 2 ? '…' : null);
  for (let p = lo; p <= hi; p++) pages.push(p);
  if (hi < totalPages) pages.push(hi < totalPages - 1 ? '…' : null, totalPages);

  container.innerHTML = pages.filter(p => p !== null).map(p => {
    if (p === '…') return `<span class="page-btn" style="cursor:default;opacity:0.4">…</span>`;
    return `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="(${onPageClick.toString()})(${p})">${p}</button>`;
  }).join('');
}

// ── UTILITIES ──
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateStr(dateStr) {
  if (!dateStr) return '—';
  // "28-Jan-2026 12:00 AM" → "28 Jan 2026"
  const parts = dateStr.split(' ');
  return parts[0].replace(/-/g, ' ') || dateStr;
}

// ── KEYBOARD SEARCH ──
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('searchInput');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSearch(1);
    });
    input.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        const q = input.value.trim();
        if (q.length >= 3 || q.length === 0) doSearch(1);
      }, 600);
    });
  }
});
