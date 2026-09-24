import React from 'react';

const InfoComponent: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-black py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex flex-col items-center border-b-2 border-black pb-8">
          <img
            src="/james.png"
            alt="James Logo"
            className="w-24 h-24 mb-4 object-contain"
          />
          <h1 className="text-4xl font-extrabold text-center tracking-tight text-black">
            About James
          </h1>
        </div>

        <div className="space-y-6 text-gray-800 text-lg leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-black mb-3">Your Digital Butler</h2>
            <p>
              James is designed to be your silent, ever-vigilant protector on the web. Much like a traditional butler, James operates in the background, anticipating your needs and shielding you from potential harm without causing unnecessary interruptions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black mb-3">How James Protects You</h2>
            <p>
              When you visit a new webpage, James quickly scans both the URL and the visible content. By utilizing advanced Artificial Intelligence, James can identify sophisticated phishing attacks, scams, and malicious intent that traditional, rule-based blockers might miss.
            </p>
            <p className="mt-2">
              If a threat is detected, James immediately steps in, placing a prominent warning overlay on the screen to prevent you from accidentally interacting with a dangerous site.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black mb-3">Privacy First</h2>
            <p>
              As a proper butler, James respects your privacy above all else. James only analyzes the text content of the pages you visit to determine their safety. If you choose to use the local Gemini Nano model, your data never even leaves your device.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black mb-3">Version Information</h2>
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-md inline-block">
              <p><strong>Version:</strong> 1.0.0</p>
              <p><strong>Engine:</strong> Manifest V3</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default InfoComponent;
