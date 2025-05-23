// Theme management
chrome.storage.local.get(['theme'], ({ theme }) => {
  const isDark = theme === 'dark';
  document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.getElementById('theme-toggle').checked = isDark;
});

document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('save-script');
  const themeToggle = document.getElementById('theme-toggle');
  const clearConsoleBtn = document.getElementById('clear-console');
  const devToolsBtn = document.getElementById('dev-tools-btn');
  let editor = null;

  // Initialize CodeMirror editor
  if (typeof CodeMirror !== 'undefined') {
    editor = CodeMirror.fromTextArea(document.getElementById('script-code'), {
      mode: 'javascript',
      lineNumbers: true,
      theme: document.body.getAttribute('data-theme') === 'dark' ? 'dracula' : 'ayu-light',
      indentUnit: 4,
      extraKeys: {
        "Ctrl-S": saveCurrentScript,
        "Cmd-S": saveCurrentScript
      },
      viewportMargin: Infinity,
      lineWrapping: true
    });
    window.editor = editor;
    const editorElement = document.querySelector('.CodeMirror');
    editorElement.style.height = '200px';
    editorElement.style.resize = 'none';
    editorElement.style.overflow = 'auto';
  }

  // Load scripts immediately
  loadScripts();

  // Save script handler
  saveBtn.addEventListener('click', saveCurrentScript);

  // Dark mode toggle
  themeToggle?.addEventListener('change', function() {
    const isDark = this.checked;
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
    chrome.storage.local.set({ theme: isDark ? 'dark' : 'light' });
    editor?.setOption('theme', isDark ? 'dracula' : 'ayu-light');
  });

  // Clear console
  clearConsoleBtn?.addEventListener('click', () => {
    document.getElementById('console-output').innerHTML = '';
  });

  // Developer Tools button opens Discord
  devToolsBtn?.addEventListener('click', () => {
    window.open('https://dsc.gg/143x', '_blank');
  });

  // Initial console message
  showConsoleMessage('AlterPage v1.0 initialized', 'info');
  showConsoleMessage('Ready to execute scripts', 'info');
});

// --------- Script Metadata Parsing ---------
function getScriptName(scriptContent) {
  const nameMatch = scriptContent.match(/\/\/ @name\s+(.+)/);
  return nameMatch ? nameMatch[1].trim() : 'Unnamed Script';
}
function getScriptMatches(scriptContent) {
  const matchLines = scriptContent.match(/\/\/ @match\s+.+/g) || [];
  return matchLines.map(line => line.replace(/\/\/ @match\s+/, '').trim());
}

// Converts @match patterns to regex and checks if a URL matches
function urlMatchesPatterns(url, patterns) {
  try {
    return patterns.some(pattern => {
      let regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
        .replace(/^\/\//, 'https?://');
      if (regexPattern.startsWith('*://')) regexPattern = 'https?://' + regexPattern.slice(4);
      const regex = new RegExp('^' + regexPattern + '$');
      return regex.test(url);
    });
  } catch (e) {
    console.error('Error matching URL:', e);
    return false;
  }
}

// --------- Save & Execute Script ---------
async function saveCurrentScript() {
  const scriptContent = window.editor?.getValue() || document.getElementById('script-code').value;
  if (!scriptContent.trim()) {
    showToast('Script cannot be empty!', 'error');
    showConsoleMessage('Script cannot be empty!', 'error');
    return;
  }

  try {
    const scriptName = getScriptName(scriptContent);
    const matches = getScriptMatches(scriptContent);

    // Save the script
    await chrome.runtime.sendMessage({
      action: 'saveScript',
      script: {
        code: scriptContent,
        name: scriptName,
        matches: matches,
        enabled: true
      }
    });

    // Get current tab and check if URL matches
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (tab.url && urlMatchesPatterns(tab.url, matches)) {
      try {
        await executeScript(scriptContent, tab.id);
        showToast(`${scriptName} saved & executed!`, 'success');
        showConsoleMessage(`[${scriptName}] Executed successfully`, 'success');
      } catch (execError) {
        showToast(`Saved but execution failed`, 'error');
        showConsoleMessage(`[${scriptName}] Execution failed: ${execError.message}`, 'error');
      }
    } else {
      showToast(`${scriptName} saved (not executed - URL doesn't match)`, 'info');
      showConsoleMessage(`[${scriptName}] Not executed: URL doesn't match`, 'info');
    }

    // Reset editor
    if (window.editor) {
      window.editor.setValue(`// ==UserScript==
// @name        New Script
// @namespace   http://your-namespace.com
// @version     1.0
// @description Script description
// @match       *://*.example.com/*
// ==/UserScript==

(function() {
    'use strict';

    // Your code here

})();`);
    }
    await loadScripts();
  } catch (error) {
    showToast('Failed to save script!', 'error');
    showConsoleMessage(`Failed to save script: ${error.message}`, 'error');
  }
}

// --------- Inject Script ---------
async function executeScript(scriptContent, tabId) {
  try {
    await chrome.scripting.executeScript({
      target: {tabId: tabId},
      func: (code) => {
        try {
          const origLog = console.log;
          console.log = function(...args) {
            window.postMessage({type: 'ALTERPAGE_CONSOLE', logType: 'log', args}, '*');
            origLog.apply(console, args);
          };
          const origErr = console.error;
          console.error = function(...args) {
            window.postMessage({type: 'ALTERPAGE_CONSOLE', logType: 'error', args}, '*');
            origErr.apply(console, args);
          };
          const origWarn = console.warn;
          console.warn = function(...args) {
            window.postMessage({type: 'ALTERPAGE_CONSOLE', logType: 'warn', args}, '*');
            origWarn.apply(console, args);
          };
          eval(code);
        } catch (e) {
          window.postMessage({type: 'ALTERPAGE_CONSOLE', logType: 'error', args: [e.message]}, '*');
        }
      },
      args: [scriptContent],
      world: 'MAIN'
    });
    return true;
  } catch (error) {
    console.error('Error executing script:', error);
    throw error;
  }
}

// --------- Listen for Console Messages from Content ---------
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ALTERPAGE_CONSOLE') {
    showConsoleMessage(event.data.args.join(' '), event.data.logType || 'info');
  }
});

// --------- Load & Render Scripts ---------
async function loadScripts() {
  try {
    const scripts = await chrome.runtime.sendMessage({ action: 'getScripts' });
    renderScriptsList(scripts || []);
  } catch (error) {
    renderScriptsList([]);
  }
}

function renderScriptsList(scripts) {
  const container = document.getElementById('saved-scripts');
  container.innerHTML = scripts.length ? '' : `
    <div class="empty-state">
      <p>No scripts found. Create one above!</p>
    </div>
  `;
  scripts.forEach(script => {
    const card = document.createElement('div');
    card.className = 'script-card';
    card.innerHTML = `
      <div class="script-header">
        <label>
          <input type="checkbox" ${script.enabled ? 'checked' : ''} data-id="${script.id}">
          <span>${script.name || 'Unnamed Script'}</span>
        </label>
        <div class="script-actions">
          <button class="edit-btn btn btn-icon" title="Edit Script" data-id="${script.id}">
            <i class="fas fa-pen"></i>
          </button>
          <button class="delete-btn btn btn-icon" title="Delete Script" data-id="${script.id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="script-matches">
        ${(script.matches || []).map(m => `<span class="match-pill">${m}</span>`).join(' ')}
      </div>
    `;

    // Toggle handler
    card.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
      chrome.runtime.sendMessage({
        action: 'toggleScript',
        scriptId: script.id,
        enabled: e.target.checked
      });
    });

    // Edit handler
    card.querySelector('.edit-btn').addEventListener('click', () => {
      openEditModal(script);
    });

    // Delete handler
    card.querySelector('.delete-btn').addEventListener('click', () => {
      if (confirm('Delete this script permanently?')) {
        chrome.runtime.sendMessage({
          action: 'deleteScript',
          scriptId: script.id
        });
        card.remove();
        if (container.children.length === 0) renderScriptsList([]);
      }
    });

    container.appendChild(card);
  });
}

// --------- Edit Modal Logic ---------
function openEditModal(script) {
  const modal = document.getElementById('edit-modal');
  const closeBtn = document.getElementById('close-modal');
  const saveBtn = document.getElementById('save-edit-btn');
  const codeArea = document.getElementById('edit-script-code');
  codeArea.value = script.source || script.code || '';

  modal.style.display = 'flex';

  closeBtn.onclick = () => { modal.style.display = 'none'; };
  window.onclick = (event) => { if (event.target === modal) modal.style.display = 'none'; };

  saveBtn.onclick = async () => {
    const newCode = codeArea.value;
    await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'updateScript',
        scriptId: script.id,
        code: newCode
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
    modal.style.display = 'none';
    loadScripts();
    showToast('Script updated!', 'success');
    showConsoleMessage('Script updated!', 'success');
  };
}

// --------- Toast ---------
function showToast(message, type = 'info') {
  const toast = document.getElementById('status-toast');
  if (!toast) return;
  const icon = toast.querySelector('.toast-icon');
  const messageEl = toast.querySelector('.toast-message');
  let iconClass = 'fas fa-info-circle';
  if (type === 'success') iconClass = 'fas fa-check-circle';
  if (type === 'error') iconClass = 'fas fa-exclamation-circle';
  if (type === 'warning') iconClass = 'fas fa-exclamation-triangle';
  icon.className = `toast-icon ${iconClass}`;
  messageEl.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// --------- Console Output in Popup ---------
function showConsoleMessage(message, type = 'info') {
  const consoleOutput = document.getElementById('console-output');
  if (!consoleOutput) return;
  const messageElement = document.createElement('div');
  messageElement.className = `console-message ${type}`;
  const now = new Date();
  const timestamp = now.toLocaleTimeString();
  messageElement.textContent = `[${timestamp}] ${message}`;
  consoleOutput.appendChild(messageElement);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// Listen for background updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'scriptsUpdated') {
    loadScripts();
  }
});
