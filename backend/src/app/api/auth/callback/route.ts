import { NextRequest, NextResponse } from 'next/server';
import { getUser, createUser } from '@/lib/db';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2026-08-26.dahlia',
});

const JWT_SECRET = process.env.JWT_SECRET || 'mock_jwt_secret';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const extensionRedirectUri = url.searchParams.get('state');

  if (!code || !extensionRedirectUri) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  // In a real app, you would exchange the code for tokens here using google api.
  // For the mock, we'll pretend the code is the user's email directly or use a mock email
  // If the user hasn't supplied real keys, let's use a mock authentication bypass

  let userEmail = 'mockuser@example.com';

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      try {
          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                  code,
                  client_id: process.env.GOOGLE_CLIENT_ID,
                  client_secret: process.env.GOOGLE_CLIENT_SECRET,
                  redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/callback`,
                  grant_type: 'authorization_code',
              }),
          });

          if (!tokenResponse.ok) {
              const text = await tokenResponse.text();
              console.error('Google token exchange failed:', text);
              throw new Error('Failed to exchange code');
          }

          const tokenData = await tokenResponse.json();
          const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          const userData = await userResponse.json();
          userEmail = userData.email;
      } catch (error) {
          console.error("Auth error", error);
          return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
      }
  }

  // Check database
  let user = await getUser(userEmail);
  if (!user) {
    user = await createUser(userEmail);
  }

  if (user.is_premium) {
    // Generate JWT and redirect back to extension
    const token = jwt.sign({ email: user.email, isPremium: true }, JWT_SECRET, { expiresIn: '30d' });
    const redirectUrl = new URL(extensionRedirectUri);
    redirectUrl.searchParams.append('token', token);
    return NextResponse.redirect(redirectUrl.toString());
  } else {
    // Not premium, start Stripe checkout

    // Create Stripe Customer if not exists
    let stripeCustomerId = user.stripe_customer_id;
    if (!stripeCustomerId && process.env.STRIPE_SECRET_KEY) {
         try {
             const customer = await stripe.customers.create({ email: userEmail });
             stripeCustomerId = customer.id;
             // update user with customer id
             const { updateUserStripeId } = await import('@/lib/db');
             await updateUserStripeId(userEmail, stripeCustomerId);
         } catch (e) {
             console.error("Stripe error", e);
         }
    }

    // Mock stripe checkout flow if no real key
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_mock') {
        const redirectUrl = new URL(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/mock-checkout`);
        redirectUrl.searchParams.append('email', userEmail);
        redirectUrl.searchParams.append('extension_uri', extensionRedirectUri);
        return NextResponse.redirect(redirectUrl.toString());
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Premium AI Access',
            },
            unit_amount: 1000, // $10.00
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer: stripeCustomerId,
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/success?session_id={CHECKOUT_SESSION_ID}&extension_uri=${encodeURIComponent(extensionRedirectUri)}`,
      cancel_url: extensionRedirectUri,
      client_reference_id: userEmail, // Useful for webhook
    });

    return NextResponse.redirect(session.url as string);
  }
}
