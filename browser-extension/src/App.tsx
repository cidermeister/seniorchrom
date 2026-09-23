import { useState, useEffect } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Settings, Loader2, Search, ExternalLink } from 'lucide-react';
import { analyze, getSettings, saveSettings } from './ai/manager';
import type { AISettings, AIResponse } from './ai/types';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState<'status' | 'settings'>('status');
  const [loading, setLoading] = useState(false);
  const [settings, setSettingsState] = useState<AISettings>({ provider: 'gemini', warningThreshold: 0.5 });
  const [currentUrl, setCurrentUrl] = useState('');
  const [scanResult, setScanResult] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load initial data
    getSettings().then(setSettingsState);

    // Get current tab URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        setCurrentUrl(tabs[0].url);
        if (tabs[0].id) {
          chrome.runtime.sendMessage({ type: 'CHECK_TAB_WARNING', tabId: tabs[0].id }, (response) => {
             if (response && response.warning) {
               setScanResult(response.warning);
             }
          });
        }
      }
    });
  }, []);

  const handleSaveSettings = async (newSettings: AISettings) => {
    await saveSettings(newSettings);
    setSettingsState(newSettings);
  };

  const scanPageContent = async () => {
    setLoading(true);
    setError(null);
    setScanResult(null);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) throw new Error("No active tab found");

      const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE_CONTENT' }).catch(() => {
         throw new Error("Could not read page content. Refresh the page and try again.");
      });

      if (!response || !response.content) {
        throw new Error("No text content found on page.");
      }

      const result = await analyze(response.content, 'content');
      setScanResult(result);
    } catch (err: any) {
      if (err.message === 'NANO_NOT_AVAILABLE') {
        setError("Gemini Nano is not enabled in this browser. Please check the setup guide on the New Tab page or switch to a Cloud provider.");
      } else {
        setError(err.message || "Failed to scan page.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-96 min-h-[400px] bg-white flex flex-col text-gray-800 font-sans">
      <header className="bg-slate-900 text-white p-4 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-2">
          <Shield className="text-blue-400" size={24} />
          <h1 className="text-lg font-bold">Scam Guard AI</h1>
        </div>
        <button
          onClick={() => setActiveTab(activeTab === 'settings' ? 'status' : 'settings')}
          className="p-1.5 hover:bg-slate-800 rounded-md transition-colors"
        >
          <Settings size={20} className={activeTab === 'settings' ? 'text-blue-400' : 'text-slate-300'} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 bg-slate-50">
        {activeTab === 'settings' ? (
          <SettingsPanel settings={settings} onSave={handleSaveSettings} />
        ) : (
          <StatusPanel
            currentUrl={currentUrl}
            scanResult={scanResult}
            loading={loading}
            error={error}
            onScanClick={scanPageContent}
          />
        )}
      </main>
    </div>
  );
}

// Subcomponents

function StatusPanel({ currentUrl, scanResult, loading, error, onScanClick }: any) {
  const displayUrl = currentUrl ? (() => {
    try {
      const url = new URL(currentUrl);
      return url.hostname;
    } catch (e) {
      return currentUrl.substring(0, 30) + '...';
    }
  })() : 'Loading...';

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Current Site</div>
        <div className="font-medium text-slate-900 truncate" title={currentUrl}>{displayUrl}</div>
      </div>

      <div className="flex-1 flex flex-col gap-4">
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
            {error}
          </div>
        ) : scanResult ? (
          <div className={`p-5 rounded-xl border flex flex-col items-center text-center animate-in fade-in ${
            scanResult.isSuspicious
              ? 'bg-red-50 border-red-200'
              : 'bg-green-50 border-green-200'
          }`}>
            {scanResult.isSuspicious ? (
              <ShieldAlert size={48} className="text-red-500 mb-3" />
            ) : (
              <ShieldCheck size={48} className="text-green-500 mb-3" />
            )}

            <h2 className={`text-xl font-bold mb-1 ${scanResult.isSuspicious ? 'text-red-700' : 'text-green-700'}`}>
              {scanResult.isSuspicious ? 'Suspicious' : 'Looks Safe'}
            </h2>
            <div className={`text-sm font-medium mb-3 ${scanResult.isSuspicious ? 'text-red-600' : 'text-green-600'}`}>
              Risk Score: {Math.round(scanResult.score * 100)}%
            </div>

            <p className="text-sm text-slate-700 text-left bg-white/50 p-3 rounded-lg border border-white/20 w-full shadow-sm">
              {scanResult.reasoning}
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
            <Search size={40} className="mb-3 opacity-50" />
            <p className="text-sm">Page is actively scanned in background.</p>
            <p className="text-sm mt-1">Click below to force a re-scan.</p>
          </div>
        )}
      </div>

      <button
        onClick={onScanClick}
        disabled={loading}
        className="mt-auto w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" size={20} />
            Scanning Content...
          </>
        ) : (
          'Force Deep Scan'
        )}
      </button>
    </div>
  );
}

function SettingsPanel({ settings, onSave }: any) {
  const [provider, setProvider] = useState(settings.provider || 'gemini');
  const [cloudApiKey, setCloudApiKey] = useState(settings.cloudApiKey || '');
  const [cloudApiUrl, setCloudApiUrl] = useState(settings.cloudApiUrl || '');
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey || '');
  const [geminiModel, setGeminiModel] = useState(settings.geminiModel || 'gemini-3.5-flash-lite');
  const [warningThreshold, setWarningThreshold] = useState((settings.warningThreshold || 0.5) * 100);

  const handleSave = () => {
    onSave({ provider, cloudApiKey, cloudApiUrl, geminiApiKey, geminiModel, warningThreshold: warningThreshold / 100 });
  };

  return (
    <div className="flex flex-col gap-5 animate-in slide-in-from-right-4 duration-200">
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Settings</h2>

        <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
          <div>
             <label className="flex items-center justify-between text-sm font-semibold text-slate-700 mb-3">
               <span>Warning Threshold</span>
               <span className="bg-slate-100 px-2 py-1 rounded text-slate-600">{warningThreshold}%</span>
             </label>
             <input
               type="range"
               min="10"
               max="90"
               step="5"
               value={warningThreshold}
               onChange={(e) => setWarningThreshold(Number(e.target.value))}
               className="w-full accent-blue-600"
             />
             <p className="text-xs text-slate-500 mt-2">
               If a site's AI risk score is higher than this percentage, the warning popup will be displayed.
             </p>
          </div>
        </div>

        <div className="space-y-3">

          <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${provider === 'gemini' ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
            <input
              type="radio"
              name="provider"
              value="gemini"
              checked={provider === 'gemini'}
              onChange={() => setProvider('gemini')}
              className="mt-1"
            />
            <div>
              <div className="font-semibold text-slate-900">Google Gemini API</div>
              <div className="text-xs text-slate-500 mt-1">Official cloud API. Fast and reliable. Requires a free API Key.</div>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${provider === 'cloud' ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
            <input
              type="radio"
              name="provider"
              value="cloud"
              checked={provider === 'cloud'}
              onChange={() => setProvider('cloud')}
              className="mt-1"
            />
            <div>
              <div className="font-semibold text-slate-900">Custom Cloud API</div>
              <div className="text-xs text-slate-500 mt-1">For local servers (LMStudio, Ollama) or custom OpenAI-compatible endpoints.</div>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${provider === 'nano' ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
            <input
              type="radio"
              name="provider"
              value="nano"
              checked={provider === 'nano'}
              onChange={() => setProvider('nano')}
              className="mt-1"
            />
            <div>
              <div className="font-semibold text-slate-900">Local AI (Gemini Nano)</div>
              <div className="text-xs text-slate-500 mt-1">100% private. Requires Chrome flag setup.</div>
            </div>
          </label>
        </div>
      </div>

      {provider === 'gemini' && (
        <div className="space-y-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100 shadow-sm animate-in fade-in">
          <div>
             <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-3"
             >
                Get your free API Key from Google AI Studio <ExternalLink size={12} />
             </a>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Gemini API Key</label>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Model Name</label>
            <input
              type="text"
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value)}
              placeholder="gemini-3.5-flash-lite"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[10px] text-slate-500 mt-1">Leave as <code>gemini-3.5-flash-lite</code> for the best free performance.</p>
          </div>
        </div>
      )}

      {provider === 'cloud' && (
        <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-in fade-in">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">API URL Endpoint</label>
            <input
              type="text"
              value={cloudApiUrl}
              onChange={(e) => setCloudApiUrl(e.target.value)}
              placeholder="http://localhost:1234/v1"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">API Key</label>
            <input
              type="password"
              value={cloudApiKey}
              onChange={(e) => setCloudApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        className="mt-4 w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-4 rounded-xl transition-all shadow-sm"
      >
        Save Settings
      </button>
    </div>
  );
}

export default App;
