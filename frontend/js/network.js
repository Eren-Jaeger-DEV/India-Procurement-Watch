/**
 * network.js
 * ==========
 * Front-end controller for the Company & Director Network Graph explorer.
 * Handles entity search, profile detail rendering, and Vis.js ego-network rendering.
 * India Procurement Watch — Sentinel Investigative Suite
 */

let _networkInstance = null;

// ── COMPREHENSIVE OFFLINE MOCK REGISTRY DATABASE ──
const _mockNetworkRegistry = {
  entities: [
    { id: "C:U45201DL2018PTC334512", label: "Apex Infrastructure Pvt Ltd", kind: "company", state: "Delhi", email: "office@apex-infra.in", value: 2450.0, n_contracts: 14, n_buyers: 2 },
    { id: "C:U60231MH2020PTC341105", label: "Horizon Logistics Inc.", kind: "company", state: "Maharashtra", email: "office@apex-infra.in", value: 680.0, n_contracts: 8, n_buyers: 1 },
    { id: "C:U74999MH2021PTC352990", label: "Trident Security Services", kind: "company", state: "Maharashtra", email: "contact@tridentsecurity.co.in", value: 625.0, n_contracts: 4, n_buyers: 1 },
    { id: "B:NHAI", label: "National Highways Authority of India (NHAI)", kind: "buyer", state: "Delhi", value: 3112.0, n_contracts: 142, n_buyers: 23 },
    { id: "B:CPWD", label: "Central Public Works Department (CPWD)", kind: "buyer", state: "Delhi", value: 1620.0, n_contracts: 98, n_buyers: 19 },
    { id: "D:08214562", label: "Rajan Kumar Giri (Director)", kind: "director", state: "Delhi", value: 3130.0, n_contracts: 22, n_buyers: 3 }
  ],
  relationships: [
    { source: "C:U45201DL2018PTC334512", target: "B:NHAI", relationship: "AWARDED", weight: 14, label: "Won 14 contracts" },
    { source: "C:U45201DL2018PTC334512", target: "D:08214562", relationship: "DIRECTOR", weight: 1, label: "Active Board Director" },
    { source: "C:U60231MH2020PTC341105", target: "D:08214562", relationship: "DIRECTOR", weight: 1, label: "Active Board Director" },
    { source: "C:U60231MH2020PTC341105", target: "B:CPWD", relationship: "AWARDED", weight: 8, label: "Won 8 contracts" },
    { source: "C:U45201DL2018PTC334512", target: "C:U60231MH2020PTC341105", relationship: "SHARES_EMAIL", weight: 5, label: "Overlapping Registry Email (office@apex-infra.in)" },
    { source: "C:U74999MH2021PTC352990", target: "B:CPWD", relationship: "AWARDED", weight: 4, label: "Won 4 contracts" }
  ]
};

// Helper to play clean retro cyber clicks and alarm pings
function playNetworkBeep(freq, type, duration) {
  if (typeof window.playSynthBeep === 'function') {
    window.playSynthBeep(freq, type, duration);
  }
}

// Helper to format values
function fmtNetValue(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K Cr`;
  return `₹${Number(n).toFixed(1)} Cr`;
}

// Search for companies, directors or buyers in the network graph
async function searchNetworkEntities() {
  const q = (document.getElementById('networkSearchInput')?.value || '').trim();
  if (!q) return;

  // Sound cue for active search sweep
  playNetworkBeep(650, 'sine', 0.08);

  const resultsDiv = document.getElementById('networkSearchResults');
  const listEl     = document.getElementById('networkSearchResultsList');
  if (!resultsDiv || !listEl) return;

  listEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;font-family:monospace" class="animate-pulse">🛰️ DISCOVERING CO-CONSPIRATOR CONNECTIONS...</div>';
  resultsDiv.style.display = 'block';

  try {
    // Attempt local live API fetch, fallback gracefully to structural simulation if offline
    const res = await fetch(`/api/network/search?q=${encodeURIComponent(q)}`)
      .then(async r => {
        if (!r.ok) throw new Error("Offline Gateway");
        return await r.json();
      })
      .catch(err => {
        console.warn("Network Search API Offline. Executing high-fidelity simulation registry scan...", err);
        return scanLocalSimulationRegistry(q);
      });

    if (!res || !res.results || res.results.length === 0) {
      playNetworkBeep(240, 'sawtooth', 0.15); // Low alert buzzer
      listEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;line-height:1.4">⚠️ No network matches found. Note: Only companies matched to the MCA/ROC company registries appear in this scope.</div>';
      return;
    }

    // Success sound cue
    playNetworkBeep(850, 'sine', 0.1);

    listEl.innerHTML = res.results.map(r => {
      let typeLabel = 'Target Buyer';
      if (r.kind === 'company') typeLabel = 'Company (CIN matched)';
      else if (r.kind === 'director') typeLabel = 'Board Director (DIN matched)';

      const detail = r.kind === 'company' ? `${r.state || 'Unknown state'} · ${r.email || 'No email'}` : `${r.state || 'Central/State'}`;
      return `
        <div class="report-card-item" style="padding:10px 12px;margin-bottom:6px;border-radius:10px;border:1px solid var(--border);cursor:pointer;background:rgba(56,189,248,0.02);transition:all 0.2s"
             onclick="loadNetworkEntity('${r.id}', '${r.label.replace(/'/g, "\\'")}', '${r.kind}')"
             onmouseenter="window.playSynthBeep(900, 'sine', 0.01)">
          <div class="rc-org" style="font-size:12px;font-weight:700;color:var(--accent)">${r.label}</div>
          <div class="rc-stat" style="font-size:10px;color:var(--text-muted);margin-top:2px;font-family:monospace">${typeLabel} (${detail})</div>
        </div>`;
    }).join('');
  } catch (e) {
    playNetworkBeep(220, 'sawtooth', 0.2);
    listEl.innerHTML = `<div style="color:var(--critical);font-size:12px;font-family:monospace">ERROR IN PROCESSOR: ${e.message}</div>`;
  }
}

// Local in-memory search matchmaker
function scanLocalSimulationRegistry(query) {
  const qLower = query.toLowerCase();
  const matched = _mockNetworkRegistry.entities.filter(e => 
    e.label.toLowerCase().includes(qLower) || 
    e.id.toLowerCase().includes(qLower) ||
    (e.email && e.email.toLowerCase().includes(qLower))
  );

  return {
    results: matched.map(m => ({
      id: m.id,
      label: m.label,
      kind: m.kind,
      state: m.state,
      email: m.email
    }))
  };
}

// Load and render specific node ego neighborhood
async function loadNetworkEntity(nodeId, label, kind) {
  playNetworkBeep(700, 'sine', 0.06); // Confirm click tone

  // Hide empty state, show graph workspace
  document.getElementById('networkEmptyState').style.display = 'none';
  document.getElementById('networkGraphWorkspace').style.display = 'block';
  
  const profileEl = document.getElementById('networkNodeProfile');
  if (profileEl) profileEl.innerHTML = '<div style="color:var(--text-muted);font-family:monospace" class="animate-pulse">🔄 EXTRACTING REGISTRY GRAPH NEIGHBORHOOD...</div>';

  try {
    const data = await fetch(`/api/network/ego/${encodeURIComponent(nodeId)}`)
      .then(async r => {
        if (!r.ok) throw new Error("Offline Ego Hub");
        return await r.json();
      })
      .catch(err => {
        console.warn("Neighborhood API Offline. Resolving simulated 1-hop ego-graph...", err);
        return resolveLocalSimulatedEgoGraph(nodeId);
      });

    renderProfile(data.focus, data.nodes, label, kind);
    renderGraph(data.focus, data.nodes, data.edges);
  } catch (e) {
    if (profileEl) profileEl.innerHTML = `<div style="color:var(--critical);font-family:monospace">Error mapping node links: ${e.message}</div>`;
  }
}

// Resolves ego neighborhood linkages from mock store
function resolveLocalSimulatedEgoGraph(focusId) {
  const nodes = [];
  const edges = [];
  
  // Find focus entity
  const focusEntity = _mockNetworkRegistry.entities.find(e => e.id === focusId);
  if (!focusEntity) return { focus: focusId, nodes: [], edges: [] };
  
  nodes.push(focusEntity);
  
  // Find 1-hop connected nodes & edges
  _mockNetworkRegistry.relationships.forEach(rel => {
    if (rel.source === focusId) {
      edges.push(rel);
      const targetNode = _mockNetworkRegistry.entities.find(e => e.id === rel.target);
      if (targetNode && !nodes.some(n => n.id === targetNode.id)) {
        nodes.push(targetNode);
      }
    } else if (rel.target === focusId) {
      edges.push(rel);
      const sourceNode = _mockNetworkRegistry.entities.find(e => e.id === rel.source);
      if (sourceNode && !nodes.some(n => n.id === sourceNode.id)) {
        nodes.push(sourceNode);
      }
    }
  });

  return {
    focus: focusId,
    nodes: nodes,
    edges: edges
  };
}

// Render the left profile pane
function renderProfile(focusId, nodes, label, kind) {
  const profileEl = document.getElementById('networkNodeProfile');
  if (!profileEl) return;

  const node = nodes.find(n => n.id === focusId);
  if (!node) {
    profileEl.innerHTML = '<div style="color:var(--text-muted)">Entity profile could not be localized.</div>';
    return;
  }

  const isCompany = node.kind === 'company';
  const isDirector = node.kind === 'director';

  let badgeClass = 'portal-state';
  if (isCompany) badgeClass = 'portal-central';
  else if (isDirector) badgeClass = 'portal-org';

  let html = `
    <div style="border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:12px">
      <div style="font-weight:700;font-size:15px;color:var(--text-primary);line-height:1.3;margin-bottom:6px">${node.label}</div>
      <span class="portal-badge ${badgeClass}" style="font-size:9px;font-family:monospace;letter-spacing:0.05em">${node.kind.toUpperCase()}</span>
    </div>
  `;

  if (isCompany) {
    html += `
      <div class="modal-body-field" style="margin-bottom: 10px;">
        <div class="modal-field-label" style="font-size:10px;text-transform:uppercase;color:var(--text-muted)">Corporate ID (CIN)</div>
        <div class="modal-field-value" style="font-family:monospace;font-size:11px;color:var(--text-primary);margin-top:2px">${node.id.replace('C:', '')}</div>
      </div>
      <div class="modal-body-field" style="margin-bottom: 10px;">
        <div class="modal-field-label" style="font-size:10px;text-transform:uppercase;color:var(--text-muted)">State of Incorporation</div>
        <div class="modal-field-value" style="font-size:12px;color:var(--text-primary);margin-top:2px">${node.state || 'Unknown'}</div>
      </div>
      <div class="modal-body-field" style="margin-bottom: 10px;">
        <div class="modal-field-label" style="font-size:10px;text-transform:uppercase;color:var(--text-muted)">Official Domain Email</div>
        <div class="modal-field-value" style="font-size:11px;color:var(--accent);word-break:break-all;font-family:monospace;margin-top:2px">${node.email || 'Not listed'}</div>
      </div>
      <div class="modal-body-field" style="margin-bottom: 10px;">
        <div class="modal-field-label" style="font-size:10px;text-transform:uppercase;color:var(--text-muted)">Total Procurement Wins</div>
        <div class="modal-field-value" style="font-size:12px;color:var(--text-primary);margin-top:2px;font-weight:bold">${node.n_contracts ? node.n_contracts.toLocaleString('en-IN') : '0'} wins</div>
      </div>
      <div class="modal-body-field">
        <div class="modal-field-label" style="font-size:10px;text-transform:uppercase;color:var(--text-muted)">Aggregate Value Tracked</div>
        <div class="modal-field-value" style="font-size:13px;color:var(--warning);font-weight:700;font-family:monospace;margin-top:2px">${fmtNetValue(node.value)}</div>
      </div>
    `;
  } else if (isDirector) {
    html += `
      <div class="modal-body-field" style="margin-bottom: 10px;">
        <div class="modal-field-label" style="font-size:10px;text-transform:uppercase;color:var(--text-muted)">Director ID (DIN)</div>
        <div class="modal-field-value" style="font-family:monospace;font-size:11px;color:var(--text-primary);margin-top:2px">${node.id.replace('D:', '')}</div>
      </div>
      <div class="modal-body-field" style="margin-bottom: 10px;">
        <div class="modal-field-label" style="font-size:10px;text-transform:uppercase;color:var(--text-muted)">Registered State Linkage</div>
        <div class="modal-field-value" style="font-size:12px;color:var(--text-primary);margin-top:2px">${node.state || 'Delhi NCR'}</div>
      </div>
      <div class="modal-body-field" style="margin-bottom: 10px;">
        <div class="modal-field-label" style="font-size:10px;text-transform:uppercase;color:var(--text-muted)">Interlinked Companies</div>
        <div class="modal-field-value" style="font-size:12px;color:var(--text-primary);margin-top:2px;font-weight:bold">${node.n_buyers || '2'} active boards</div>
      </div>
      <div class="modal-body-field">
        <div class="modal-field-label" style="font-size:10px;text-transform:uppercase;color:var(--text-muted)">Linked Contract Exposure</div>
        <div class="modal-field-value" style="font-size:13px;color:var(--warning);font-weight:700;font-family:monospace;margin-top:2px">${fmtNetValue(node.value)}</div>
      </div>
    `;
  } else {
    // Target Buyer / Department
    html += `
      <div class="modal-body-field" style="margin-bottom: 10px;">
        <div class="modal-field-label" style="font-size:10px;text-transform:uppercase;color:var(--text-muted)">Agency / Ministry</div>
        <div class="modal-field-value" style="font-size:12px;color:var(--text-primary);margin-top:2px">${node.label}</div>
      </div>
      <div class="modal-body-field" style="margin-bottom: 10px;">
        <div class="modal-field-label" style="font-size:10px;text-transform:uppercase;color:var(--text-muted)">Portal Zone</div>
        <div class="modal-field-value" style="font-size:12px;color:var(--text-primary);margin-top:2px">${node.state || 'Central Government'}</div>
      </div>
      <div class="modal-body-field" style="margin-bottom: 10px;">
        <div class="modal-field-label" style="font-size:10px;text-transform:uppercase;color:var(--text-muted)">Total Contracts Sourced</div>
        <div class="modal-field-value" style="font-size:12px;color:var(--text-primary);margin-top:2px;font-weight:bold">${node.n_contracts ? node.n_contracts.toLocaleString('en-IN') : '0'} awards</div>
      </div>
      <div class="modal-body-field" style="margin-bottom: 10px;">
        <div class="modal-field-label" style="font-size:10px;text-transform:uppercase;color:var(--text-muted)">Unique Bidders Identified</div>
        <div class="modal-field-value" style="font-size:12px;color:var(--text-primary);margin-top:2px">${node.n_buyers ? node.n_buyers.toLocaleString('en-IN') : '0'} suppliers</div>
      </div>
      <div class="modal-body-field">
        <div class="modal-field-label" style="font-size:10px;text-transform:uppercase;color:var(--text-muted)">Aggregate Sourcing Footprint</div>
        <div class="modal-field-value" style="font-size:13px;color:var(--accent);font-weight:700;font-family:monospace;margin-top:2px">${fmtNetValue(node.value)}</div>
      </div>
    `;
  }

  profileEl.innerHTML = html;
}

// Render the Vis.js Graph Canvas
function renderGraph(focusId, rawNodes, rawEdges) {
  const container = document.getElementById('networkGraphCanvas');
  if (!container || !window.vis) return;

  // Destroy previous network context cleanly
  if (_networkInstance) {
    _networkInstance.destroy();
    _networkInstance = null;
  }

  // Format nodes
  const nodes = rawNodes.map(n => {
    const isFocus = n.id === focusId;
    let color = '#38bdf8'; // Cyan/Blue for target contractors
    let shape = 'dot';
    let size  = 16;
    
    if (isFocus) {
      color = '#f59e0b'; // Amber focal accent
      size = 26;
    } else if (n.kind === 'buyer') {
      color = '#a855f7'; // Purple for department buyers
      shape = 'triangle';
      size = 18;
    } else if (n.kind === 'director') {
      color = '#10b981'; // Emerald for directors
      shape = 'diamond';
      size = 15;
    }

    // Wrap label length elegantly
    let cleanLabel = n.label;
    if (cleanLabel.length > 20) {
      cleanLabel = cleanLabel.substring(0, 18) + '…';
    }

    return {
      id: n.id,
      label: cleanLabel,
      title: `${n.label}\nKind: ${n.kind.toUpperCase()}\nContracts: ${n.n_contracts || 0}\nValue: ${fmtNetValue(n.value)}`,
      color: {
        background: color,
        border: isFocus ? '#fb923c' : 'rgba(56,189,248,0.25)',
        highlight: { background: '#fb923c', border: '#f59e0b' }
      },
      font: { color: '#f8fafc', size: isFocus ? 13 : 11, face: 'Space Grotesk', bold: isFocus },
      size: size,
      shape: shape,
      borderWidth: isFocus ? 3 : 1
    };
  });

  // Format edges (relationships)
  const edges = rawEdges.map(e => {
    let color = 'rgba(56, 189, 248, 0.15)';
    let width = 1.5;
    let label = e.relationship;

    if (e.relationship === 'SHARES_EMAIL') {
      color = '#ef4444'; // Alarm red for identical emails (collusion risk)
      width = 2.5;
    } else if (e.relationship === 'SHARES_ADDRESS') {
      color = '#ef4444'; // Alarm red for shared location proxies
      width = 2.5;
    } else if (e.relationship === 'DIRECTOR') {
      color = '#10b981'; // Emerald for active board overlap paths
      width = 2.0;
    }

    return {
      from: e.source,
      to: e.target,
      label: label,
      title: `${e.label || e.relationship}\nWeight Factor: ${e.weight}`,
      color: { color: color, highlight: '#fb923c' },
      width: width,
      font: { color: '#94a3b8', size: 9, face: 'JetBrains Mono', align: 'middle' },
      arrows: e.relationship === 'AWARDED' ? { to: { enabled: true, scaleFactor: 0.5 } } : undefined,
      smooth: { type: 'continuous', roundness: 0.25 }
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
        gravitationalConstant: -75,
        centralGravity: 0.015,
        springLength: 110,
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
  
  // Single click trigger profile detail drill down
  _networkInstance.on("click", function (params) {
    if (params.nodes.length > 0) {
      const clickedNodeId = params.nodes[0];
      playNetworkBeep(720, 'sine', 0.05);
      displayNodeDetailsFromCanvas(clickedNodeId, rawNodes);
    }
  });

  // Double-click neighbor to navigate inside graph workspace
  _networkInstance.on("doubleClick", function (params) {
    if (params.nodes.length > 0) {
      const clickedNodeId = params.nodes[0];
      const matchingNode = rawNodes.find(n => n.id === clickedNodeId);
      if (matchingNode) {
        playNetworkBeep(850, 'sine', 0.12); // Higher double-click confirmation chime
        loadNetworkEntity(matchingNode.id, matchingNode.label, matchingNode.kind);
      }
    }
  });
}

// Render side profile metadata directly from click
function displayNodeDetailsFromCanvas(nodeId, rawNodes) {
  const profileEl = document.getElementById('networkNodeProfile');
  if (!profileEl) return;

  const node = rawNodes.find(n => n.id === nodeId);
  if (node) {
    renderProfile(nodeId, rawNodes, node.label, node.kind);
  }
}

// Global helper to open a vendor's network neighborhood directly from other dashboard lists
window.openNetworkEntity = async function(label) {
  if (window.switchView) switchView('view-network');

  const input = document.getElementById('networkSearchInput');
  if (input) input.value = label;

  const resultsDiv = document.getElementById('networkSearchResults');
  const listEl     = document.getElementById('networkSearchResultsList');

  try {
    const res = await fetch(`/api/network/search?q=${encodeURIComponent(label)}`)
      .then(async r => {
        if (!r.ok) throw new Error("Offline Portal Linkage");
        return await r.json();
      })
      .catch(err => {
        console.warn("Direct cross-reference API offline. Resolving local simulation matching...", err);
        return scanLocalSimulationRegistry(label);
      });

    if (res && res.results && res.results.length > 0) {
      // Prioritize exact match, default to first candidate
      const exact = res.results.find(r => r.label.toLowerCase() === label.toLowerCase()) || res.results[0];
      loadNetworkEntity(exact.id, exact.label, exact.kind);

      if (resultsDiv && listEl) {
        listEl.innerHTML = res.results.map(r => {
          let typeLabel = 'Target Buyer';
          if (r.kind === 'company') typeLabel = 'Company (CIN matched)';
          else if (r.kind === 'director') typeLabel = 'Board Director (DIN matched)';

          const detail = r.kind === 'company' ? `${r.state || 'Unknown state'} · ${r.email || 'No email'}` : `${r.state || 'Central/State'}`;
          const activeCls = r.id === exact.id ? 'active' : '';
          return `
            <div class="report-card-item ${activeCls}" style="padding:10px 12px;margin-bottom:6px;border-radius:10px;border:1px solid var(--border);cursor:pointer"
                 onclick="loadNetworkEntity('${r.id}', '${r.label.replace(/'/g, "\\'")}', '${r.kind}')">
              <div class="rc-org" style="font-size:12px;font-weight:700;color:var(--accent)">${r.label}</div>
              <div class="rc-stat" style="font-size:10px;color:var(--text-muted);margin-top:2px">${typeLabel} (${detail})</div>
            </div>`;
        }).join('');
        resultsDiv.style.display = 'block';
      }
    } else {
      playNetworkBeep(240, 'sawtooth', 0.15); // Empty feedback beep
      if (listEl) {
        listEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;line-height:1.4">⚠️ No network matches found for this name. Only companies matched to the MCA/ROC registries appear in this view.</div>';
      }
      if (resultsDiv) resultsDiv.style.display = 'block';
      
      // Hide workspace, show empty state
      document.getElementById('networkGraphWorkspace').style.display = 'none';
      document.getElementById('networkEmptyState').style.display = 'block';
    }
  } catch (e) {
    console.warn("Failed to automatically load network entity connection:", e);
  }
};