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
