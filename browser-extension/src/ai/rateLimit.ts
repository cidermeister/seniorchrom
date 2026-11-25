export const COOLDOWN_STORAGE_KEY = 'aiModelCooldowns';
export const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 65_000;
export const DAILY_QUOTA_COOLDOWN_MS = 15 * 60_000;
export const OVERLOAD_COOLDOWN_MS = 30_000;
export const NOT_FOUND_COOLDOWN_MS = 60 * 60_000;

const MIN_RETRY_AFTER_MS = 15_000;
const MAX_RETRY_AFTER_MS = 900_000;
const RETRY_BUFFER_MS = 2_000;

const cooldowns = new Map<string, number>();
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;

function hasChromeLocalStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

function clampRetryAfter(ms: number): number {
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(MIN_RETRY_AFTER_MS, Math.round(ms)));
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
      chrome.storage.local.get([COOLDOWN_STORAGE_KEY], (result: Record<string, unknown>) => {
        const stored = result[COOLDOWN_STORAGE_KEY];
        if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
          for (const [modelId, until] of Object.entries(stored as Record<string, unknown>)) {
            if (typeof until === 'number' && Number.isFinite(until) && until > now) {
              cooldowns.set(modelId, until);
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

async function persistCooldowns(now: number = Date.now()): Promise<void> {
  const snapshot: Record<string, number> = {};
  for (const [modelId, until] of cooldowns.entries()) {
    if (until > now) {
      snapshot[modelId] = until;
    } else {
      cooldowns.delete(modelId);
    }
  }

  if (!hasChromeLocalStorage()) return;

  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [COOLDOWN_STORAGE_KEY]: snapshot }, () => resolve());
  });
}

export function parseRetryAfterMs(
  retryAfterHeader?: string | null,
  errorMessage?: string,
  now: number = Date.now()
): number | null {
  if (retryAfterHeader) {
    const trimmed = retryAfterHeader.trim();
    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
      const seconds = Number(trimmed);
      if (Number.isFinite(seconds) && seconds >= 0) {
        return clampRetryAfter(seconds * 1000 + RETRY_BUFFER_MS);
      }
    }

    const parsedDateMs = Date.parse(trimmed);
    if (!Number.isNaN(parsedDateMs)) {
      const deltaMs = parsedDateMs - now;
      if (deltaMs > 0) {
        return clampRetryAfter(deltaMs + RETRY_BUFFER_MS);
      }
    }
  }

  if (errorMessage) {
    const match = errorMessage.match(
      /retry\s+(?:in|after)\s+(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|sec|seconds?|m|min|minutes?)?/i
    );
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value >= 0) {
        const unit = (match[2] || 's').toLowerCase();
        let rawMs = value * 1000;
        if (unit.startsWith('ms') || unit.startsWith('millisecond')) {
          rawMs = value;
        } else if (unit.startsWith('m')) {
          rawMs = value * 60_000;
        }
        return clampRetryAfter(rawMs + RETRY_BUFFER_MS);
      }
    }
  }

  return null;
}

export function isDailyQuotaError(errorMessage?: string): boolean {
  if (!errorMessage) return false;
  return /per[_ ]?day|requests[_ ]?per[_ ]?day|\brpd\b|daily\s*(?:quota|limit|cap|requests?)/i.test(
    errorMessage
  );
}

export async function getModelCooldownUntil(modelId: string, now: number = Date.now()): Promise<number> {
  await ensureHydrated(now);
  const until = cooldowns.get(modelId);
  if (!until) return 0;

  if (until <= now) {
    cooldowns.delete(modelId);
    await persistCooldowns(now);
    return 0;
  }

  return until;
}

export async function isModelCoolingDown(modelId: string, now: number = Date.now()): Promise<boolean> {
  return (await getModelCooldownUntil(modelId, now)) > now;
}

export async function markModelUnavailable(
  modelId: string,
  status: number,
  retryAfterHeader?: string | null,
  errorMessage?: string,
  now: number = Date.now()
): Promise<number> {
  let cooldownMs = 0;

  if (status === 429) {
    if (isDailyQuotaError(errorMessage)) {
      cooldownMs = DAILY_QUOTA_COOLDOWN_MS;
    } else {
      cooldownMs = parseRetryAfterMs(retryAfterHeader, errorMessage, now) ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS;
    }
  } else if (status === 503) {
    cooldownMs = OVERLOAD_COOLDOWN_MS;
  } else if (status === 404) {
    cooldownMs = NOT_FOUND_COOLDOWN_MS;
  }

  if (cooldownMs <= 0) {
    return 0;
  }

  await ensureHydrated(now);
  const until = now + cooldownMs;
  cooldowns.set(modelId, until);
  await persistCooldowns(now);
  return until;
}

export async function clearModelCooldown(modelId: string): Promise<void> {
  await ensureHydrated();
  if (cooldowns.delete(modelId)) {
    await persistCooldowns();
  }
}

export async function selectModelsForAttempt<T extends { id: string }>(
  models: readonly T[],
  now: number = Date.now()
): Promise<T[]> {
  await ensureHydrated(now);

  const available: T[] = [];
  const coolingDown: Array<{ model: T; until: number }> = [];
  let expiredPruned = false;

  for (const model of models) {
    const until = cooldowns.get(model.id);
    if (until && until > now) {
      coolingDown.push({ model, until });
    } else {
      if (until !== undefined) {
        cooldowns.delete(model.id);
        expiredPruned = true;
      }
      available.push(model);
    }
  }

  if (expiredPruned) {
    await persistCooldowns(now);
  }

  if (available.length > 0) {
    return available;
  }

  if (coolingDown.length > 0) {
    coolingDown.sort((a, b) => a.until - b.until);
    return [coolingDown[0].model];
  }

  return [];
}

export function resetRateLimitStateForTests(): void {
  cooldowns.clear();
  hydrated = false;
  hydrationPromise = null;
}
