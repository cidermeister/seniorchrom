import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateUserPremiumStatus } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2026-08-26.dahlia',
});
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature || !endpointSecret) {
      // Allow mock bypassing if no secret configured
      if (!endpointSecret && process.env.NODE_ENV !== 'production') {
         return NextResponse.json({ received: true });
      }
      return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed. ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === 'paid' && session.customer) {
        await updateUserPremiumStatus(session.customer as string, true);
    }
  }

  return NextResponse.json({ received: true });
}
