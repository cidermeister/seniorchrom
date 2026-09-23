import { analyze } from './ai/manager';

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
      const tabId = sender.tab?.id;
      analyze(message.url, 'url')
          .then((result) => {
              if (result.isSuspicious && tabId) {
                 chrome.storage.local.set({ [`warning_${tabId}`]: { url: message.url, ...result, timestamp: Date.now() } });
              }
              sendResponse(result);
          })
          .catch((err) => {
              sendResponse({ isSuspicious: false, score: 0, reasoning: err.message });
          });
      return true;
  }

  // Handle Content analysis requests (Deep Scan)
  if (message.type === 'ANALYZE_CONTENT') {
      const tabId = sender.tab?.id;
      analyze(message.content, 'content')
          .then((result) => {
              if (result.isSuspicious && tabId) {
                 chrome.storage.local.set({ [`warning_${tabId}`]: { url: message.url, ...result, timestamp: Date.now() } });
              }
              sendResponse(result);
          })
          .catch((err) => {
              sendResponse({ isSuspicious: false, score: 0, reasoning: err.message });
          });
      return true;
  }
});

// Clean up stored warnings when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(`warning_${tabId}`);
});
