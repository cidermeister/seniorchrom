import type { AIResponse } from './types';

export const CACHE_STORAGE_KEY = 'aiScanCache';
export const SAFE_CACHE_TTL_MS = 30 * 60_000;
export const SUSPICIOUS_CACHE_TTL_MS = 10 * 60_000;
export const MAX_CACHE_ENTRIES = 200;

export interface CachedScanEntry {
  result: AIResponse;
  timestamp: number;
  ttlMs: number;
}

const MULTI_TENANT_HOSTS = [
  'sites.google.com',
  'docs.google.com',
  'drive.google.com',
  'forms.gle',
  'github.io',
  'gitlab.io',
  'pages.dev',
  'vercel.app',
  'netlify.app',
  'web.app',
  'firebaseapp.com',
  'blogspot.com',
  'wordpress.com',
  'wixsite.com',
  'weebly.com',
  'squarespace.com',
  'notion.site',
  'carrd.co',
  'linktr.ee',
  'bit.ly',
  'tinyurl.com',
  't.co',
  'rebrand.ly'
] as const;

const cacheMap = new Map<string, CachedScanEntry>();
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;

function hasChromeLocalStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

function isValidCachedEntry(value: unknown): value is CachedScanEntry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  const result = candidate.result as Record<string, unknown> | undefined;
  return (
    Boolean(result) &&
    typeof result?.isSuspicious === 'boolean' &&
    typeof result?.score === 'number' &&
    typeof result?.reasoning === 'string' &&
    typeof candidate.timestamp === 'number' &&
    typeof candidate.ttlMs === 'number'
  );
}

async function ensureHydrated(now: number = Date.now()): Promise<void> {
  if (hydrated) return;
  if (hydrationPromise) return hydrationPromise;

  hydrationPromise = (async () => {
    if (!hasChromeLocalStorage()) {
      hydrated = true;
      return;
    }

    await new Promise<void>((resolve) => {
      chrome.storage.local.get([CACHE_STORAGE_KEY], (result: Record<string, unknown>) => {
        const stored = result[CACHE_STORAGE_KEY];
        if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
          for (const [key, entry] of Object.entries(stored as Record<string, unknown>)) {
            if (isValidCachedEntry(entry) && entry.timestamp + entry.ttlMs > now) {
              cacheMap.set(key, entry);
            }
          }
        }
        hydrated = true;
        resolve();
      });
    });
  })();

  try {
    await hydrationPromise;
  } finally {
    hydrationPromise = null;
  }
}

async function persistCache(now: number = Date.now()): Promise<void> {
  const snapshot: Record<string, CachedScanEntry> = {};
  for (const [key, entry] of cacheMap.entries()) {
    if (entry.timestamp + entry.ttlMs > now) {
      snapshot[key] = entry;
    } else {
      cacheMap.delete(key);
    }
  }

  if (!hasChromeLocalStorage()) return;

  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [CACHE_STORAGE_KEY]: snapshot }, () => resolve());
  });
}

export function isMultiTenantHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return MULTI_TENANT_HOSTS.some(
    (host) => normalized === host || normalized.endsWith(`.${host}`)
  );
}

export function hashContent(text: string): string {
  const normalized = text.substring(0, 4000).replace(/\s+/g, ' ').trim();
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildCacheKey(params: {
  type: 'url' | 'content';
  content: string;
  provider: string;
  language?: string;
  url?: string;
  requireReasoning?: boolean;
}): string {
  const lang = (params.language || '').trim().toLowerCase();
  const mode = params.requireReasoning ? 'detailed' : 'auto';

  if (params.type === 'url') {
    const rawUrl = params.url || params.content;
    try {
      const parsed = new URL(rawUrl);
      const hostname = parsed.hostname.toLowerCase();
      if (isMultiTenantHost(hostname)) {
        return `url:${params.provider}:${mode}:${lang}:${hostname}${parsed.pathname}`;
      }
      return `url:${params.provider}:${mode}:${lang}:${hostname}`;
    } catch {
      return `url:${params.provider}:${mode}:${lang}:${hashContent(params.content)}`;
    }
  }

  let normalizedUrl = 'no-url';
  if (params.url) {
    try {
      const parsed = new URL(params.url);
      normalizedUrl = `${parsed.origin}${parsed.pathname}`;
    } catch {
      normalizedUrl = params.url.trim();
    }
  }

  return `content:${params.provider}:${mode}:${lang}:${normalizedUrl}:${hashContent(params.content)}`;
}

export async function getCachedScan(key: string, now: number = Date.now()): Promise<AIResponse | null> {
  await ensureHydrated(now);
  const entry = cacheMap.get(key);
  if (!entry) return null;

  if (entry.timestamp + entry.ttlMs <= now) {
    cacheMap.delete(key);
    await persistCache(now);
    return null;
  }

  return { ...entry.result };
}

export async function setCachedScan(
  key: string,
  result: AIResponse,
  ttlMs?: number,
  now: number = Date.now()
): Promise<void> {
  await ensureHydrated(now);
  const effectiveTtl = ttlMs ?? (result.isSuspicious ? SUSPICIOUS_CACHE_TTL_MS : SAFE_CACHE_TTL_MS);

  cacheMap.set(key, {
    result: { ...result },
    timestamp: now,
    ttlMs: effectiveTtl
  });

  for (const [entryKey, entry] of cacheMap.entries()) {
    if (entry.timestamp + entry.ttlMs <= now) {
      cacheMap.delete(entryKey);
    }
  }

  if (cacheMap.size > MAX_CACHE_ENTRIES) {
    const sorted = Array.from(cacheMap.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );
    const excess = cacheMap.size - MAX_CACHE_ENTRIES;
    for (let i = 0; i < excess; i++) {
      cacheMap.delete(sorted[i][0]);
    }
  }

  await persistCache(now);
}

export function resetCacheStateForTests(): void {
  cacheMap.clear();
  hydrated = false;
  hydrationPromise = null;
}
