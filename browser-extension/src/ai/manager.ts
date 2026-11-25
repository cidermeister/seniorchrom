import type { AIResponse, AISettings, AnalyzeOptions } from './types';
import { analyzeWithNano, isNanoAvailable } from './nano';
import { analyzeWithCloud } from './cloud';
import { analyzeWithGemini } from './gemini';
import { buildCacheKey, getCachedScan, setCachedScan } from './cache';

const inFlightRequests = new Map<string, Promise<AIResponse>>();

export const DEFAULT_SETTINGS: AISettings = {
  provider: 'gemini',
  warningThreshold: 0.5,
  language: globalThis.navigator?.language || 'en-US',
  autoScanEnabled: true
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

function applyThreshold(result: AIResponse, warningThreshold: number): AIResponse {
  return {
    ...result,
    isSuspicious: result.score >= warningThreshold
  };
}

async function executeAndCache(
  content: string,
  type: 'url' | 'content',
  settings: AISettings,
  cacheKey: string,
  options?: AnalyzeOptions
): Promise<AIResponse> {
  let result: AIResponse;

  if (settings.provider === 'nano') {
    const available = await isNanoAvailable();
    if (!available) {
      throw new Error('NANO_NOT_AVAILABLE');
    }
    result = await analyzeWithNano(content, type, settings, options);
  } else if (settings.provider === 'gemini') {
    result = await analyzeWithGemini(content, type, settings, options);
  } else {
    result = await analyzeWithCloud(content, type, settings);
  }

  const finalResult = applyThreshold(result, settings.warningThreshold);
  await setCachedScan(cacheKey, finalResult);
  return finalResult;
}

export async function analyze(
  content: string,
  type: 'url' | 'content',
  options?: AnalyzeOptions
): Promise<AIResponse> {
  const settings = await getSettings();
  const cacheKey = buildCacheKey({
    type,
    content,
    provider: settings.provider,
    language: settings.language,
    url: options?.url,
    requireReasoning: options?.requireReasoning
  });

  if (!options?.bypassCache) {
    const cached = await getCachedScan(cacheKey);
    if (cached) {
      return applyThreshold(cached, settings.warningThreshold);
    }

    const inFlight = inFlightRequests.get(cacheKey);
    if (inFlight) {
      const sharedResult = await inFlight;
      return applyThreshold(sharedResult, settings.warningThreshold);
    }

    const requestPromise = executeAndCache(content, type, settings, cacheKey, options).finally(
      () => {
        inFlightRequests.delete(cacheKey);
      }
    );
    inFlightRequests.set(cacheKey, requestPromise);

    const result = await requestPromise;
    return applyThreshold(result, settings.warningThreshold);
  }

  return executeAndCache(content, type, settings, cacheKey, options);
}

export function clearInFlightRequestsForTests(): void {
  inFlightRequests.clear();
}
