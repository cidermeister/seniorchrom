export type AIProvider = 'nano' | 'cloud' | 'gemini' | 'premium';

export interface AISettings {
  provider: AIProvider;
  cloudApiKey?: string;
  cloudApiUrl?: string;
  geminiApiKey?: string;
  accessToken?: string;
  warningThreshold: number; // 0.0 to 1.0
  language?: string; // e.g. 'en-US'
  autoScanEnabled?: boolean;
}

export interface AIResponse {
  isSuspicious: boolean;
  score: number; // 0.0 to 1.0
  reasoning: string;
}
