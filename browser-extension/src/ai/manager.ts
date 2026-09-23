import type { AIResponse, AISettings } from './types';
import { analyzeWithNano, isNanoAvailable } from './nano';
import { analyzeWithCloud } from './cloud';
import { analyzeWithGemini } from './gemini';

export const DEFAULT_SETTINGS: AISettings = {
  provider: 'gemini',
  warningThreshold: 0.5,
  geminiModel: 'gemini-1.5-flash'
};

export async function getSettings(): Promise<AISettings> {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['aiSettings'], (result: any) => {
        resolve({ ...DEFAULT_SETTINGS, ...(result.aiSettings || {}) });
      });
    });
  }
  return DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AISettings): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ aiSettings: settings }, resolve);
    });
  }
}

export async function analyze(content: string, type: 'url' | 'content'): Promise<AIResponse> {
  const settings = await getSettings();

  let result: AIResponse;

  if (settings.provider === 'nano') {
    const available = await isNanoAvailable();
    if (!available) {
      throw new Error('NANO_NOT_AVAILABLE');
    }
    result = await analyzeWithNano(content, type);
  } else if (settings.provider === 'gemini') {
    result = await analyzeWithGemini(content, type, settings);
  } else {
    result = await analyzeWithCloud(content, type, settings);
  }

  if (result.score >= settings.warningThreshold) {
      result.isSuspicious = true;
  } else {
      result.isSuspicious = false;
  }

  return result;
}
