/* ═══════════════════════════════════════════
   charts.js — Chart.js chart creation helpers
   India Procurement Watch — Sentinel Investigative Suite
   ═══════════════════════════════════════════ */

// Define premium global defaults matching the cyber-investigative dark design tokens
Chart.defaults.color = '#8b93a8';
Chart.defaults.borderColor = 'rgba(56, 189, 248, 0.05)';
Chart.defaults.font.family = "'Space Grotesk', system-ui, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.plugins.legend.labels.boxWidth = 10;
Chart.defaults.plugins.legend.labels.padding = 12;
Chart.defaults.animation.duration = 800;

// Sentinel tactical color palette matching neon glows
const COLORS = {
  blue:    '#38bdf8', // Neon Sky Blue
  amber:   '#f59e0b', // Warning Amber
  violet:  '#a855f7', // Sourcing Purple
  emerald: '#10b981', // Safe Emerald
  red:     '#ef4444', // Danger Red
  pink:    '#f472b6', // Tactical Pink
  cyan:    '#06b6d4', // Sieve Cyan
  lime:    '#84cc16', // Dynamic Lime
  orange:  '#f97316', // Core Orange
  teal:    '#14b8a6', // Deep Teal
};

const PALETTE = [
  COLORS.blue, COLORS.amber, COLORS.violet, COLORS.emerald,
  COLORS.pink, COLORS.cyan, COLORS.lime, COLORS.orange, COLORS.teal, COLORS.red,
];

// Converts hex code values to premium translucent alpha boundaries
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Global utility helper to ping on visual interactions
function triggerChartSound(freq = 680, duration = 0.05) {
  if (typeof window.playSynthBeep === 'function') {
    window.playSynthBeep(freq, 'sine', duration);
  }
}

// ── TREND LINE CHART ──
function createTrendChart(canvasId, labels, counts, values) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  
  const gradCount = ctx.createLinearGradient(0, 0, 0, 240);
  gradCount.addColorStop(0, hexToRgba(COLORS.blue, 0.15));
  gradCount.addColorStop(1, hexToRgba(COLORS.blue, 0.0));

  const gradValue = ctx.createLinearGradient(0, 0, 0, 240);
  gradValue.addColorStop(0, hexToRgba(COLORS.amber, 0.15));
  gradValue.addColorStop(1, hexToRgba(COLORS.amber, 0.0));

  const datasets = [{
    label: 'Contracts Awarded',
    data: counts,
    borderColor: COLORS.blue,
    backgroundColor: gradCount,
    fill: true,
    tension: 0.35,
    borderWidth: 2,
    pointRadius: labels.length > 50 ? 0 : 3,
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
      tension: 0.35,
      borderWidth: 1.5,
      pointRadius: labels.length > 50 ? 0 : 3,
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
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top', align: 'end' },
        tooltip: {
          backgroundColor: 'rgba(5, 7, 17, 0.95)',
          borderColor: 'rgba(56, 189, 248, 0.15)',
          borderWidth: 1,
          titleFont: { family: "'Space Grotesk', sans-serif", weight: 'bold' },
          bodyFont: { family: "'JetBrains Mono', monospace" },
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed.y;
              if (ctx.dataset.label.includes('Value')) {
                return ` Value: ₹${fmtNum(val)} Cr`;
              }
              return ` Count: ${fmtNum(val)} contracts`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(56, 189, 248, 0.02)' },
          ticks: {
            maxTicksLimit: 12,
            maxRotation: 25,
            font: { size: 9 }
          }
        },
        yCount: {
          type: 'linear', position: 'left',
          grid: { color: 'rgba(56, 189, 248, 0.03)' },
          ticks: { callback: v => fmtNum(v), font: { size: 9 } }
        },
        yValue: {
          type: 'linear', position: 'right',
          display: values && values.some(v => v > 0),
          grid: { display: false },
          ticks: { callback: v => `₹${fmtNum(v)}Cr`, font: { size: 9 } }
        }
      }
    }
  });
}

// ── HORIZONTAL BAR CHART (Top Orgs) ──
function createOrgsChart(canvasId, labels, values, metricLabel) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const barColors = labels.map((_, i) =>
    i < 5 ? COLORS.blue : hexToRgba(COLORS.blue, 0.5 - (i * 0.02))
  );

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.map(l => truncate(l, 25)),
      datasets: [{
        label: metricLabel,
        data: values,
        backgroundColor: barColors,
        borderColor: hexToRgba(COLORS.blue, 0.2),
        borderWidth: 1,
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
          backgroundColor: 'rgba(5, 7, 17, 0.95)',
          borderColor: 'rgba(56, 189, 248, 0.15)',
          borderWidth: 1,
          titleFont: { family: "'Space Grotesk', sans-serif" },
          bodyFont: { family: "'JetBrains Mono', monospace" },
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.x;
              return metricLabel.includes('Crore') ? ` Value: ₹${fmtNum(v)} Cr` : ` Count: ${fmtNum(v)}`;
            },
            title: ctx => ctx[0].label
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(56, 189, 248, 0.02)' },
          ticks: { callback: v => fmtNum(v), font: { size: 9 } }
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 9, weight: 'bold' } }
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
        backgroundColor: PALETTE.map(c => hexToRgba(c, 0.8)),
        borderColor: 'rgba(5, 7, 17, 0.9)',
        borderWidth: 2,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 8, padding: 10, font: { size: 9 } }
        },
        tooltip: {
          backgroundColor: 'rgba(5, 7, 17, 0.95)',
          borderColor: 'rgba(56, 189, 248, 0.15)',
          borderWidth: 1,
          titleFont: { family: "'Space Grotesk', sans-serif" },
          bodyFont: { family: "'JetBrains Mono', monospace" },
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
function createBarChart(canvasId, labels, counts, metric = 'contracts', color = COLORS.violet) {
  const ctx = document.getElementById(canvasId).getContext('2d');

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: hexToRgba(color, 0.6),
        borderColor: hexToRgba(color, 0.9),
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(5, 7, 17, 0.95)',
          borderColor: 'rgba(56, 189, 248, 0.15)',
          borderWidth: 1,
          titleFont: { family: "'Space Grotesk', sans-serif" },
          bodyFont: { family: "'JetBrains Mono', monospace" },
          callbacks: {
            label: ctx => ` ${fmtNum(ctx.parsed.y)} ${metric}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 9 }, maxRotation: 25 }
        },
        y: {
          grid: { color: 'rgba(56, 189, 248, 0.02)' },
          ticks: { callback: v => fmtNum(v), font: { size: 9 } }
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
        borderWidth: 1,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 8, padding: 10, font: { size: 9 } }
        },
        tooltip: {
          backgroundColor: 'rgba(5, 7, 17, 0.95)',
          borderColor: 'rgba(56, 189, 248, 0.15)',
          borderWidth: 1,
          titleFont: { family: "'Space Grotesk', sans-serif" },
          bodyFont: { family: "'JetBrains Mono', monospace" },
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

// ── RADAR CHART (Sector Matrix Overhaul for Pixel-Perfect Symmetry) ──
function createSectorChart(canvasId, labels, values, byValue) {
  const ctx = document.getElementById(canvasId).getContext('2d');

  return new Chart(ctx, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: byValue ? 'Contract Value (₹ Cr)' : 'Contracts Count',
        data: values,
        borderColor: COLORS.violet,
        backgroundColor: hexToRgba(COLORS.violet, 0.15),
        borderWidth: 1.5,
        pointBackgroundColor: COLORS.violet,
        pointBorderColor: '#0a0d24',
        pointHoverBackgroundColor: '#ffffff',
        pointHoverBorderColor: COLORS.violet,
        pointRadius: 3,
        pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(5, 7, 17, 0.95)',
          borderColor: 'rgba(56, 189, 248, 0.15)',
          borderWidth: 1,
          titleFont: { family: "'Space Grotesk', sans-serif" },
          bodyFont: { family: "'JetBrains Mono', monospace" },
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.y;
              return byValue ? ` Value: ₹${fmtNum(v)} Cr` : ` Count: ${fmtNum(v)} contracts`;
            }
          }
        }
      },
      scales: {
        r: {
          grid: { color: 'rgba(56, 189, 248, 0.08)', circular: true },
          angleLines: { color: 'rgba(56, 189, 248, 0.08)' },
          ticks: { display: false, count: 4 },
          pointLabels: {
            color: '#8b93a8',
            font: { family: "'Space Grotesk', sans-serif", size: 9, weight: 'bold' },
            padding: 6
          }
        }
      }
    }
  });
}

// ── UTILITIES ──
function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (n >= 1e7) return (n / 1e7).toFixed(1) + ' Cr';
  if (n >= 1e5) return (n / 1e5).toFixed(1) + ' L';
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
      console.error("Map load failed, using procedural layout tracking", e);
      return null;
    }
  }

  const dataMap = {};
  stateData.forEach(d => {
    const key = d.state_name.toLowerCase().replace(' ut', '');
    dataMap[key] = mode === 'count' ? d.total_contracts : d.total_value_crore;
  });

  const maxVal = Math.max(...Object.values(dataMap)) || 1;

  // Initialize Leaflet context safely
  if (!leafletMapInstance) {
    leafletMapInstance = L.map(containerId, {
      zoomControl: true,
      scrollWheelZoom: false
    }).setView([20.5937, 78.9629], 5);

    // Dark vector tiles matching dark/cyber design profiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB',
      subdomains: 'abcd',
      maxZoom: 10
    }).addTo(leafletMapInstance);
  } else {
    // Clear legacy overlay layers cleanly
    leafletMapInstance.eachLayer(layer => {
      if (layer.options && layer.options.isGeoJSON) {
        leafletMapInstance.removeLayer(layer);
      }
    });
  }

  function getColor(val) {
    if (!val) return 'transparent';
    const intensity = 0.15 + (val / maxVal) * 0.85;
    return mode === 'count' ? `rgba(56, 189, 248, ${intensity})` : `rgba(168, 85, 247, ${intensity})`;
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
        opacity: 0.8,
        color: 'rgba(56, 189, 248, 0.15)',
        fillOpacity: val ? 0.9 : 0.08
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
          triggerChartSound(750, 0.02);
          const l = e.target;
          l.setStyle({ weight: 2, color: '#38bdf8', fillOpacity: 1 });
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

// ── CHART INIT ORCHESTRATOR ──
let _currentTrendGrain   = 'yearly';
let _currentTrendDataset = 'aoc';
let _currentOrgsBy       = 'count';
let _currentMapMode      = 'count';
let _currentSectorBy     = 'count';
let _stateDataCache      = null;

async function initCharts() {
  triggerChartSound(900, 0.08);
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
    chartInstances['orgsChart'] = createOrgsChart(
      'orgsChart', data.labels, data.values,
      by === 'value' ? 'Contract Value (₹ Cr)' : 'Contracts Count'
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
  triggerChartSound(720, 0.04);
  ['btnYearly','btnMonthly','btnPublished'].forEach(id => document.getElementById(id)?.classList.remove('active'));
  if (type === 'yearly')      { document.getElementById('btnYearly')?.classList.add('active');    loadTrend('yearly',  'aoc');       }
  else if (type === 'monthly')    { document.getElementById('btnMonthly')?.classList.add('active');   loadTrend('monthly', 'aoc');       }
  else if (type === 'published')  { document.getElementById('btnPublished')?.classList.add('active'); loadTrend('monthly', 'published'); }
};

window.switchOrgs = function(by) {
  triggerChartSound(720, 0.04);
  document.getElementById('orgByCount')?.classList.toggle('active', by === 'count');
  document.getElementById('orgByValue')?.classList.toggle('active', by === 'value');
  loadTopOrgs(by);
};

window.switchMap = function(mode) {
  triggerChartSound(720, 0.04);
  document.getElementById('btnMapCount')?.classList.toggle('active', mode === 'count');
  document.getElementById('btnMapValue')?.classList.toggle('active', mode === 'value');
  loadIndiaMap(mode);
};

window.switchSector = function(by) {
  triggerChartSound(720, 0.04);
  document.getElementById('sectorByCount')?.classList.toggle('active', by === 'count');
  document.getElementById('sectorByValue')?.classList.toggle('active', by === 'value');
  loadSectorDistribution(by);
};