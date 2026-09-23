import type { AIResponse, AISettings } from './types';
import { analyzeWithNano, isNanoAvailable } from './nano';
import { analyzeWithCloud } from './cloud';

export const DEFAULT_SETTINGS: AISettings = {
  provider: 'cloud',
  warningThreshold: 0.5
};

export async function getSettings(): Promise<AISettings> {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['aiSettings'], (result: any) => {
        // Merge with DEFAULT_SETTINGS to ensure new properties like warningThreshold exist for old users
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
  } else {
    result = await analyzeWithCloud(content, type, settings);
  }

  // Enforce user's custom warning threshold
  // If the AI gave a high score, but technically said isSuspicious=false, we override it.
  // If the AI gave a low score, but said isSuspicious=true, we un-flag it.
  if (result.score >= settings.warningThreshold) {
      result.isSuspicious = true;
  } else {
      result.isSuspicious = false;
  }

  return result;
}
