/**
 * analysis.js
 * ===========
 * Handles: analysis progress polling, narrative report rendering,
 * data import UI (dump files listing, trigger button).
 */

// ─────────────────────────────────────────────
// ANALYSIS PROGRESS
// ─────────────────────────────────────────────

let _progressPoller = null;

function startProgressPolling() {
  if (_progressPoller) return;
  _progressPoller = setInterval(checkAnalysisProgress, 2000);
  checkAnalysisProgress();
}

function stopProgressPolling() {
  if (_progressPoller) {
    clearInterval(_progressPoller);
    _progressPoller = null;
  }
}

async function checkAnalysisProgress() {
  try {
    const res  = await fetch('/api/analysis-progress');
    const data = await res.json();
    updateProgressUI(data);

    if (data.done) {
      stopProgressPolling();
      if (data.stage !== 'error') {
        // Refresh everything once done
        setTimeout(() => {
          loadKPIs();
          loadNarrativeReport();
          updateHeaderStatus();
          refreshDumpFiles();
        }, 800);
      }
    }
  } catch (e) {
    console.warn('Progress poll failed:', e);
  }
}

function updateProgressUI(data) {
  const section   = document.getElementById('progressSection');
  const stageEl   = document.getElementById('progressStage');
  const pctEl     = document.getElementById('progressPct');
  const barEl     = document.getElementById('progressBarFill');
  const msgEl     = document.getElementById('progressMessage');
  const btnEl     = document.getElementById('btnAnalyse');

  if (!section) return;

  const isRunning = data.stage && data.stage !== 'idle' && data.stage !== 'done' && data.stage !== 'error';
  const isDone    = data.done === true;
  const isError   = data.stage === 'error';

  section.style.display = (isRunning || isDone || isError) ? 'block' : 'none';

  if (stageEl) {
    const stageLabels = {
      starting:     '🚀 Starting…',
      copying:      '📋 Copying data files…',
      validating:   '🔍 Validating database schema…',
      summary:      '⚙️  Building summary database…',
      search_index: '🔎 Building search index…',
      narrative:    '📝 Generating analysis report…',
      done:         '✅ Analysis complete!',
      error:        '❌ Error',
    };
    stageEl.textContent = stageLabels[data.stage] || data.stage;
  }

  if (pctEl) pctEl.textContent = `${data.progress || 0}%`;
  if (barEl) barEl.style.width = `${data.progress || 0}%`;
  if (msgEl) msgEl.textContent = data.message || '';

  if (btnEl) {
    btnEl.disabled = isRunning;
    btnEl.innerHTML = isRunning
      ? '<i data-lucide="loader-circle" style="animation:spin 1s linear infinite"></i> Analysing…'
      : '<i data-lucide="play-circle"></i> Analyse Data';
    lucide.createIcons();
  }

  // Update header status dot
  const dot = document.getElementById('statusDot');
  if (dot) {
    dot.className = 'status-dot ' + (isError ? 'error' : isRunning ? 'running' : isDone ? 'ready' : '');
  }
}

// ─────────────────────────────────────────────
// TRIGGER ANALYSIS
// ─────────────────────────────────────────────

async function triggerAnalysis() {
  const btn = document.getElementById('btnAnalyse');
  if (btn) btn.disabled = true;

  try {
    const res  = await fetch('/api/trigger-analysis', { method: 'POST' });
    const data = await res.json();

    if (res.ok) {
      document.getElementById('progressSection').style.display = 'block';
      startProgressPolling();
    } else {
      alert(data.error || 'Failed to start analysis. Check if a file is in data_dump/.');
      if (btn) btn.disabled = false;
    }
  } catch (e) {
    alert('Could not reach the server. Make sure app.py is running.');
    if (btn) btn.disabled = false;
  }
}

// ─────────────────────────────────────────────
// DUMP FILES LIST
// ─────────────────────────────────────────────

async function refreshDumpFiles() {
  try {
    const res  = await fetch('/api/dump-files');
    const data = await res.json();

    const pathEl = document.getElementById('dumpPathDisplay');
    if (pathEl && data.data_dump_path) {
      pathEl.textContent = data.data_dump_path;
    }

    const listEl = document.getElementById('dumpFilesList');
    if (!listEl) return;

    if (!data.files || data.files.length === 0) {
      listEl.innerHTML = `
        <div class="no-files-box">
          📂 No .db files found in data_dump/ yet.<br>
          Drop your SQLite database file there and click ↻ Refresh.
        </div>`;
      return;
    }

    let html = '';
    for (const f of data.files) {
      const name = f.name.toLowerCase();
      let badge = 'VPS Data';
      if (name.includes('sanction')) {
        badge = 'OpenSanctions';
      } else if (name.includes('aoc') || (!name.includes('vps') && !name.includes('summary'))) {
        badge = 'AOC Data';
      }
      
      html += `
        <div class="file-item">
          <div class="file-item-info">
            <div class="file-icon">🗄️</div>
            <div>
              <div class="file-name">${f.name}</div>
              <div class="file-size">${f.size_mb} MB</div>
            </div>
          </div>
          <span class="file-badge" style="${badge === 'OpenSanctions' ? 'color:var(--danger);border-color:var(--danger)' : ''}">${badge}</span>
        </div>`;
    }
    listEl.innerHTML = html;
  } catch (e) {
    console.warn('refreshDumpFiles failed:', e);
  }
}

// ─────────────────────────────────────────────
// NARRATIVE REPORT RENDERING
// ─────────────────────────────────────────────

async function loadNarrativeReport() {
  try {
    const res = await fetch('/api/narrative-report');
    if (!res.ok) return; // No report yet

    const report = await res.json();
    renderNarrativeReport(report);

    // Show export button
    const expBtn = document.getElementById('exportBtn');
    const expBtnPrint = document.getElementById('exportBtnPrint');
    const expBtnReport = document.getElementById('exportBtnReport');
    if (expBtn) expBtn.style.display = 'flex';
    if (expBtnPrint) expBtnPrint.style.display = 'flex';
    if (expBtnReport) expBtnReport.style.display = 'flex';

    // Show export button
  } catch (e) {
    console.warn('loadNarrativeReport:', e);
  }
}

function renderNarrativeReport(report) {
  const container = document.getElementById('reportContent');
  if (!container) return;

  const summary  = report.executive_summary || {};
  const findings = report.findings || [];

  if (findings.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>Report Generated But No Findings</h3>
        <p>The analysis completed but detected no significant patterns. This may indicate sample or test data.</p>
      </div>`;
    return;
  }

  // Executive Summary
  let html = `
    <div class="exec-summary-card">
      <div class="exec-meta">📊 India Procurement Watch · Generated ${summary.generated_at || 'N/A'}</div>
      <h1 class="report-headline">${summary.headline || 'Analysis Report'}</h1>
      <p class="exec-para">${summary.paragraph_1 || ''}</p>
      <p class="exec-para">${summary.paragraph_2 || ''}</p>
      <p class="exec-para" style="font-size:12px;color:var(--text-muted)">${summary.paragraph_3 || ''}</p>
      <div class="severity-counts">`;

  if (summary.critical_count > 0) {
    html += `<div class="sev-badge critical">🔴 ${summary.critical_count} CRITICAL</div>`;
  }
  if (summary.high_count > 0) {
    html += `<div class="sev-badge high">🟠 ${summary.high_count} HIGH</div>`;
  }
  if (summary.medium_count > 0) {
    html += `<div class="sev-badge medium">🟡 ${summary.medium_count} MEDIUM</div>`;
  }

  html += `</div></div>`;

  // Findings
  html += `<div style="margin-bottom:12px;font-size:13px;color:var(--text-secondary);font-weight:600">
    ${findings.length} Findings — click any to expand
  </div>`;

  findings.forEach((f, idx) => {
    const nsHtml = (f.next_steps || []).map(s => `<li>${s}</li>`).join('');
    html += `
      <div class="finding-card sev-${f.severity}" onclick="toggleFinding(${idx})" id="finding-${idx}">
        <div class="finding-header">
          <span class="finding-badge badge-${f.severity}">${f.severity_emoji} ${f.severity}</span>
          <div class="finding-title">${f.title}</div>
        </div>
        <div class="finding-summary">${f.summary}</div>
        <div class="finding-body">
          <p class="finding-explanation">${f.explanation}</p>
          <div class="finding-box">
            <div class="finding-box-label">💡 What This Could Mean</div>
            <p>${f.what_it_means}</p>
          </div>
          <div class="finding-box">
            <div class="finding-box-label">🔎 Next Steps for Investigation</div>
            <ul>${nsHtml}</ul>
          </div>
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

function toggleFinding(idx) {
  const card = document.getElementById(`finding-${idx}`);
  if (!card) return;
  card.classList.toggle('expanded');
}

// ─────────────────────────────────────────────
// HEADER STATUS
// ─────────────────────────────────────────────

async function updateHeaderStatus() {
  try {
    const res  = await fetch('/api/status');
    const data = await res.json();

    const dot    = document.getElementById('statusDot');
    const status = document.getElementById('headerStatus');

    if (data.summary_db_ready) {
      if (dot) dot.className = 'status-dot ready';
      if (status) status.textContent = 'Analysis data ready';
    } else if (data.aoc_in_dump) {
      if (dot) dot.className = 'status-dot';
      if (status) status.textContent = 'File detected in data_dump/ — click Analyse';
    } else {
      if (dot) dot.className = 'status-dot';
      if (status) status.textContent = 'No data — drop .db file in data_dump/';
    }
  } catch (e) {
    const status = document.getElementById('headerStatus');
    if (status) status.textContent = 'Server offline';
  }
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────

async function initAnalysis() {
  await refreshDumpFiles();
  await updateHeaderStatus();
  await loadNarrativeReport();

  // If analysis is already running, start polling
  try {
    const res  = await fetch('/api/analysis-progress');
    const data = await res.json();
    if (data.stage && data.stage !== 'idle' && data.stage !== 'done' && data.stage !== 'error') {
      startProgressPolling();
    } else if (data.done) {
      updateProgressUI(data);
    }
  } catch (e) {}
}
