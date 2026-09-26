import React from 'react';

const FaqComponent: React.FC = () => {
  const faqs = [
    {
      question: "Why do I need an API Key?",
      answer: "James relies on large language models (LLMs) to understand the context and intent of web pages, which is how he identifies scams. To access these models, James needs a key to either Google's official Gemini API or a custom API endpoint you provide."
    },
    {
      question: "How do I get a Google Gemini API Key?",
      answer: "You can obtain a free API key by visiting Google AI Studio (aistudio.google.com). Sign in with your Google account, click 'Get API key', and create a new key. Copy and paste that key into James's settings."
    },
    {
      question: "What is the 'Local AI (Gemini Nano)' option?",
      answer: "Gemini Nano is a built-in AI model currently being tested in Google Chrome. If you have the correct experimental flags enabled in your browser, James can use this local model to scan pages without sending any data over the internet. It is highly private but may be slower or less accurate than the cloud models."
    },
    {
      question: "Why does James sometimes warn me about safe sites (False Positives)?",
      answer: "James analyzes text to find patterns typical of scams. Sometimes, legitimate sites (like articles discussing scams, or unconventional online stores) might use similar language. You can adjust James's 'Warning Threshold' in the settings. A higher threshold makes James less strict, reducing false positives."
    },
    {
      question: "What should I do if a warning appears?",
      answer: "When James shows a warning overlay, read the reasoning provided. If you believe James made a mistake and you trust the site, you can click the 'I understand the risks, proceed anyway' button at the bottom of the warning to dismiss it for that tab."
    },
    {
      question: "Does James slow down my browsing?",
      answer: "James is designed to be lightweight. The initial fast URL scan happens almost instantly. The deep content scan happens in the background after the page has loaded, ensuring your browsing experience remains smooth."
    }
  ];

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
            Frequently Asked Questions
          </h1>
        </div>

        <div className="space-y-6">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-gray-50 border border-gray-200 shadow-sm rounded-lg p-6">
              <h3 className="text-xl font-bold text-black mb-2 flex items-start">
                <span className="text-gray-400 mr-2">Q:</span>
                {faq.question}
              </h3>
              <p className="text-gray-700 text-lg leading-relaxed flex items-start">
                <span className="text-gray-400 mr-2 font-bold">A:</span>
                <span>{faq.answer}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center border-t border-gray-200 pt-8">
           <p className="text-gray-600">
             Still need assistance? James is always at your service.
           </p>
        </div>
      </div>
    </div>
  );
};

export default FaqComponent;
