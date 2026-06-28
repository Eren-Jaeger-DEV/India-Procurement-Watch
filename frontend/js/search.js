/* ═══════════════════════════════════════════
/**
 * search.js — Sentinel Full-Text Investigative Search Engine
 * India Procurement Watch — Sentinel Suite
 */

let _currentSearchPage = 1;

// ── HTML ENTITY ESCAPER ──
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── TEXT TRUNCATE HELPER ──
function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.substring(0, n) + '…' : s;
}

// ── DATE FORMATTING PROTOCOL ──
function formatDateStr(d) {
  if (!d) return '—';
  // Standardize potential variant timestamp strings (e.g. "28-Jan-2026 12:00 AM" → "28 Jan 2026")
  const parts = String(d).split(' ');
  if (parts.length >= 1) {
    const dp = parts[0].split('-');
    if (dp.length === 3) return `${dp[0]} ${dp[1]} ${dp[2]}`;
  }
  return d;
}

// ── SEARCH INITIATOR ──
window.doSearch = function(page = 1) {
  const q = (document.getElementById('searchInput')?.value || '').trim();
  const year = document.getElementById('filterYear')?.value || '';
  const portal = document.getElementById('filterPortal')?.value || '';

  // Play a quick high-tech tone for search triggers
  if (typeof playSynthBeep === 'function') {
    playSynthBeep(650, 'sine', 0.08);
  }

  // If search terms are entirely blank, hide outcomes gracefully
  if (!q && !year && !portal) {
    const res = document.getElementById('searchResults');
    if (res) res.style.display = 'none';
    return;
  }

  _currentSearchPage = page;

  const btn = document.querySelector('.btn-search');
  const input = document.getElementById('searchInput');
  if (btn) { btn.textContent = '…'; btn.disabled = true; }
  if (input) { input.style.opacity = '0.6'; }

  const params = new URLSearchParams({ page });
  if (q) params.set('q', q);
  if (year) params.set('year', year);
  if (portal) params.set('portal', portal);

  // Fetch from the live server backend, fallback gracefully to Client-Side In-Memory store if offline
  fetch(`/api/search?${params}`)
    .then(r => {
      if (!r.ok) throw new Error("API Offline");
      return r.json();
    })
    .then(data => renderSearchResults(data))
    .catch(err => {
      console.warn('Search API Offline. Executing high-fidelity local in-memory fallback audit...', err);
      executeLocalSearchFallback(q, year, portal, page);
    })
    .finally(() => {
      if (btn) { btn.textContent = 'Search'; btn.disabled = false; }
      if (input) { input.style.opacity = ''; }
    });
};

// ── CLIENT-SIDE IN-MEMORY DATABASE SEARCH (Offline Fallback Protocol) ──
function executeLocalSearchFallback(q, year, portal, page) {
  // Use globally integrated dataset fallback matching index.html records
  const dbStore = window.mockTenders || [
    { id: "IPW-2026-101", org: "National Highways Authority of India (NHAI)", title: "Srinagar-Baramulla Highway Corridor Sieve Phase III", year: 2026, portal: "central", val: 562000000, date: "2026-05-12" },
    { id: "IPW-2026-102", org: "Central Public Works Department (CPWD)", title: "Seismic Retrofitting of North-East Secretariats Complex", year: 2026, portal: "central", val: 125000000, date: "2026-04-18" },
    { id: "IPW-2026-103", org: "Ministry of Defence", title: "Tactical Ultra-Light Rugged Communication Units", year: 2026, portal: "central", val: 890000000, date: "2026-06-01" },
    { id: "IPW-2026-104", org: "Govt of Maharashtra - PWD", title: "CCTV AI Surveillance Edge Nodes Integration (Mumbai Sector)", year: 2026, portal: "state", val: 625000000, date: "2026-03-29" },
    { id: "IPW-2025-501", org: "National Highways Authority of India (NHAI)", title: "Golden Quadrilateral Patch Restoration Highway Section G", year: 2025, portal: "central", val: 580000000, date: "2025-11-20" }
  ];

  const qLower = q.toLowerCase();
  
  // High-fidelity schema filtering (accounting for both 'org' and 'org_name')
  const results = dbStore.filter(row => {
    const orgField = row.org || row.org_name || row.organisation_name || '';
    const titleField = row.title || '';
    const idField = row.id || row.internal_id || '';
    
    const matchesQuery = !q || 
      orgField.toLowerCase().includes(qLower) || 
      titleField.toLowerCase().includes(qLower) || 
      idField.toLowerCase().includes(qLower);

    const matchesYear = !year || String(row.year) === String(year);
    const matchesPortal = !portal || String(row.portal || row.portal_type).toLowerCase() === String(portal).toLowerCase();

    return matchesQuery && matchesYear && matchesPortal;
  });

  // Structural mock payload mimicking server responses
  const mockPayload = {
    results: results.map(r => ({
      internal_id: r.id || r.internal_id,
      org_name: r.org || r.org_name || r.organisation_name,
      title: r.title,
      year: r.year,
      portal_type: r.portal || r.portal_type,
      aoc_date: r.date || r.aoc_date
    })),
    per_page: 20,
    total: results.length,
    has_more: false
  };

  renderSearchResults(mockPayload);
}

// ── RENDER RESULTS TO CORE PANEL ──
function renderSearchResults(data) {
  const wrap = document.getElementById('searchResults');
  const meta = document.getElementById('resultsMeta');
  const tbody = document.getElementById('resultsBody');
  const pagEl = document.getElementById('searchPagination');

  if (!wrap) return;
  wrap.style.display = 'block';

  const start = (_currentSearchPage - 1) * (data.per_page || 20) + 1;
  const end = start + (data.results?.length || 0) - 1;
  const hasMore = data.has_more;

  if (meta) {
    meta.textContent = hasMore
      ? `Showing ${start}–${end} of many results`
      : `Showing ${start}–${end} of ${(data.total || 0).toLocaleString('en-IN')} results`;
  }

  // Play audio alarm on empty results, otherwise standard feedback
  if (!data.results || data.results.length === 0) {
    if (typeof playSynthBeep === 'function') {
      playSynthBeep(240, 'sawtooth', 0.15); // Synthesized low buzzer for empty scopes
    }
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="table-empty py-8 text-center text-slate-500 font-mono text-xs">
            ⚠️ No matching records found in the current index folder.
          </td>
        </tr>`;
    }
    if (pagEl) pagEl.innerHTML = '';
    return;
  }

  if (typeof playSynthBeep === 'function') {
    playSynthBeep(850, 'sine', 0.1); // Synthesized chime for audit matches
  }

  if (tbody) {
    tbody.innerHTML = data.results.map(row => {
      const portal = row.portal_type || '';
      const portalCls = portal === 'central' ? 'portal-central' : portal === 'state' ? 'portal-state' : 'portal-org';
      const idMatch = row.internal_id || '';
      
      // Safety mapping: resolve potential 'org_name' to prevent rendering blanks
      const orgValue = row.org_name || row.organisation_name || 'Unknown Department';

      return `
        <tr class="hover:bg-sky-950/20 transition duration-150 border-b border-sky-950/40">
          <td class="py-3 px-4 text-slate-300 font-medium" title="${esc(orgValue)}">${esc(truncate(orgValue, 35))}</td>
          <td class="py-3 px-4 text-slate-400" title="${esc(row.title)}">${esc(truncate(row.title, 55))}</td>
          <td class="py-3 px-4 font-mono text-slate-300 text-[11px]">${row.year || '—'}</td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold tracking-wider ${portalCls}">
              ${portal || '—'}
            </span>
          </td>
          <td class="py-3 px-4 text-slate-500 font-mono text-[11px]">${formatDateStr(row.aoc_date)}</td>
          <td class="py-3 px-4 text-right">
            <button class="px-2.5 py-1 bg-sky-500/10 hover:bg-sky-500 hover:text-black font-bold font-mono text-[10px] text-sky-400 border border-sky-400/30 rounded transition"
              onclick="inspectTender('${esc(idMatch)}')">
              INSPECT
            </button>
          </td>
        </tr>`;
    }).join('');
  }

  // Pagination Elements Mapping
  if (pagEl) {
    let html = '';
    if (_currentSearchPage > 1) {
      html += `<button class="px-3 py-1 bg-slate-900 border border-sky-950 text-sky-400 hover:border-sky-400 text-xs font-mono rounded transition" onclick="doSearch(${_currentSearchPage - 1})">‹ Prev</button>`;
    }
    html += `<span class="px-3 py-1 text-slate-400 text-xs font-mono">Page ${_currentSearchPage}</span>`;
    if (hasMore) {
      html += `<button class="px-3 py-1 bg-slate-900 border border-sky-950 text-sky-400 hover:border-sky-400 text-xs font-mono rounded transition" onclick="doSearch(${_currentSearchPage + 1})">Next ›</button>`;
    }
    pagEl.innerHTML = html;
  }
}