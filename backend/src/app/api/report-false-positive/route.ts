import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const apiKey = process.env.API_KEY || 'my_secret_key'; // Default to match dev env if not set

    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== apiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { domain, score, reasoning } = body;

    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.run(
      'INSERT INTO false_positives (domain, score, reasoning) VALUES (?, ?, ?)',
      domain, score, reasoning
    );

    return NextResponse.json({ success: true, id: result.lastID });
  } catch (error: any) {
    console.error('Error reporting false positive:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
