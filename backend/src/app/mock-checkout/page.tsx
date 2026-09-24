'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function MockCheckoutContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const extensionUri = searchParams.get('extension_uri');

  if (!email || !extensionUri) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 text-center text-red-600 font-semibold">
        Missing required checkout parameters.
      </div>
    );
  }

  const handleSimulatePayment = () => {
    // Redirect to the success API route to grant the token
    const successUrl = new URL(window.location.origin + '/api/auth/success');
    successUrl.searchParams.append('email', email);
    successUrl.searchParams.append('extension_uri', extensionUri);
    window.location.href = successUrl.toString();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 p-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">James AI Premium</h1>
          <p className="text-slate-300 text-sm">Test Environment</p>
        </div>

        <div className="p-8">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
            <h2 className="text-amber-800 font-bold mb-2">Development Mode Active</h2>
            <p className="text-amber-700 text-sm">
              Stripe API keys are not configured. You have been redirected to this mock checkout page for testing purposes.
              In a production environment, this page would be replaced by a secure Stripe Checkout session.
            </p>
          </div>

          <div className="flex justify-between items-center mb-8 pb-8 border-b border-slate-100">
            <div>
              <div className="font-semibold text-slate-800">Account</div>
              <div className="text-slate-500 text-sm truncate max-w-[200px]" title={email}>{email}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-slate-800">Total</div>
              <div className="text-slate-900 text-xl font-bold">$10.00</div>
            </div>
          </div>

          <button
            onClick={handleSimulatePayment}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
          >
            Simulate Payment
          </button>

          <div className="text-center mt-4">
             <a href={extensionUri} className="text-sm text-slate-500 hover:text-slate-700 underline">Cancel and return to extension</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MockCheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">Loading checkout...</div>}>
      <MockCheckoutContent />
    </Suspense>
  );
}
