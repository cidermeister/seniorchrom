import { createRoot } from 'react-dom/client';
import React from 'react';
import ContentOverlay from './components/ContentOverlay';

// Helper to extract clean text from body
const extractPageText = () => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    const scriptsAndStyles = clone.querySelectorAll('script, style, noscript, nav, footer, header');
    scriptsAndStyles.forEach(el => el.remove());
    return clone.innerText.replace(/\s+/g, ' ').trim();
};

// 1. Listen for manual page content extraction requests from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_PAGE_CONTENT') {
    sendResponse({ content: extractPageText() });
  } else if (message.type === 'SHOW_WARNING') {
      const event = new CustomEvent('scam-guard-warning', { detail: message.warning });
      window.dispatchEvent(event);
      sendResponse({ success: true });
  }
});

// 2. Initialize Injected UI for Warnings inside a Shadow DOM to isolate styles
const initOverlay = async () => {
  if (document.getElementById('scam-guard-ai-host')) return;

  const host = document.createElement('div');
  host.id = 'scam-guard-ai-host';
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.left = '0';
  host.style.width = '100%';
  host.style.height = '100%';
  host.style.zIndex = '2147483647';
  host.style.pointerEvents = 'none';

  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });

  const container = document.createElement('div');
  container.id = 'scam-guard-ai-root';
  container.style.width = '100%';
  container.style.height = '100%';

  shadowRoot.appendChild(container);

  const root = createRoot(container);
  root.render(React.createElement(ContentOverlay));

  // 3. Automated Scanning
  try {
      const url = window.location.href;
      if (!url.startsWith('chrome')) {

          // Phase 1: Scan URL Intent Immediately
          chrome.runtime.sendMessage({ type: 'ANALYZE_URL', url }, (response) => {
              if (response && response.isSuspicious) {
                  const warningData = { url, ...response, timestamp: Date.now() };
                  window.dispatchEvent(new CustomEvent('scam-guard-warning', { detail: warningData }));
              }
          });

          // Phase 2: Wait 1.5 seconds for React/SPA pages to render, then auto-scan content
          setTimeout(() => {
              const textContent = extractPageText();
              if (textContent.length > 50) {
                  chrome.runtime.sendMessage({ type: 'ANALYZE_CONTENT', url, content: textContent }, (response) => {
                      if (response && response.isSuspicious) {
                          const warningData = { url, ...response, timestamp: Date.now() };
                          window.dispatchEvent(new CustomEvent('scam-guard-warning', { detail: warningData }));
                      }
                  });
              }
          }, 1500);
      }
  } catch (err) {
      console.error("James auto-scan error:", err);
  }
};

if (!window.location.protocol.startsWith('chrome')) {
  if (document.body) {
    initOverlay();
  } else {
    document.addEventListener('DOMContentLoaded', initOverlay);
  }
}
