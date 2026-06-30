/* ═══════════════════════════════════════════
   chat.js — AI Database Assistant Client
   India Procurement Watch
   ═══════════════════════════════════════════ */

window.sendAiQuery = function() {
  const inputEl = document.getElementById('aiChatInput');
  const query = (inputEl.value || '').trim();
  if (!query) return;

  // Hide empty state and show history
  const emptyState = document.getElementById('aiEmptyState');
  const pills = document.getElementById('aiPills');
  if (emptyState) emptyState.style.display = 'none';
  if (pills) pills.style.display = 'none';
  
  const chatHistory = document.getElementById('aiChatHistory');
  chatHistory.style.display = 'flex';

  const btn = document.getElementById('btnAiSend');

  // Add User Message
  const userMsg = document.createElement('div');
  userMsg.style.cssText = 'display: flex; gap: 16px; margin-bottom: 24px; padding: 0; flex-direction: row-reverse; text-align: right; margin-left: 20%;';
  userMsg.innerHTML = `
    <div style="width: 24px; height: 24px; border-radius: 4px; background: #3f3f3f; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
      <i data-lucide="user" style="color: #a1a1aa; width: 14px; height: 14px;"></i>
    </div>
    <div style="flex: 1; line-height: 1.6; color: #e8eaf0; font-size: 15px; font-weight: 500;"></div>
  `;
  userMsg.lastElementChild.textContent = query; // safe text insertion
  userMsg.classList.add('chat-msg-animated');
  chatHistory.appendChild(userMsg);
  
  // Add Thinking Bubble
  const thinkingMsg = document.createElement('div');
  thinkingMsg.id = 'aiThinkingBubble';
  thinkingMsg.style.cssText = 'display: flex; gap: 16px; margin-bottom: 32px; padding: 0; margin-right: 15%; opacity: 0.7;';
  thinkingMsg.innerHTML = `
    <div style="width: 24px; height: 24px; border-radius: 4px; background: rgba(217, 119, 87, 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; border: 1px dashed rgba(217, 119, 87, 0.4);">
      <i data-lucide="loader" style="color: var(--accent); width: 14px; height: 14px;"></i>
    </div>
    <div style="flex: 1; line-height: 1.6; color: var(--text-muted); font-size: 14px; font-style: italic;">Darshi is analyzing data...</div>
  `;
  thinkingMsg.classList.add('chat-msg-animated');
  chatHistory.appendChild(thinkingMsg);
  if (window.lucide) window.lucide.createIcons();
  
  // Clear input, show loading
  inputEl.value = '';
  inputEl.disabled = true;
  btn.textContent = '...';
  btn.disabled = true;

  // Auto-scroll to bottom
  chatHistory.scrollTop = chatHistory.scrollHeight;

  const modelSelect = document.getElementById('aiModelSelect');
  const selectedModel = modelSelect ? modelSelect.value : 'gemini-3.5-flash';


  // Send to backend via streaming fetch
  fetch('/api/ai-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: query, model: selectedModel })
  })
  .then(async res => {
    if (!res.ok) throw new Error("Network response was not ok");
    
    // Create the message wrapper immediately
    const wrapper = document.createElement('div');
    wrapper.classList.add('chat-msg-animated');
    wrapper.style.cssText = 'display: flex; gap: 16px; margin-bottom: 32px; padding: 0; margin-right: 15%;';
    
    const avatar = document.createElement('div');
    avatar.style.cssText = 'width: 24px; height: 24px; border-radius: 4px; background: rgba(217, 119, 87, 0.15); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; border: 1px solid rgba(217, 119, 87, 0.3);';
    avatar.innerHTML = '<i data-lucide="fingerprint" style="color: var(--accent); width: 14px; height: 14px;"></i>';
    
    const aiMsg = document.createElement('div');
    aiMsg.style.cssText = 'flex: 1; line-height: 1.6; color: #d4d4d8; font-size: 15px; word-break: break-word;';
    
    wrapper.appendChild(avatar);
    wrapper.appendChild(aiMsg);
    
    const tBubble = document.getElementById('aiThinkingBubble');
    if (tBubble) tBubble.remove();
    
    chatHistory.appendChild(wrapper);
    if (window.lucide) window.lucide.createIcons();
    
    // Stream Reader setup
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let done = false;
    
    // UI elements to dynamically populate
    let thoughtContainer = null;
    let thoughtTextNode = null;
    let summaryContainer = null;
    let dataContainer = null;
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        const chunkStr = decoder.decode(value, { stream: true });
        const lines = chunkStr.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              if (data.type === 'thought_start') {
                thoughtContainer = document.createElement('div');
                thoughtContainer.style.cssText = 'margin-bottom: 16px; background: rgba(0,0,0,0.3); border-radius: 8px; border-left: 3px solid var(--accent); padding: 12px 16px; overflow: hidden;';
                thoughtContainer.innerHTML = `
                  <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--accent); display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                    <i data-lucide="brain-circuit" style="width: 12px; height: 12px;"></i> Reasoning Process
                  </div>
                  <div class="thought-text" style="font-size: 13px; color: var(--text-secondary); white-space: pre-wrap; line-height: 1.6; font-family: 'JetBrains Mono', 'Fira Code', monospace;"></div>
                `;
                aiMsg.appendChild(thoughtContainer);
                thoughtTextNode = thoughtContainer.querySelector('.thought-text');
                if (window.lucide) window.lucide.createIcons();
                chatHistory.scrollTop = chatHistory.scrollHeight;
              } 
              else if (data.type === 'thought_chunk') {
                if (thoughtTextNode) {
                  thoughtTextNode.textContent += data.content;
                  chatHistory.scrollTop = chatHistory.scrollHeight;
                }
              }
              else if (data.type === 'status') {
                 let statusEl = document.createElement('div');
                 statusEl.style.cssText = 'font-size: 12px; color: var(--text-muted); font-style: italic; margin-bottom: 16px;';
                 statusEl.textContent = data.content;
                 aiMsg.appendChild(statusEl);
                 chatHistory.scrollTop = chatHistory.scrollHeight;
              }
              else if (data.type === 'summary_start') {
                summaryContainer = document.createElement('div');
                summaryContainer.style.cssText = 'margin-bottom: 16px; font-size: 14px; line-height: 1.6;';
                aiMsg.insertBefore(summaryContainer, dataContainer); // Insert before data table if it exists
                chatHistory.scrollTop = chatHistory.scrollHeight;
              }
              else if (data.type === 'summary_chunk') {
                if (summaryContainer) {
                  summaryContainer.textContent += data.content;
                  chatHistory.scrollTop = chatHistory.scrollHeight;
                }
              }
                            else if (data.type === 'kpi_box') {
                let kpiContainer = document.createElement('div');
                kpiContainer.style.cssText = 'margin-bottom: 16px; padding: 20px; background: rgba(0,0,0,0.4); border: 1px solid var(--accent); border-radius: 8px; text-align: center;';
                kpiContainer.innerHTML = `<div style="font-size: 14px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">${data.kpi.label}</div><div style="font-size: 32px; font-weight: bold; color: var(--accent);">${data.kpi.value}</div>`;
                aiMsg.appendChild(kpiContainer);
                chatHistory.scrollTop = chatHistory.scrollHeight;
                if (dataContainer) dataContainer.style.display = 'none';
              }
              else if (data.type === 'chart_data') {
                let chartWrapper = document.createElement('div');
                chartWrapper.style.cssText = 'margin-bottom: 16px; padding: 16px; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid var(--border);';
                let canvas = document.createElement('canvas');
                canvas.id = 'chat-chart-' + Math.random().toString(36).substr(2, 9);
                chartWrapper.appendChild(canvas);
                aiMsg.appendChild(chartWrapper);
                chatHistory.scrollTop = chatHistory.scrollHeight;
                if (dataContainer) dataContainer.style.display = 'none';
                
                try {
                  new Chart(canvas, {
                    type: data.chart.chart_type || 'bar',
                    data: {
                      labels: data.chart.labels || [],
                      datasets: [{
                        label: data.chart.dataset_label || '',
                        data: data.chart.data || [],
                        backgroundColor: ['rgba(217, 119, 87, 0.7)', 'rgba(56, 189, 248, 0.7)', 'rgba(167, 139, 250, 0.7)', 'rgba(251, 191, 36, 0.7)', 'rgba(52, 211, 153, 0.7)'],
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1
                      }]
                    },
                    options: {
                      responsive: true,
                      plugins: { legend: { display: data.chart.chart_type === 'pie' } },
                      scales: data.chart.chart_type !== 'pie' ? { y: { beginAtZero: true, grid: {color: 'rgba(255,255,255,0.05)'} }, x: { grid: {color: 'rgba(255,255,255,0.05)'} } } : {}
                    }
                  });
                } catch(e) { console.error("Chart render error", e); }
              }
              else if (data.type === 'data') {
                dataContainer = document.createElement('div');
                let html = '';
                if (data.query) {
                  html += `<div style="margin-bottom:10px; font-size: 12px;"><strong style="color:var(--accent)">SQL Generated:</strong> <code style="background:rgba(0,0,0,0.2);padding:2px 6px;border-radius:4px;">${data.query}</code></div>`;
                  if (data.data && data.data.length > 0) {
                    html += `<table class="data-table" style="width:100%;margin-top:10px;"><thead><tr>`;
                    data.columns.forEach(col => {
                      html += `<th>${col}</th>`;
                    });
                    html += `</tr></thead><tbody>`;
                    
                    data.data.forEach(row => {
                      html += `<tr>`;
                      data.columns.forEach(col => {
                        html += `<td>${row[col] !== null ? row[col] : '-'}</td>`;
                      });
                      html += `</tr>`;
                    });
                    html += `</tbody></table>`;
                    if (data.data.length === 20) {
                        html += `<div style="font-size:11px;color:var(--text-muted);margin-top:8px;">Showing top 20 rows.</div>`;
                    }
                  } else {
                    html += `<em>No results found for that query.</em>`;
                  }
                }
                dataContainer.innerHTML = html;
                aiMsg.appendChild(dataContainer);
                chatHistory.scrollTop = chatHistory.scrollHeight;
              }
              else if (data.type === 'error') {
                 let errEl = document.createElement('div');
                 errEl.style.cssText = 'color: var(--danger); font-size: 14px; line-height: 1.6;';
                 errEl.innerHTML = `<strong>Oops!</strong> ${data.content}`;
                 if (data.query) {
                     errEl.innerHTML += `<div style="margin-top:10px; font-size: 12px;"><strong style="color:var(--danger)">SQL Generated:</strong> <code style="background:rgba(0,0,0,0.2);padding:2px 6px;border-radius:4px;color:var(--danger);">${data.query}</code></div>`;
                 }
                 aiMsg.appendChild(errEl);
                 chatHistory.scrollTop = chatHistory.scrollHeight;
              }
            } catch (e) {
              console.error("Error parsing JSON chunk:", e, line);
            }
          }
        }
      }
    }
  })
  .catch(err => {
    console.error(err);
    const wrapper = document.createElement('div');
    wrapper.classList.add('chat-msg-animated');
    wrapper.style.cssText = 'display: flex; gap: 16px; margin-bottom: 32px; padding: 0; margin-right: 15%;';
    
    const avatar = document.createElement('div');
    avatar.style.cssText = 'width: 24px; height: 24px; border-radius: 4px; background: rgba(239, 68, 68, 0.15); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; border: 1px solid rgba(239, 68, 68, 0.3);';
    avatar.innerHTML = '<i data-lucide="alert-triangle" style="color: var(--danger); width: 14px; height: 14px;"></i>';

    const errMsg = document.createElement('div');
    errMsg.style.cssText = 'flex: 1; line-height: 1.6; color: var(--danger); font-size: 15px; overflow-x: auto;';
    errMsg.innerHTML = "<strong>Connection Error:</strong> I'm sorry, I encountered a network error while trying to connect to the brain.";
    
    const tBubble = document.getElementById('aiThinkingBubble');
    if (tBubble) tBubble.remove();

    wrapper.appendChild(avatar);
    wrapper.appendChild(errMsg);
    chatHistory.appendChild(wrapper);
    
    if (window.lucide) {
      window.lucide.createIcons();
    }
  })
  .finally(() => {
    inputEl.disabled = false;
    btn.innerHTML = 'Execute <i data-lucide="arrow-right" style="width: 14px; height: 14px; margin-left: 6px;"></i>';
    btn.disabled = false;
    if (window.lucide) {
      window.lucide.createIcons();
    }
    inputEl.focus();
  });
};
