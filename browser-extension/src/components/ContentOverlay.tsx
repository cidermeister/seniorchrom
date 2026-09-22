import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { AIResponse } from '../ai/types';
// We import Tailwind styles directly for the shadow DOM
import styles from '../index.css?inline';

interface WarningData extends AIResponse {
  url: string;
}

const ContentOverlay: React.FC = () => {
  const [warning, setWarning] = useState<WarningData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Listen for events dispatched from the content script
    const handleWarningEvent = (e: Event) => {
        const customEvent = e as CustomEvent<WarningData>;
        if (customEvent.detail) {
            setWarning(customEvent.detail);
        }
    };

    window.addEventListener('scam-guard-warning', handleWarningEvent);

    return () => {
        window.removeEventListener('scam-guard-warning', handleWarningEvent);
    };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    chrome.runtime.sendMessage({ type: 'CLEAR_TAB_WARNING' });
  };

  if (!warning || dismissed) {
    return <style>{styles}</style>; // Still inject styles so it's ready
  }

  return (
    <>
      <style>{styles}</style>
      <div className="fixed inset-0 flex items-center justify-center bg-black/60 pointer-events-auto backdrop-blur-sm" style={{ zIndex: 2147483647 }}>
        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden border-2 border-red-500 animate-in fade-in zoom-in duration-300">
          <div className="bg-red-50 p-6 flex flex-col items-center text-center relative">
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>

            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
              <AlertTriangle size={32} />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">Suspicious Site Detected</h2>
            <p className="text-red-600 font-medium mb-4 text-lg">
              Risk Score: {Math.round(warning.score * 100)}%
            </p>
          </div>

          <div className="p-6 bg-white">
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">AI Analysis</h3>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-100 shadow-inner">
                {warning.reasoning}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => window.history.back()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex justify-center items-center"
              >
                Go Back to Safety
              </button>
              <button
                onClick={handleDismiss}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors flex justify-center items-center"
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ContentOverlay;
