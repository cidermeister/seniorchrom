import React from 'react';

const SetupComponent: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-black flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-2xl w-full space-y-8">
        <div className="flex flex-col items-center">
          <img
            src="/james.png"
            alt="James Logo"
            className="w-32 h-32 mb-6 object-contain drop-shadow-md"
          />
          <h1 className="text-4xl font-extrabold text-center tracking-tight text-black mb-2">
            Welcome!
          </h1>
          <p className="text-xl text-center text-gray-700">
            I'm James, your AI butler for safe browsing.
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-200 shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-2xl font-bold text-black mb-4 border-b-2 border-black inline-block pb-1">
              How it Works
            </h2>
            <p className="text-gray-800 text-lg leading-relaxed mb-6">
              James automatically scans web pages in the background as you browse. If it detects a scam, phishing attempt, or suspicious activity, it will immediately display a warning overlay to protect you.
            </p>

            <h2 className="text-2xl font-bold text-black mb-4 mt-8 border-b-2 border-black inline-block pb-1">
              Configuration & Settings
            </h2>
            <p className="text-gray-800 text-lg leading-relaxed mb-4">
              To customize James or adjust the warning threshold, simply click the <strong>James extension icon</strong> in your browser toolbar.
            </p>

            <div className="bg-white border-l-4 border-black p-4 mt-4">
              <h3 className="text-xl font-semibold text-black mb-2">API Key Required</h3>
              <p className="text-gray-700 mb-3">
                To power James's intelligence, you need to provide an AI API key.
              </p>
              <ul className="list-disc pl-5 text-gray-700 space-y-2">
                <li>
                  <strong>Google Gemini:</strong> You can get a free API key from Google AI Studio. Enter this key in the extension settings.
                </li>
                <li>
                  <strong>Custom API:</strong> Alternatively, you can use an AI model of your choice by providing a custom API endpoint in the settings.
                </li>
              </ul>
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500 italic">
                You can now close this tab and start browsing safely.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupComponent;
