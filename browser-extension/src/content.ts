import './index.css';
import { createRoot } from 'react-dom/client';
import React from 'react';
import ContentOverlay from './components/ContentOverlay';
import { analyze } from './ai/manager';

// 1. Listen for page content extraction requests from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_PAGE_CONTENT') {
    const clone = document.body.cloneNode(true) as HTMLElement;
    const scriptsAndStyles = clone.querySelectorAll('script, style, noscript');
    scriptsAndStyles.forEach(el => el.remove());

    const text = clone.innerText.replace(/\s+/g, ' ').trim();

    sendResponse({ content: text });
  } else if (message.type === 'SHOW_WARNING') {
      // Background or self triggered a warning show request
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
  // Position the host outside normal flow but covering everything
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.left = '0';
  host.style.width = '100%';
  host.style.height = '100%';
  host.style.zIndex = '2147483647';
  host.style.pointerEvents = 'none'; // click through unless overlay is active

  document.body.appendChild(host);

  // Attach shadow DOM
  const shadowRoot = host.attachShadow({ mode: 'open' });

  // Create a container inside shadow DOM
  const container = document.createElement('div');
  container.id = 'scam-guard-ai-root';
  container.style.width = '100%';
  container.style.height = '100%';

  // Inject the bundled CSS into the shadow DOM
  const styleLink = document.createElement('style');
  // We need to fetch the injected CSS or just use the global styles.
  // Vite injects css via link tags or style tags in head. For a real extension,
  // we'd configure Vite to output a specific CSS file we can fetch and inject here.
  // For this exercise, we'll try to fetch the extension's CSS file.
  try {
      // A common Vite CRX pattern is importing the CSS as a raw string if possible, or letting CRX plugin handle it.
      // The @crxjs/vite-plugin usually handles CSS injection automatically, but to a Shadow DOM it's harder.
      // We'll leave the style empty for a moment and fix it below.
  } catch(e) {}

  shadowRoot.appendChild(styleLink);
  shadowRoot.appendChild(container);

  const root = createRoot(container);
  root.render(React.createElement(ContentOverlay));

  // 3. Perform URL scanning from the content script to avoid Service Worker window.ai issues
  try {
      const url = window.location.href;
      if (!url.startsWith('chrome')) {
          const result = await analyze(url, 'url');
          if (result.isSuspicious) {
              // Trigger the warning
              const warningData = { url, ...result, timestamp: Date.now() };

              // Tell background to store it so popup sees it
              chrome.runtime.sendMessage({ type: 'STORE_TAB_WARNING', warning: warningData });

              // Tell ourselves to show it
              const event = new CustomEvent('scam-guard-warning', { detail: warningData });
              window.dispatchEvent(event);
          }
      }
  } catch (err) {
      console.error("Scam Guard auto-scan error:", err);
  }
};

if (!window.location.protocol.startsWith('chrome')) {
  if (document.body) {
    initOverlay();
  } else {
    document.addEventListener('DOMContentLoaded', initOverlay);
  }
}
