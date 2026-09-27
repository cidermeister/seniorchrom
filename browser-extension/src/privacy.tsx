import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { ShieldCheck } from 'lucide-react'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-8 flex justify-center">
      <div className="max-w-3xl w-full bg-white p-10 rounded-2xl shadow-sm border border-slate-200">

        <header className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-100">
          <img src="/james.png" alt="James Logo" className="w-12 h-12" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
            <p className="text-slate-500 mt-1">James - Your Online Protection Agent</p>
          </div>
        </header>

        <main className="space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <ShieldCheck className="text-blue-500" size={20} />
              1. Introduction
            </h2>
            <p>
              James ("we", "our", or "the Extension") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and handle your data when you use our browser extension to detect scams and protect your browsing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Information We Process</h2>
            <p className="mb-2">To provide real-time scam detection, the Extension processes the following information:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Website URLs:</strong> The addresses of the websites you visit.</li>
              <li><strong>Page Content:</strong> The text content of the websites you visit, which is extracted for deep scanning.</li>
              <li><strong>Settings & Preferences:</strong> Your selected AI provider, warning thresholds, auto-scan preferences, and provided API keys.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. How Your Information is Used</h2>
            <p>
              The URLs and page content we process are used strictly for the purpose of analyzing the website's risk level, detecting potential scams, predatory resellers, or phishing attempts. We do not use this data for tracking, advertising, or profiling.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Data Sharing and Third-Party Services</h2>
            <p className="mb-2">The handling of your data depends heavily on the AI Provider settings you configure within the Extension:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Local Processing (Gemini Nano):</strong> If supported and configured, your data is processed entirely locally on your device and is never transmitted to the cloud.
              </li>
              <li>
                <strong>Cloud Providers (Google Gemini API / Custom API):</strong> If you configure the Extension to use a cloud API, the extracted URLs and page content are sent directly from your browser to the respective API (e.g., Google's servers for Gemini) for analysis. We do not intercept, proxy, or store this data on our own servers. Please review the privacy policy of your chosen API provider.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Data Storage and Security</h2>
            <p>
              All user settings, including API keys and cached scan results, are stored securely in your browser's local storage (<code>chrome.storage.local</code>). We do not maintain any remote databases of your user data. Your API keys are only transmitted directly to the configured AI provider to authenticate your scan requests.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">6. User Controls</h2>
            <p className="mb-2">You have full control over your data:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>You can toggle "Background Scanning" off at any time in the settings to prevent automatic URL and content analysis.</li>
              <li>You can clear your API keys and settings by removing them from the extension's configuration or uninstalling the extension, which will instantly delete all locally stored data.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">7. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices or technical updates. We will notify you of any significant changes by updating the "Last Updated" date at the top of this policy.
            </p>
          </section>
        </main>

        <footer className="mt-12 pt-6 border-t border-slate-100 text-sm text-slate-400 text-center">
          &copy; {new Date().getFullYear()} James Extension. All rights reserved.
        </footer>
      </div>
    </div>
  </React.StrictMode>,
)
