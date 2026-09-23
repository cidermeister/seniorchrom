export type AIProvider = 'nano' | 'cloud' | 'gemini';

export interface AISettings {
  provider: AIProvider;
  cloudApiKey?: string;
  cloudApiUrl?: string;
  geminiApiKey?: string;
  warningThreshold: number; // 0.0 to 1.0
}

export interface AIResponse {
  isSuspicious: boolean;
  score: number; // 0.0 to 1.0
  reasoning: string;
}
