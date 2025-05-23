class UserScriptManager {
  constructor() {
    this.scripts = [];
    this.injectedTabs = new Map();
    this.setupOperaListeners();
    this.initialize();
  }

  async initialize() {
    await this.loadScripts();
    console.log('Initial scripts loaded:', this.scripts);
  }

  setupOperaListeners() {
    chrome.tabs.onRemoved.addListener(tabId => {
      this.injectedTabs.delete(tabId);
      chrome.action.setBadgeText({ tabId, text: '' });
    });

    chrome.webNavigation.onBeforeNavigate.addListener(details => {
      if (details.frameId === 0) {
        this.injectedTabs.delete(details.tabId);
        chrome.action.setBadgeText({ tabId: details.tabId, text: '' });
      }
    });

    chrome.tabs.onUpdated.addListener(this.onTabUpdated.bind(this));

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep the message channel open for async responses
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'saveScript':
          await this.saveScript(request.script);
          sendResponse({ success: true });
          break;
        case 'getScripts':
          await this.loadScripts();
          sendResponse(this.scripts);
          break;
        case 'toggleScript':
          await this.toggleScript(request.scriptId, request.enabled);
          sendResponse({ success: true });
          break;
        case 'deleteScript':
          await this.deleteScript(request.scriptId);
          sendResponse({ success: true });
          break;
        case 'updateScript':
          await this.updateScript(request.scriptId, request.code);
          sendResponse({ success: true });
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
    }
  }

  async injectScriptsForTab(tabId, url) {
    if (!url || url.startsWith('chrome://') || this.injectedTabs.has(tabId)) return;
    await this.loadScripts();
    this.injectedTabs.set(tabId, true);

    const validScripts = this.scripts.filter(script =>
      script.enabled && this.matchesUrl(url, script.matches)
    );

    chrome.action.setBadgeText({
      tabId,
      text: validScripts.length > 0 ? `${validScripts.length}` : ''
    });

    await Promise.allSettled(
      validScripts.map(script => this.injectScript(tabId, script))
    );
  }

  async onTabUpdated(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete') {
      await this.injectScriptsForTab(tabId, tab.url);
    }
  }

  async onNavigationCompleted(details) {
    if (details.frameId === 0) {
      await this.injectScriptsForTab(details.tabId, details.url);
    }
  }

  async loadScripts() {
    try {
      const result = await chrome.storage.local.get(['userScripts']);
      this.scripts = result.userScripts || [];
    } catch (error) {
      console.error('Failed to load scripts:', error);
      this.scripts = [];
    }
  }

  async saveScript(script) {
    await this.loadScripts();
    const parsed = this.parseUserScript(script.code);
    const newScript = {
      ...parsed,
      id: crypto.randomUUID(),
      enabled: true,
      lastUpdated: Date.now(),
      source: script.code // Store the full source (with metadata block)
    };
    this.scripts = [...this.scripts, newScript];
    try {
      await chrome.storage.local.set({ userScripts: this.scripts });
      chrome.runtime.sendMessage({ action: 'scriptsUpdated', scripts: this.scripts }).catch(() => {});
    } catch (e) {
      console.error('Failed to save scripts:', e);
      throw e;
    }
  }

  async toggleScript(scriptId, enabled) {
    await this.loadScripts();
    this.scripts = this.scripts.map(script =>
      script.id === scriptId ? { ...script, enabled } : script
    );
    await chrome.storage.local.set({ userScripts: this.scripts });
    chrome.tabs.query({}, tabs => {
      tabs.forEach(tab => {
        if (tab.url) this.injectScriptsForTab(tab.id, tab.url);
      });
    });
    chrome.runtime.sendMessage({ action: 'scriptsUpdated', scripts: this.scripts }).catch(() => {});
  }

  async deleteScript(scriptId) {
    await this.loadScripts();
    this.scripts = this.scripts.filter(script => script.id !== scriptId);
    await chrome.storage.local.set({ userScripts: this.scripts });
    chrome.runtime.sendMessage({ action: 'scriptsUpdated', scripts: this.scripts }).catch(() => {});
  }

  async updateScript(scriptId, code) {
    await this.loadScripts();
    this.scripts = this.scripts.map(script =>
      script.id === scriptId
        ? { ...this.parseUserScript(code), id: script.id, enabled: script.enabled, lastUpdated: Date.now(), source: code }
        : script
    );
    await chrome.storage.local.set({ userScripts: this.scripts });
    chrome.runtime.sendMessage({ action: 'scriptsUpdated', scripts: this.scripts }).catch(() => {});
  }

  parseUserScript(code) {
    const meta = {};
    const metaBlock = code.match(/\/\/ ==UserScript==([\s\S]+?)\/\/ ==\/UserScript==/);

    if (metaBlock) {
      metaBlock[1].split('\n').forEach(line => {
        const match = line.match(/\/\/ @(\S+)\s+(.+)/);
        if (match) {
          const key = match[1].toLowerCase();
          const value = match[2].trim();

          if (meta[key]) {
            if (!Array.isArray(meta[key])) {
              meta[key] = [meta[key]];
            }
            meta[key].push(value);
          } else {
            meta[key] = value;
          }
        }
      });
    }

    if (!meta.name) {
      meta.name = "Unnamed Script";
    }

    return {
      ...meta,
      code: metaBlock ? code.replace(metaBlock[0], '') : code,
      matches: [].concat(meta.match || []).map(pattern =>
        pattern.replace(/\./g, '\\.').replace(/\*/g, '.*')
      )
    };
  }

  async injectScript(tabId, script) {
    try {
      const injectionCheck = await chrome.scripting.executeScript({
        target: { tabId },
        func: (scriptId) => window[`opera_${scriptId}_injected`],
        args: [script.id || script.name],
        world: 'MAIN'
      });

      if (injectionCheck[0]?.result) return;

      await chrome.scripting.executeScript({
        target: { tabId },
        func: (code, scriptId) => {
          const injectionFlag = `opera_${scriptId}_injected`;
          window[injectionFlag] = true;
          const el = document.createElement('script');
          el.textContent = code;
          document.documentElement.appendChild(el);
        },
        args: [script.code, script.id || script.name],
        world: 'MAIN'
      });
    } catch (err) {
      console.error(`Opera injection error:`, err);
    }
  }

  matchesUrl(url, patterns) {
    if (!patterns || patterns.length === 0) return false;
    return patterns.some(pattern => {
      try {
        const regex = new RegExp(`^${pattern}$`, 'i');
        return regex.test(url);
      } catch {
        return false;
      }
    });
  }
}

const scriptManager = new UserScriptManager();
