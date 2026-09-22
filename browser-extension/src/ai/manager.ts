import type { AIResponse, AISettings } from './types';
import { analyzeWithNano, isNanoAvailable } from './nano';
import { analyzeWithCloud } from './cloud';

export const DEFAULT_SETTINGS: AISettings = {
  provider: 'cloud'
};

export async function getSettings(): Promise<AISettings> {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['aiSettings'], (result: any) => {
        resolve(result.aiSettings || DEFAULT_SETTINGS);
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

  if (settings.provider === 'nano') {
    const available = await isNanoAvailable();
    if (!available) {
      throw new Error('NANO_NOT_AVAILABLE');
    }
    return analyzeWithNano(content, type);
  } else {
    return analyzeWithCloud(content, type, settings);
  }
}
