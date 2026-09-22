// Background script (Service Worker)

// Listen for messages from the content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_TAB_WARNING') {
    const tabId = sender.tab?.id || message.tabId;
    if (tabId) {
      chrome.storage.local.get([`warning_${tabId}`], (result) => {
        sendResponse({ warning: result[`warning_${tabId}`] || null });
      });
      return true; // Keep message channel open for async response
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
});

// Clean up stored warnings when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(`warning_${tabId}`);
});
