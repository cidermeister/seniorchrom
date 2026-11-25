import { analyze } from './ai/manager';

function handleBackgroundAnalysis(
  type: 'url' | 'content',
  content: string,
  url: string,
  tabId: number | undefined,
  sendResponse: (response: unknown) => void
) {
  chrome.storage.local.get(['whitelist'], (storageResult) => {
    const whitelist: string[] = Array.isArray(storageResult.whitelist) ? storageResult.whitelist : [];
    let isWhitelisted = false;
    try {
      const urlObj = new URL(url);
      isWhitelisted = whitelist.includes(urlObj.hostname);
    } catch (e) {
      console.error("Error parsing URL", e);
    }

    if (isWhitelisted) {
      sendResponse({
        isSuspicious: false,
        score: 0,
        reasoning: 'This domain is on your whitelist.'
      });
      return;
    }

    analyze(content, type, {
      url,
      bypassCache: false,
      requireReasoning: false
    })
      .then((result) => {
        if (result.isSuspicious && tabId) {
          chrome.storage.local.set({ [`warning_${tabId}`]: { url, ...result, timestamp: Date.now() } });
        }
        sendResponse(result);
      })
      .catch((err) => {
        sendResponse({ isSuspicious: false, score: 0, reasoning: err.message });
      });
  });
}

// Listen for messages from the content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_TAB_WARNING') {
    const tabId = sender.tab?.id || message.tabId;
    if (tabId) {
      chrome.storage.local.get([`warning_${tabId}`], (result) => {
        sendResponse({ warning: result[`warning_${tabId}`] || null });
      });
      return true;
    }
  }

  if (message.type === 'STORE_TAB_WARNING') {
      const tabId = sender.tab?.id;
      if (tabId && message.warning) {
          chrome.storage.local.set({ [`warning_${tabId}`]: message.warning });
          sendResponse({ success: true });
      }
  }

  if (message.type === 'CLEAR_TAB_WARNING') {
    const tabId = sender.tab?.id || message.tabId;
    if (tabId) {
      chrome.storage.local.remove(`warning_${tabId}`);
      sendResponse({ success: true });
    }
  }

  // Handle URL intent analysis requests
  if (message.type === 'ANALYZE_URL') {
      handleBackgroundAnalysis('url', message.url, message.url, sender.tab?.id, sendResponse);
      return true;
  }

  // Handle Content analysis requests (Deep Scan)
  if (message.type === 'ANALYZE_CONTENT') {
      handleBackgroundAnalysis('content', message.content, message.url, sender.tab?.id, sendResponse);
      return true;
  }

  if (message.type === 'REPORT_FALSE_POSITIVE') {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const apiKey = import.meta.env.VITE_API_KEY || 'my_secret_key';

      fetch(`${backendUrl}/api/report-false-positive`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(message.data)
      })
      .then(res => res.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));

      return true;
  }
});

// Clean up stored warnings when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(`warning_${tabId}`);
});

// Open setup page on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('setup.html') });
  }
});
