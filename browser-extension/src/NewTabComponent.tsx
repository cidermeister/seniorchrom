import { useState, useEffect } from 'react';
import { Search, Shield, Info, CheckCircle2, XCircle } from 'lucide-react';
import { isNanoAvailable } from './ai/nano';

const NewTabComponent = () => {
  const [url, setUrl] = useState('');
  const [nanoAvailable, setNanoAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if window.ai is available
    isNanoAvailable().then((v) => { console.log('Nano available:', v); setNanoAvailable(v); }).catch(() => setNanoAvailable(false));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    // Basic formatting to ensure it's a valid url or search
    let target = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      if (url.includes('.') && !url.includes(' ')) {
        target = 'https://' + url;
      } else {
        target = 'https://www.google.com/search?q=' + encodeURIComponent(url);
      }
    }

    window.location.href = target;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans p-4">
      {/* Setup Guide / Status Banner */}
      {nanoAvailable === false && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-full max-w-2xl">
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl shadow-sm flex items-start gap-3">
            <Info className="text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-800">Local AI Setup Required</h3>
              <p className="text-sm text-yellow-700 mt-1">
                To use the 100% private local AI, you need to enable it in Chrome.
                Go to <code className="bg-yellow-100 px-1.5 py-0.5 rounded text-xs select-all">chrome://flags/#prompt-api-for-gemini-nano</code>,
                set it to <strong>Enabled</strong>, and restart your browser.
              </p>
            </div>
          </div>
        </div>
      )}

      {nanoAvailable === true && (
        <div className="absolute top-8 right-8">
           <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm">
             <CheckCircle2 size={16} />
             Nano AI Active
           </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-col items-center max-w-3xl w-full">
        <div className="flex items-center gap-3 mb-8 text-slate-800">
          <div className="p-3 bg-blue-100 rounded-2xl text-blue-600">
            <Shield size={48} />
          </div>
          <h1 className="text-5xl font-bold tracking-tight">Scam Guard</h1>
        </div>

        <p className="text-slate-500 mb-8 text-lg">Your local AI-powered browser guardian.</p>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="w-full max-w-2xl relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
            <Search size={24} />
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Search the web or type a URL to scan..."
            className="w-full py-4 pl-12 pr-6 text-lg bg-white border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 shadow-sm transition-all"
            autoFocus
          />
        </form>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 w-full max-w-4xl">
          <FeatureCard
            title="Privacy First"
            desc="Scans happen directly on your device using Gemini Nano. No data leaves your browser."
            icon={<Shield className="text-emerald-500" />}
          />
          <FeatureCard
            title="Smart Intent"
            desc="Analyzes URL intent in the background before the page even finishes loading."
            icon={<Search className="text-blue-500" />}
          />
          <FeatureCard
            title="Content Deep-Scan"
            desc="Checks page text for scams, phishing, or overcharging (like EHIC fees)."
            icon={<XCircle className="text-red-500" />}
          />
        </div>
      </div>
    </div>
  );
};

const FeatureCard = ({ title, desc, icon }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
    <div className="mb-4 p-2 bg-slate-50 rounded-xl">{icon}</div>
    <h3 className="font-semibold text-slate-800 mb-2">{title}</h3>
    <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
  </div>
);

export default NewTabComponent;
