import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mock_jwt_secret';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { email: string, isPremium: boolean };

    if (!decoded.isPremium) {
        return NextResponse.json({ error: 'Payment required' }, { status: 402 });
    }

    const { content, type } = await req.json();

    if (!content || !type) {
       return NextResponse.json({ error: 'Missing content or type' }, { status: 400 });
    }

    // Mock Premium AI Analysis
    const mockScore = Math.random();
    const isSuspicious = mockScore > 0.5;
    const reasoning = isSuspicious
        ? `[Premium Analysis] The ${type} exhibits patterns commonly associated with suspicious activity. High confidence of risk.`
        : `[Premium Analysis] The ${type} appears safe and does not trigger our advanced threat signatures.`;

    return NextResponse.json({
        isSuspicious,
        score: mockScore,
        reasoning
    });

  } catch (error) {
    console.error('Token verification failed:', error);
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}
