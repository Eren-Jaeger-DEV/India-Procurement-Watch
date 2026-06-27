/* ═══════════════════════════════════════════
   charts.js — Chart.js chart creation helpers
   ═══════════════════════════════════════════ */

// ── CHART.JS GLOBAL DEFAULTS ──
Chart.defaults.color          = '#8b93a8';
Chart.defaults.borderColor    = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family    = 'Inter, system-ui, sans-serif';
Chart.defaults.font.size      = 12;
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.legend.labels.padding  = 16;
Chart.defaults.animation.duration             = 700;

// Color palette
const COLORS = {
  blue:    '#4f8ef7',
  amber:   '#f5b942',
  violet:  '#8b5cf6',
  emerald: '#34d399',
  red:     '#f87171',
  pink:    '#f472b6',
  cyan:    '#22d3ee',
  lime:    '#a3e635',
  orange:  '#fb923c',
  teal:    '#2dd4bf',
};

const PALETTE = [
  COLORS.blue, COLORS.amber, COLORS.violet, COLORS.emerald,
  COLORS.pink, COLORS.cyan, COLORS.lime, COLORS.orange, COLORS.teal, COLORS.red,
];

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── TREND LINE CHART ──
function createTrendChart(canvasId, labels, counts, values) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const gradCount = ctx.createLinearGradient(0, 0, 0, 300);
  gradCount.addColorStop(0, hexToRgba(COLORS.blue, 0.35));
  gradCount.addColorStop(1, hexToRgba(COLORS.blue, 0.0));

  const gradValue = ctx.createLinearGradient(0, 0, 0, 300);
  gradValue.addColorStop(0, hexToRgba(COLORS.amber, 0.35));
  gradValue.addColorStop(1, hexToRgba(COLORS.amber, 0.0));

  const datasets = [{
    label: 'Contracts Awarded',
    data: counts,
    borderColor: COLORS.blue,
    backgroundColor: gradCount,
    fill: true,
    tension: 0.4,
    borderWidth: 2.5,
    pointRadius: labels.length > 60 ? 0 : 3,
    pointHoverRadius: 5,
    pointBackgroundColor: COLORS.blue,
    yAxisID: 'yCount',
  }];

  if (values && values.length > 0 && values.some(v => v > 0)) {
    datasets.push({
      label: 'Contract Value (₹ Cr)',
      data: values,
      borderColor: COLORS.amber,
      backgroundColor: gradValue,
      fill: true,
      tension: 0.4,
      borderWidth: 2,
      pointRadius: labels.length > 60 ? 0 : 3,
      pointHoverRadius: 5,
      pointBackgroundColor: COLORS.amber,
      yAxisID: 'yValue',
    });
  }

  return new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top', align: 'end' },
        tooltip: {
          backgroundColor: 'rgba(14,18,32,0.95)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed.y;
              if (ctx.dataset.label.includes('Value')) {
                return ` ₹${fmtNum(val)} Cr`;
              }
              return ` ${fmtNum(val)} contracts`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            maxTicksLimit: 18,
            maxRotation: 35,
          }
        },
        yCount: {
          type: 'linear', position: 'left',
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { callback: v => fmtNum(v) }
        },
        yValue: {
          type: 'linear', position: 'right',
          display: values && values.some(v => v > 0),
          grid: { display: false },
          ticks: { callback: v => `₹${fmtNum(v)}Cr` }
        }
      }
    }
  });
}

// ── HORIZONTAL BAR CHART (Top Orgs) ──
function createOrgsChart(canvasId, labels, values, metricLabel) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const barColors = labels.map((_, i) =>
    i < 5 ? COLORS.blue : hexToRgba(COLORS.blue, 0.5 + (5 - i) * 0.02)
  );

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.map(l => truncate(l, 30)),
      datasets: [{
        label: metricLabel,
        data: values,
        backgroundColor: barColors,
        borderColor: hexToRgba(COLORS.blue, 0.4),
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(14,18,32,0.95)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.x;
              return metricLabel.includes('Crore') ? ` ₹${fmtNum(v)} Cr` : ` ${fmtNum(v)}`;
            },
            title: ctx => ctx[0].label
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { callback: v => fmtNum(v) }
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 11 } }
        }
      }
    }
  });
}

// ── DONUT CHART (Tender Types) ──
function createDonutChart(canvasId, labels, counts) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const total = counts.reduce((a, b) => a + b, 0);

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: PALETTE.map(c => hexToRgba(c, 0.85)),
        borderColor: PALETTE.map(c => hexToRgba(c, 0.4)),
        borderWidth: 1.5,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 10, padding: 12, font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: 'rgba(14,18,32,0.95)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: ctx => {
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` ${fmtNum(ctx.parsed)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// ── VERTICAL BAR CHART (Value Brackets / Portal) ──
function createBarChart(canvasId, labels, counts, color = COLORS.violet) {
  const ctx = document.getElementById(canvasId).getContext('2d');

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: hexToRgba(color, 0.7),
        borderColor: hexToRgba(color, 0.9),
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(14,18,32,0.95)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: ctx => ` ${fmtNum(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 }, maxRotation: 30 }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { callback: v => fmtNum(v) }
        }
      }
    }
  });
}

// ── PIE CHART (Portal Breakdown) ──
function createPieChart(canvasId, labels, counts) {
  const ctx = document.getElementById(canvasId).getContext('2d');

  const PORTAL_COLORS = {
    central: COLORS.blue,
    state:   COLORS.violet,
    org:     COLORS.emerald,
  };

  const bgColors = labels.map(l => hexToRgba(PORTAL_COLORS[l] || COLORS.cyan, 0.8));
  const brColors = labels.map(l => hexToRgba(PORTAL_COLORS[l] || COLORS.cyan, 0.4));

  const total = counts.reduce((a, b) => a + b, 0);

  return new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
      datasets: [{
        data: counts,
        backgroundColor: bgColors,
        borderColor: brColors,
        borderWidth: 1.5,
        hoverOffset: 5,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 10, padding: 14 }
        },
        tooltip: {
          backgroundColor: 'rgba(14,18,32,0.95)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: ctx => {
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return ` ${fmtNum(ctx.parsed)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// ── UTILITIES ──
function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (n >= 1e9)  return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K';
  return n.toLocaleString('en-IN');
}

function fmtCrore(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L Cr`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K Cr`;
  return `₹${n.toFixed(0)} Cr`;
}

function truncate(str, max) {
  return str && str.length > max ? str.slice(0, max) + '…' : (str || '');
}

// ── INDIA MAP (Leaflet) ──
let indiaTopoJson = null;
let leafletMapInstance = null;

async function createIndiaMap(containerId, stateData, mode = 'count') {
  if (!indiaTopoJson) {
    try {
      const res = await fetch('/india-states.json?v=' + Date.now());
      indiaTopoJson = await res.json();
    } catch(e) {
      console.error("Map load failed", e);
      return null;
    }
  }

  const dataMap = {};
  stateData.forEach(d => {
    const key = d.state_name.toLowerCase().replace(' ut', '');
    dataMap[key] = mode === 'count' ? d.total_contracts : d.total_value_crore;
  });

  const maxVal = Math.max(...Object.values(dataMap)) || 1;

  // Initialize map if not already done
  if (!leafletMapInstance) {
    leafletMapInstance = L.map(containerId, {
      zoomControl: true,
      scrollWheelZoom: false // Keep scrolling smooth on the page
    }).setView([22.5937, 78.9629], 4);

    // Dark theme map tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB',
      subdomains: 'abcd',
      maxZoom: 10
    }).addTo(leafletMapInstance);
  } else {
    // Clear previous geojson layers
    leafletMapInstance.eachLayer(layer => {
      if (layer.options && layer.options.isGeoJSON) {
        leafletMapInstance.removeLayer(layer);
      }
    });
  }

  function getColor(val) {
    if (!val) return 'transparent';
    const intensity = 0.2 + (val / maxVal) * 0.8;
    return mode === 'count' ? `rgba(99, 102, 241, ${intensity})` : `rgba(52, 211, 153, ${intensity})`;
  }

  const geoJsonLayer = L.geoJSON(indiaTopoJson, {
    isGeoJSON: true,
    style: function (feature) {
      const name = feature.properties.ST_NM || feature.properties.name || "Unknown";
      let val = dataMap[name.toLowerCase()] || 0;
      if (val === 0) {
        for (const [dk, dv] of Object.entries(dataMap)) {
          if (dk.includes(name.toLowerCase()) || name.toLowerCase().includes(dk)) { val = dv; break; }
        }
      }
      return {
        fillColor: getColor(val),
        weight: 1,
        opacity: 1,
        color: 'rgba(255,255,255,0.2)',
        fillOpacity: val ? 0.9 : 0.1
      };
    },
    onEachFeature: function (feature, layer) {
      const name = feature.properties.ST_NM || feature.properties.name || "Unknown";
      let val = dataMap[name.toLowerCase()] || 0;
      if (val === 0) {
        for (const [dk, dv] of Object.entries(dataMap)) {
          if (dk.includes(name.toLowerCase()) || name.toLowerCase().includes(dk)) { val = dv; break; }
        }
      }
      
      const label = mode === 'count' 
        ? `${fmtNum(val)} contracts` 
        : `₹${fmtNum(Math.round(val))} Cr`;
        
      layer.bindTooltip(`<strong>${name}</strong><br/>${label}`, {
        className: 'leaflet-custom-tooltip',
        direction: 'top'
      });
      
      layer.on({
        mouseover: function(e) {
          const l = e.target;
          l.setStyle({ weight: 2, color: '#fff', fillOpacity: 1 });
          if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            l.bringToFront();
          }
        },
        mouseout: function(e) {
          geoJsonLayer.resetStyle(e.target);
        }
      });
    }
  }).addTo(leafletMapInstance);

  if (geoJsonLayer.getBounds().isValid()) {
    leafletMapInstance.fitBounds(geoJsonLayer.getBounds());
  }

  return leafletMapInstance;
}

// ── HORIZONTAL BAR CHART (Sector Distribution) ──
function createSectorChart(canvasId, labels, values, byValue) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const bgColors = labels.map((_, i) => hexToRgba(PALETTE[i % PALETTE.length], 0.75));
  const brColors = labels.map((_, i) => hexToRgba(PALETTE[i % PALETTE.length], 0.4));

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: byValue ? 'Contract Value (₹ Cr)' : 'Contracts Count',
        data: values,
        backgroundColor: bgColors,
        borderColor: brColors,
        borderWidth: 1.5,
        borderRadius: 4,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(14,18,32,0.95)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.x;
              return byValue ? ` ₹${fmtNum(v)} Cr` : ` ${fmtNum(v)} contracts`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { callback: v => fmtNum(v) }
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 9, weight: 'bold' } }
        }
      }
    }
  });
}

// ── CHART INIT ORCHESTRATOR ──
let _currentTrendGrain   = 'yearly';
let _currentTrendDataset = 'aoc';
let _currentOrgsBy       = 'count';
let _currentMapMode      = 'count';
let _currentSectorBy     = 'count';
let _stateDataCache      = null;

async function initCharts() {
  await loadTrend('yearly', 'aoc');
  await loadTopOrgs('count');
  await loadSectorDistribution('count');

  try {
    const res  = await fetch('/api/tender-types');
    const data = await res.json();
    if (chartInstances['typeChart']) chartInstances['typeChart'].destroy();
    chartInstances['typeChart'] = createDonutChart('typeChart', data.labels, data.counts);
  } catch (e) { console.warn('tender-types:', e); }

  try {
    const res  = await fetch('/api/value-distribution');
    const data = await res.json();
    if (chartInstances['valueBracketChart']) chartInstances['valueBracketChart'].destroy();
    chartInstances['valueBracketChart'] = createBarChart('valueBracketChart', data.labels, data.counts, 'contracts', COLORS.violet);
  } catch (e) { console.warn('value-dist:', e); }

  try {
    const res  = await fetch('/api/portal-breakdown');
    const data = await res.json();
    if (chartInstances['portalChart']) chartInstances['portalChart'].destroy();
    chartInstances['portalChart'] = createPieChart('portalChart', data.labels, data.counts);
  } catch (e) { console.warn('portal-breakdown:', e); }

  try {
    const res  = await fetch('/api/top-orgs?dataset=published&limit=10');
    const data = await res.json();
    if (chartInstances['pubOrgsChart']) chartInstances['pubOrgsChart'].destroy();
    chartInstances['pubOrgsChart'] = createBarChart('pubOrgsChart', data.labels, data.values, 'tenders', COLORS.emerald);
  } catch (e) { console.warn('pub-orgs:', e); }

  await loadIndiaMap('count');
}

async function loadSectorDistribution(by) {
  _currentSectorBy = by;
  try {
    const res  = await fetch('/api/sector-distribution');
    const data = await res.json();
    
    // Combine for sorting
    const items = data.labels.map((l, idx) => ({
      label: l,
      count: data.counts[idx],
      value: data.values[idx]
    }));
    
    if (by === 'value') {
      items.sort((a, b) => b.value - a.value);
    } else {
      items.sort((a, b) => b.count - a.count);
    }
    
    const labels = items.map(x => x.label);
    const values = items.map(x => by === 'value' ? x.value : x.count);

    if (chartInstances['sectorChart']) chartInstances['sectorChart'].destroy();
    chartInstances['sectorChart'] = createSectorChart('sectorChart', labels, values, by === 'value');
  } catch (e) { console.warn('sector-distribution:', e); }
}

async function loadTrend(grain, dataset) {
  _currentTrendGrain   = grain;
  _currentTrendDataset = dataset;
  try {
    const res  = await fetch(`/api/trends?grain=${grain}&dataset=${dataset}`);
    const data = await res.json();
    if (chartInstances['trendChart']) chartInstances['trendChart'].destroy();
    chartInstances['trendChart'] = createTrendChart('trendChart', data.labels, data.counts, data.values || []);
  } catch (e) { console.warn('trends:', e); }
}

async function loadTopOrgs(by) {
  _currentOrgsBy = by;
  try {
    const res  = await fetch(`/api/top-orgs?by=${by}&limit=15`);
    const data = await res.json();
    if (chartInstances['orgsChart']) chartInstances['orgsChart'].destroy();
    chartInstances['orgsChart'] = createBarChart(
      'orgsChart', data.labels, data.values,
      data.metric || 'contracts',
      by === 'value' ? COLORS.amber : COLORS.blue
    );
  } catch (e) { console.warn('top-orgs:', e); }
}

async function loadIndiaMap(mode) {
  _currentMapMode = mode;
  try {
    if (!_stateDataCache) {
      const res = await fetch('/api/state-stats');
      _stateDataCache = await res.json();
    }
    if (chartInstances['indiaMapChart']) chartInstances['indiaMapChart'].destroy();
    chartInstances['indiaMapChart'] = await createIndiaMap('indiaMapChart', _stateDataCache, mode);
  } catch (e) { console.warn('india-map:', e); }
}

window.switchTrend = function(type) {
  ['btnYearly','btnMonthly','btnPublished'].forEach(id => document.getElementById(id)?.classList.remove('active'));
  if (type === 'yearly')      { document.getElementById('btnYearly')?.classList.add('active');    loadTrend('yearly',  'aoc');       }
  else if (type === 'monthly')    { document.getElementById('btnMonthly')?.classList.add('active');   loadTrend('monthly', 'aoc');       }
  else if (type === 'published')  { document.getElementById('btnPublished')?.classList.add('active'); loadTrend('monthly', 'published'); }
};

window.switchOrgs = function(by) {
  document.getElementById('orgByCount')?.classList.toggle('active', by === 'count');
  document.getElementById('orgByValue')?.classList.toggle('active', by === 'value');
  loadTopOrgs(by);
};

window.switchMap = function(mode) {
  document.getElementById('btnMapCount')?.classList.toggle('active', mode === 'count');
  document.getElementById('btnMapValue')?.classList.toggle('active', mode === 'value');
  loadIndiaMap(mode);
};

window.switchSector = function(by) {
  document.getElementById('sectorByCount')?.classList.toggle('active', by === 'count');
  document.getElementById('sectorByValue')?.classList.toggle('active', by === 'value');
  loadSectorDistribution(by);
};
