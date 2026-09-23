import type { AIResponse, AISettings } from './types';

export async function analyzeWithPremium(content: string, type: 'url' | 'content', settings: AISettings): Promise<AIResponse> {
  if (!settings.accessToken) {
    throw new Error('Premium access token not found. Please log in.');
  }

  const response = await fetch('http://localhost:3000/api/ai/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.accessToken}`
    },
    body: JSON.stringify({ content, type })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 402) {
       throw new Error('PREMIUM_REQUIRED');
    }
    throw new Error(`Premium AI Error (${response.status}): ${errorData.error || response.statusText}`);
  }

  const result = await response.json();
  return result as AIResponse;
}
