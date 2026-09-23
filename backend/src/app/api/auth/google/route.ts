import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const redirect_uri = url.searchParams.get('redirect_uri');

  if (!redirect_uri) {
    return NextResponse.json({ error: 'redirect_uri is required' }, { status: 400 });
  }

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.append('client_id', process.env.GOOGLE_CLIENT_ID || 'mock_client_id');
  googleAuthUrl.searchParams.append('redirect_uri', `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/callback`);
  googleAuthUrl.searchParams.append('response_type', 'code');
  googleAuthUrl.searchParams.append('scope', 'email profile');
  googleAuthUrl.searchParams.append('access_type', 'offline');
  googleAuthUrl.searchParams.append('state', redirect_uri); // Pass the extension's redirect_uri as state

  return NextResponse.redirect(googleAuthUrl.toString());
}
