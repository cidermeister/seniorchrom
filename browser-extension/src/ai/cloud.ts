import type { AIResponse, AISettings } from './types';

export async function analyzeWithCloud(_content: string, _type: 'url' | 'content', settings: AISettings): Promise<AIResponse> {
  if (!settings.cloudApiKey && !settings.cloudApiUrl) {
    throw new Error("Cloud AI is not configured. Please add an API Key/URL in settings.");
  }

  // Actually throw so the user knows they need to set this up instead of just waiting
  throw new Error("Cloud API integration requires a real endpoint to be configured.");
}
