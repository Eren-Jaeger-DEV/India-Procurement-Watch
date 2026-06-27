/* ═══════════════════════════════════════════
   search.js — Full-text search functionality
   India Procurement Watch
   ═══════════════════════════════════════════ */

let _currentSearchPage = 1;

// ── HELPERS ──
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.substring(0, n) + '…' : s;
}
function formatDateStr(d) {
  if (!d) return '—';
  // "28-Jan-2026 12:00 AM" → "28 Jan 2026"
  const parts = String(d).split(' ');
  if (parts.length >= 1) {
    const dp = parts[0].split('-');
    if (dp.length === 3) return `${dp[0]} ${dp[1]} ${dp[2]}`;
  }
  return d;
}

// ── SEARCH ──
window.doSearch = function(page = 1) {
  const q      = (document.getElementById('searchInput')?.value || '').trim();
  const year   = document.getElementById('filterYear')?.value || '';
  const portal = document.getElementById('filterPortal')?.value || '';

  if (!q && !year && !portal) {
    const res = document.getElementById('searchResults');
    if (res) res.style.display = 'none';
    return;
  }

  _currentSearchPage = page;

  const btn   = document.querySelector('.btn-search');
  const input = document.getElementById('searchInput');
  if (btn)   { btn.textContent = '…'; btn.disabled = true; }
  if (input) { input.style.opacity = '0.6'; }

  const params = new URLSearchParams({ page });
  if (q)      params.set('q', q);
  if (year)   params.set('year', year);
  if (portal) params.set('portal', portal);

  fetch(`/api/search?${params}`)
    .then(r => r.json())
    .then(data => renderSearchResults(data))
    .catch(err => console.error('Search error:', err))
    .finally(() => {
      if (btn)   { btn.textContent = 'Search'; btn.disabled = false; }
      if (input) { input.style.opacity = ''; }
    });
};

function renderSearchResults(data) {
  const wrap   = document.getElementById('searchResults');
  const meta   = document.getElementById('resultsMeta');
  const tbody  = document.getElementById('resultsBody');
  const pagEl  = document.getElementById('searchPagination');

  if (!wrap) return;
  wrap.style.display = 'block';

  const start   = (_currentSearchPage - 1) * (data.per_page || 20) + 1;
  const end     = start + (data.results?.length || 0) - 1;
  const hasMore = data.has_more;

  if (meta) {
    meta.textContent = hasMore
      ? `Showing ${start}–${end} of many results`
      : `Showing ${start}–${end} of ${(data.total || 0).toLocaleString('en-IN')} results`;
  }

  if (!data.results || data.results.length === 0) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No results found.</td></tr>`;
    if (pagEl) pagEl.innerHTML = '';
    return;
  }

  if (tbody) {
    tbody.innerHTML = data.results.map(row => {
      const portal = row.portal_type || '';
      const portalCls = portal === 'central' ? 'portal-central' : portal === 'state' ? 'portal-state' : 'portal-org';
      return `<tr>
        <td class="td-org" title="${esc(row.org_name)}">${esc(truncate(row.org_name, 35))}</td>
        <td class="td-title" title="${esc(row.title)}">${esc(truncate(row.title, 55))}</td>
        <td style="white-space:nowrap;font-family:monospace;font-size:11px">${row.year || '—'}</td>
        <td><span class="portal-badge ${portalCls}">${portal || '—'}</span></td>
        <td class="td-date">${formatDateStr(row.aoc_date)}</td>
        <td>
          <button class="btn-mini active" style="cursor:pointer"
            onclick="openTenderDetail('${esc(row.internal_id)}')">
            View
          </button>
        </td>
      </tr>`;
    }).join('');
  }

  // Pagination
  if (pagEl) {
    let html = '';
    if (_currentSearchPage > 1) {
      html += `<button class="page-btn" onclick="doSearch(${_currentSearchPage - 1})">‹ Prev</button>`;
    }
    html += `<span class="page-btn active" style="cursor:default">Page ${_currentSearchPage}</span>`;
    if (hasMore) {
      html += `<button class="page-btn" onclick="doSearch(${_currentSearchPage + 1})">Next ›</button>`;
    }
    pagEl.innerHTML = html;
  }
}
