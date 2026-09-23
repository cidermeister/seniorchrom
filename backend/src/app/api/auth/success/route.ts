import { NextRequest, NextResponse } from 'next/server';
import { updateUserPremiumStatus, getUser } from '@/lib/db';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';

const JWT_SECRET = process.env.JWT_SECRET || 'mock_jwt_secret';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2026-08-26.dahlia',
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');
  const extensionUri = url.searchParams.get('extension_uri');
  const mockEmail = url.searchParams.get('email');

  if (!extensionUri) {
    return NextResponse.json({ error: 'Missing extension_uri' }, { status: 400 });
  }

  let userEmail = mockEmail;

  if (sessionId && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_mock') {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      userEmail = session.client_reference_id;

      if (session.payment_status === 'paid' && userEmail) {
         // Also update here just in case webhook is slow
         const user = await getUser(userEmail);
         if (user && user.stripe_customer_id) {
             await updateUserPremiumStatus(user.stripe_customer_id, true);
         }
      }
    } catch (error) {
      console.error('Error retrieving session:', error);
      return NextResponse.json({ error: 'Failed to verify session' }, { status: 500 });
    }
  }

  if (!userEmail) {
    return NextResponse.json({ error: 'User email not found' }, { status: 400 });
  }

  // In mock mode without Stripe, we manually set them as premium here for testing
  if (!sessionId) {
      if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_mock') {
          return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
      }
      const { createUser } = await import('@/lib/db');
      const user = await getUser(userEmail);
      if (user) {
         await updateUserPremiumStatus(user.stripe_customer_id || 'mock', true);
      } else {
         await createUser(userEmail, 'mock', true);
      }
  }

  // To be perfectly safe, only grant the JWT if the user is actually marked as premium in the DB
  const dbUser = await getUser(userEmail);
  if (!dbUser || !dbUser.is_premium) {
      return NextResponse.json({ error: 'User is not premium' }, { status: 403 });
  }

  const token = jwt.sign({ email: userEmail, isPremium: true }, JWT_SECRET, { expiresIn: '30d' });
  const redirectUrl = new URL(extensionUri);
  redirectUrl.searchParams.append('token', token);

  return NextResponse.redirect(redirectUrl.toString());
}
