import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ShieldCheck, Trash2 } from 'lucide-react';
import './index.css';

const WhitelistApp = () => {
  const [whitelist, setWhitelist] = useState<string[]>([]);

  useEffect(() => {
    chrome.storage.local.get(['whitelist'], (result) => {
      setWhitelist(Array.isArray(result.whitelist) ? result.whitelist : []);
    });
  }, []);

  const removeDomain = (domain: string) => {
    const updatedWhitelist = whitelist.filter(d => d !== domain);
    chrome.storage.local.set({ whitelist: updatedWhitelist }, () => {
      setWhitelist(updatedWhitelist);
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center shadow-sm">
        <ShieldCheck className="text-black mr-3" size={28} />
        <h1 className="text-xl font-bold text-gray-900">James - Whitelist Management</h1>
      </header>

      <main className="flex-grow container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6 flex justify-between items-end">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Whitelisted Domains</h2>
                <p className="text-gray-600">
                    Domains listed below will be excluded from automatic and deep scans.
                </p>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {whitelist.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Your whitelist is currently empty.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {whitelist.map((domain) => (
                <li key={domain} className="p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                  <div className="flex items-center">
                    <span className="text-gray-900 font-medium">{domain}</span>
                  </div>
                  <button
                    onClick={() => removeDomain(domain)}
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove from whitelist"
                  >
                    <Trash2 size={20} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<WhitelistApp />);
