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

  // Send to backend
  fetch('/api/ai-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: query, model: selectedModel })
  })
  .then(res => res.json())
  .then(data => {
    const wrapper = document.createElement('div');
    wrapper.classList.add('chat-msg-animated');
    wrapper.style.cssText = 'display: flex; gap: 16px; margin-bottom: 32px; padding: 0; margin-right: 15%;';
    
    const avatar = document.createElement('div');
    avatar.style.cssText = 'width: 24px; height: 24px; border-radius: 4px; background: rgba(217, 119, 87, 0.15); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; border: 1px solid rgba(217, 119, 87, 0.3);';
    avatar.innerHTML = '<i data-lucide="fingerprint" style="color: var(--accent); width: 14px; height: 14px;"></i>';
    
    const aiMsg = document.createElement('div');
    aiMsg.style.cssText = 'flex: 1; line-height: 1.6; color: #d4d4d8; font-size: 15px; word-break: break-word;';

    if (data.error) {
      aiMsg.innerHTML = `<span style="color:var(--danger)"><strong>Oops!</strong> ${data.error}</span>`;
      if (data.query) {
        aiMsg.innerHTML += `
          <details style="margin-top: 12px; background: rgba(239, 68, 68, 0.05); border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.2);">
            <summary style="padding: 8px 12px; font-size: 12px; font-weight: 500; cursor: pointer; color: var(--danger); display: flex; align-items: center; gap: 8px;">
              <i data-lucide="code" style="width: 14px; height: 14px;"></i> View Attempted Output
            </summary>
            <div style="padding: 12px; font-size: 12px; border-top: 1px solid rgba(239, 68, 68, 0.2); overflow-x: auto; background: rgba(0,0,0,0.2);">
              <code style="white-space: pre-wrap; color: var(--text-muted); font-family: monospace; line-height: 1.5;">${data.query.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>
            </div>
          </details>
        `;
      }
    } else if (data.success) {
      // Build the results
      let html = '';
      
      if (data.thought_process) {
        html += `
          <details style="margin-bottom: 12px; background: rgba(0,0,0,0.2); border-radius: 6px; border: 1px solid var(--border);">
            <summary style="padding: 8px 12px; font-size: 12px; font-weight: 500; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
              <i data-lucide="brain-circuit" style="width: 14px; height: 14px;"></i> View Darshi's Thought Process
            </summary>
            <div style="padding: 12px; font-size: 12px; color: var(--text-muted); border-top: 1px solid var(--border); white-space: pre-wrap; line-height: 1.5;">${data.thought_process.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          </details>
        `;
      }
      
      if (data.summary) {
        html += `<div style="margin-bottom: 16px; font-size: 14px; line-height: 1.6;">${data.summary}</div>`;
      }

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
      
      aiMsg.innerHTML = html;
    }

    const tBubble = document.getElementById('aiThinkingBubble');
    if (tBubble) tBubble.remove();

    wrapper.appendChild(avatar);
    wrapper.appendChild(aiMsg);
    chatHistory.appendChild(wrapper);
    
    if (window.lucide) {
      window.lucide.createIcons();
    }
    chatHistory.scrollTop = chatHistory.scrollHeight;
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
