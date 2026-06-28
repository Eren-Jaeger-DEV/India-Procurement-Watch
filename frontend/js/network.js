/**
 * network.js
 * ==========
 * Front-end controller for the Company & Director Network Graph explorer.
 * Handles entity search, profile detail rendering, and Vis.js ego-network rendering.
 */

let _networkInstance = null;

// Search for companies or buyers in the network graph
async function searchNetworkEntities() {
  const q = (document.getElementById('networkSearchInput')?.value || '').trim();
  if (!q) return;

  const resultsDiv = document.getElementById('networkSearchResults');
  const listEl     = document.getElementById('networkSearchResultsList');
  if (!resultsDiv || !listEl) return;

  listEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px">Searching…</div>';
  resultsDiv.style.display = 'block';

  try {
    const res = await fetch(`/api/network/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();

    if (!res.ok || !data.results || data.results.length === 0) {
      listEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px">No network matches found. Note: Only companies matched to the MCA company registry show up in this view.</div>';
      return;
    }

    listEl.innerHTML = data.results.map(r => {
      const typeLabel = r.kind === 'company' ? 'Company (CIN matched)' : 'Department / Buyer';
      const detail = r.kind === 'company' ? `${r.state || 'Unknown state'} · ${r.email || 'No email'}` : `${r.state || 'Central/State'}`;
      return `
        <div class="report-card-item" style="padding:8px 10px;margin-bottom:4px;border-radius:6px;border:1px solid var(--border)"
             onclick="loadNetworkEntity('${r.id}', '${r.label.replace(/'/g, "\\'")}', '${r.kind}')">
          <div class="rc-org" style="font-size:12px">${r.label}</div>
          <div class="rc-stat" style="font-size:10px;color:var(--text-muted)">${typeLabel} (${detail})</div>
        </div>`;
    }).join('');
  } catch (e) {
    listEl.innerHTML = `<div style="color:var(--critical);font-size:12px">Error: ${e.message}</div>`;
  }
}

// Load and render specific node ego neighborhood
async function loadNetworkEntity(nodeId, label, kind) {
  // Hide empty state, show graph workspace
  document.getElementById('networkEmptyState').style.display = 'none';
  document.getElementById('networkGraphWorkspace').style.display = 'block';
  
  const profileEl = document.getElementById('networkNodeProfile');
  if (profileEl) profileEl.innerHTML = '<div style="color:var(--text-muted)">Loading profile…</div>';

  try {
    const res = await fetch(`/api/network/ego/${encodeURIComponent(nodeId)}`);
    const data = await res.json();
    if (!res.ok) {
      if (profileEl) profileEl.innerHTML = `<div style="color:var(--critical)">${data.error || 'Failed to load neighborhood.'}</div>`;
      return;
    }

    renderProfile(data.focus, data.nodes, label, kind);
    renderGraph(data.focus, data.nodes, data.edges);
  } catch (e) {
    if (profileEl) profileEl.innerHTML = `<div style="color:var(--critical)">Error: ${e.message}</div>`;
  }
}

// Helper to format values
function fmtNetValue(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K Cr`;
  return `₹${Number(n).toFixed(1)} Cr`;
}

// Render the left profile pane
function renderProfile(focusId, nodes, label, kind) {
  const profileEl = document.getElementById('networkNodeProfile');
  if (!profileEl) return;

  const node = nodes.find(n => n.id === focusId);
  if (!node) {
    profileEl.innerHTML = '<div style="color:var(--text-muted)">Entity not found.</div>';
    return;
  }

  let html = `
    <div style="border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:8px">
      <div style="font-weight:800;font-size:14px;color:var(--text-primary);margin-bottom:4px">${node.label}</div>
      <span class="portal-badge ${node.kind === 'company' ? 'portal-central' : 'portal-state'}">${node.kind.toUpperCase()}</span>
    </div>
  `;

  if (node.kind === 'company') {
    html += `
      <div class="modal-body-field">
        <div class="modal-field-label">Corporate Identification No. (CIN)</div>
        <div class="modal-field-value" style="font-family:monospace;font-size:11px">${node.id.replace('C:', '')}</div>
      </div>
      <div class="modal-body-field">
        <div class="modal-field-label">Registered State</div>
        <div class="modal-field-value">${node.state || 'Unknown'}</div>
      </div>
      <div class="modal-body-field">
        <div class="modal-field-label">Official Registry Email</div>
        <div class="modal-field-value" style="color:var(--accent);word-break:break-all">${node.email || 'Not listed'}</div>
      </div>
      <div class="modal-body-field">
        <div class="modal-field-label">Total Contracts Won</div>
        <div class="modal-field-value">${node.n_contracts ? node.n_contracts.toLocaleString('en-IN') : '0'}</div>
      </div>
      <div class="modal-body-field">
        <div class="modal-field-label">Capped Spending Won</div>
        <div class="modal-field-value">${fmtNetValue(node.value)}</div>
      </div>
    `;
  } else if (node.kind === 'director' || node.kind === 'person') {
    // Director
    html += `
      <div class="modal-body-field">
        <div class="modal-field-label">Director Identification No. (DIN)</div>
        <div class="modal-field-value" style="font-family:monospace;font-size:11px">${node.id.replace('D:', '')}</div>
      </div>
      <div class="modal-body-field">
        <div class="modal-field-label">Total Connected Companies</div>
        <div class="modal-field-value">${node.n_contracts ? node.n_contracts.toLocaleString('en-IN') : '0'}</div>
      </div>
    `;
  } else {
    // Buyer
    html += `
      <div class="modal-body-field">
        <div class="modal-field-label">Procuring Agency</div>
        <div class="modal-field-value">${node.label}</div>
      </div>
      <div class="modal-body-field">
        <div class="modal-field-label">Portal / Region</div>
        <div class="modal-field-value">${node.state || 'Central/State'}</div>
      </div>
      <div class="modal-body-field">
        <div class="modal-field-label">Total Contracts Awarded</div>
        <div class="modal-field-value">${node.n_contracts ? node.n_contracts.toLocaleString('en-IN') : '0'}</div>
      </div>
      <div class="modal-body-field">
        <div class="modal-field-label">Unique Vendors Awarded</div>
        <div class="modal-field-value">${node.n_buyers ? node.n_buyers.toLocaleString('en-IN') : '0'}</div>
      </div>
      <div class="modal-body-field">
        <div class="modal-field-label">Indicative Spending Value</div>
        <div class="modal-field-value">${fmtNetValue(node.value)}</div>
      </div>
    `;
  }

  profileEl.innerHTML = html;
}

// Render the Vis.js Graph Canvas
function renderGraph(focusId, rawNodes, rawEdges) {
  const container = document.getElementById('networkGraphCanvas');
  if (!container || !window.vis) return;

  // Clean old instance
  if (_networkInstance) {
    _networkInstance.destroy();
    _networkInstance = null;
  }

  // Format nodes
  const nodes = rawNodes.map(n => {
    const isFocus = n.id === focusId;
    let color = '#6366f1'; // Indigo for general company nodes
    let shape = 'dot';
    let size  = 16;
    
    if (isFocus) {
      color = '#f97316'; // Orange accent for the focus node
      size = 26;
    } else if (n.kind === 'buyer') {
      color = '#06b6d4'; // Cyan for department buyers
      shape = 'triangle';
      size = 18;
    } else if (n.kind === 'tender') {
      color = '#a855f7'; // Purple for tender notices
      shape = 'square';
      size = 12;
    }

    // Label formatting: clean length
    let cleanLabel = n.label;
    if (cleanLabel.length > 20) {
      cleanLabel = cleanLabel.substring(0, 18) + '…';
    }

    return {
      id: n.id,
      label: cleanLabel,
      title: `${n.label}\nKind: ${n.kind}\nContracts: ${n.n_contracts || 0}\nValue: ${fmtNetValue(n.value)}`,
      color: {
        background: color,
        border: isFocus ? '#fb923c' : 'rgba(255,255,255,0.15)',
        highlight: { background: '#f97316', border: '#ff9800' }
      },
      font: { color: '#e8eaf0', size: isFocus ? 13 : 11, face: 'Inter' },
      size: size,
      shape: shape,
      borderWidth: isFocus ? 2 : 1
    };
  });

  // Format edges (relationships)
  const edges = rawEdges.map(e => {
    let color = 'rgba(255,255,255,0.12)';
    let width = 1.5;
    let label = e.relationship;

    if (e.relationship === 'SHARES_EMAIL') {
      color = '#f87171'; // Red for shared email links (suspicious)
      width = 2;
    } else if (e.relationship === 'SHARES_ADDRESS') {
      color = '#ef4444'; // Red for shared physical address links (suspicious)
      width = 2.5;
    } else if (e.relationship === 'CO_BIDDER') {
      color = '#38bdf8'; // Blue for consortiums
      width = 1.5;
    }

    return {
      from: e.source,
      to: e.target,
      label: label,
      title: `${e.label || e.relationship}\nWeight: ${e.weight}`,
      color: { color: color, highlight: '#f97316' },
      width: width,
      font: { color: '#94a3b8', size: 9, align: 'middle' },
      arrows: e.relationship === 'AWARDED' ? { to: { enabled: true, scaleFactor: 0.5 } } : undefined,
      smooth: { type: 'continuous', roundness: 0.2 }
    };
  });

  const data = {
    nodes: new vis.DataSet(nodes),
    edges: new vis.DataSet(edges)
  };

  const options = {
    physics: {
      solver: 'forceAtlas2Based',
      forceAtlas2Based: {
        gravitationalConstant: -50,
        centralGravity: 0.01,
        springLength: 100,
        springConstant: 0.08
      },
      stabilization: { iterations: 120, updateInterval: 25 }
    },
    interaction: {
      hover: true,
      tooltipDelay: 100,
      zoomView: true,
      dragView: true
    }
  };

  _networkInstance = new vis.Network(container, data, options);
  
  // Double-click neighbor to navigate inside graph workspace
  _networkInstance.on("doubleClick", function (params) {
    if (params.nodes.length > 0) {
      const clickedNodeId = params.nodes[0];
      const matchingNode = rawNodes.find(n => n.id === clickedNodeId);
      if (matchingNode) {
        loadNetworkEntity(matchingNode.id, matchingNode.label, matchingNode.kind);
      }
    }
  });
}

// Global helper to open a vendor's network neighborhood directly from other dashboard lists
window.openNetworkEntity = async function(label) {
  if (window.switchView) switchView('view-network');

  const input = document.getElementById('networkSearchInput');
  if (input) input.value = label;

  const resultsDiv = document.getElementById('networkSearchResults');
  const listEl     = document.getElementById('networkSearchResultsList');

  try {
    const res = await fetch(`/api/network/search?q=${encodeURIComponent(label)}`);
    const data = await res.json();

    if (res.ok && data.results && data.results.length > 0) {
      // Prioritize exact match, default to first candidate
      const exact = data.results.find(r => r.label.toLowerCase() === label.toLowerCase()) || data.results[0];
      loadNetworkEntity(exact.id, exact.label, exact.kind);

      if (resultsDiv && listEl) {
        listEl.innerHTML = data.results.map(r => {
          const typeLabel = r.kind === 'company' ? 'Company (CIN matched)' : 'Department / Buyer';
          const detail = r.kind === 'company' ? `${r.state || 'Unknown state'} · ${r.email || 'No email'}` : `${r.state || 'Central/State'}`;
          const activeCls = r.id === exact.id ? 'active' : '';
          return `
            <div class="report-card-item ${activeCls}" style="padding:8px 10px;margin-bottom:4px;border-radius:6px;border:1px solid var(--border)"
                 onclick="loadNetworkEntity('${r.id}', '${r.label.replace(/'/g, "\\'")}', '${r.kind}')">
              <div class="rc-org" style="font-size:12px">${r.label}</div>
              <div class="rc-stat" style="font-size:10px;color:var(--text-muted)">${typeLabel} (${detail})</div>
            </div>`;
        }).join('');
        resultsDiv.style.display = 'block';
      }
    } else {
      if (listEl) {
        listEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px">No network matches found for this name. Only companies matched to the MCA company registry appear in this view.</div>';
      }
      if (resultsDiv) resultsDiv.style.display = 'block';
      
      // Hide workspace, show empty state
      document.getElementById('networkGraphWorkspace').style.display = 'none';
      document.getElementById('networkEmptyState').style.display = 'block';
    }
  } catch (e) {
    console.warn("Failed to automatically load network entity:", e);
  }
};

// ==========================================
// EXPORT NETWORK TO PDF
// ==========================================
function exportNetworkPDF() {
  const canvasContainer = document.getElementById('networkGraphCanvas');
  if (!canvasContainer) return;
  
  // We need to wait for Vis.js to finish drawing, but since it's user triggered, it should be done.
  const clone = canvasContainer.cloneNode(true);
  const wrapper = document.createElement('div');
  wrapper.className = 'pdf-export-container';
  
  const header = document.createElement('div');
  header.innerHTML = '<h2>India Procurement Watch - Director Network Ego-Graph</h2><p style="color:#666">Generated on: ' + new Date().toLocaleString() + '</p><hr style="margin-bottom:20px">';
  wrapper.appendChild(header);
  
  // Because Vis.js uses a canvas inside, a direct clone might lose the canvas content.
  // We will manually append the image of the canvas.
  const originalCanvas = canvasContainer.querySelector('canvas');
  if (originalCanvas) {
    const img = document.createElement('img');
    img.src = originalCanvas.toDataURL('image/png');
    img.style.width = '100%';
    img.style.height = 'auto';
    img.style.border = '1px solid #ccc';
    wrapper.appendChild(img);
  }
  
  const profile = document.getElementById('networkNodeProfile');
  if (profile) {
      const profileClone = document.createElement('div');
      profileClone.innerHTML = '<h3>Entity Profile</h3>' + profile.innerHTML;
      profileClone.style.marginTop = '20px';
      wrapper.appendChild(profileClone);
  }
  
  const watermark = document.createElement('div');
  watermark.className = 'pdf-watermark';
  wrapper.appendChild(watermark);
  
  const opt = {
    margin:       10,
    filename:     'Director_Network_Graph.pdf',
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  
  html2pdf().set(opt).from(wrapper).save();
}

