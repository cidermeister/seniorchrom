import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      !specifier.endsWith('.ts') &&
      !specifier.endsWith('.js') &&
      context.parentURL?.startsWith('file://')
    ) {
      const parentPath = fileURLToPath(context.parentURL);
      const candidate = path.resolve(path.dirname(parentPath), `${specifier}.ts`);
      if (fs.existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  }
});

const {
  DECISION_MODEL,
  GENERATIVE_MODELS,
  INTERACTIONS_API_REVISION,
  INTERACTIONS_ENDPOINT,
  analyzeWithGemini,
  extractInteractionText,
  parseAIResponseJson
} = await import('../src/ai/gemini.ts');
const {
  analyzeWithNano,
  isNanoAvailable,
  resetNanoSessionForTests
} = await import('../src/ai/nano.ts');
const {
  AI_RESPONSE_JSON_SCHEMA,
  SYSTEM_PROMPT
} = await import('../src/ai/prompts.ts');
const {
  analyze,
  clearInFlightRequestsForTests
} = await import('../src/ai/manager.ts');
const {
  COOLDOWN_STORAGE_KEY,
  DAILY_QUOTA_COOLDOWN_MS,
  NOT_FOUND_COOLDOWN_MS,
  OVERLOAD_COOLDOWN_MS,
  getModelCooldownUntil,
  isModelCoolingDown,
  markModelUnavailable,
  parseRetryAfterMs,
  resetRateLimitStateForTests,
  selectModelsForAttempt
} = await import('../src/ai/rateLimit.ts');
const {
  buildCacheKey,
  resetCacheStateForTests
} = await import('../src/ai/cache.ts');

interface RecordedCall {
  url: string;
  headers: Record<string, string>;
  body: Record<string, any>;
}

function createMockChromeStorage(initialData: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initialData };

  const chromeMock = {
    storage: {
      local: {
        get(keys: string | string[] | null, callback: (items: Record<string, unknown>) => void) {
          const out: Record<string, unknown> = {};
          if (Array.isArray(keys)) {
            for (const key of keys) {
              if (key in store) {
                out[key] = structuredClone(store[key]);
              }
            }
          } else if (typeof keys === 'string') {
            if (keys in store) {
              out[keys] = structuredClone(store[keys]);
            }
          }
          queueMicrotask(() => callback(out));
        },
        set(items: Record<string, unknown>, callback?: () => void) {
          for (const [key, val] of Object.entries(items)) {
            store[key] = structuredClone(val);
          }
          if (callback) {
            queueMicrotask(callback);
          }
        },
        remove(keys: string | string[], callback?: () => void) {
          const list = Array.isArray(keys) ? keys : [keys];
          for (const key of list) {
            delete store[key];
          }
          if (callback) {
            queueMicrotask(callback);
          }
        }
      }
    }
  };

  (globalThis as Record<string, unknown>).chrome = chromeMock;
  return store;
}

function makeJsonResponse(payload: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    statusText: status === 200 ? 'OK' : `HTTP ${status}`,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

function makeInteractionSuccessResponse(
  model: string,
  payloadText: string,
  extraSteps: Array<Record<string, unknown>> = []
): Response {
  return makeJsonResponse({
    object: 'interaction',
    id: `int_${model}`,
    status: 'completed',
    model,
    steps: [
      ...extraSteps,
      {
        type: 'model_output',
        content: [{ type: 'text', text: payloadText }]
      }
    ]
  });
}

function installFetchMock(
  handler: (call: RecordedCall, callIndex: number) => Promise<Response> | Response
): RecordedCall[] {
  const calls: RecordedCall[] = [];
  (globalThis as Record<string, unknown>).fetch = async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const rawHeaders = init?.headers;
    const headers: Record<string, string> = {};
    if (rawHeaders instanceof Headers) {
      rawHeaders.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (rawHeaders && !Array.isArray(rawHeaders)) {
      for (const [key, value] of Object.entries(rawHeaders)) {
        headers[key] = String(value);
      }
    }
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    const call: RecordedCall = { url, headers, body };
    calls.push(call);
    return handler(call, calls.length - 1);
  };
  return calls;
}

const DEFAULT_SETTINGS = {
  provider: 'gemini' as const,
  geminiApiKey: 'test-api-key',
  warningThreshold: 0.5,
  language: 'en-US',
  autoScanEnabled: true
};

let storageStore: Record<string, unknown> = {};

beforeEach(() => {
  resetRateLimitStateForTests();
  resetCacheStateForTests();
  resetNanoSessionForTests();
  clearInFlightRequestsForTests();
  delete (globalThis as Record<string, unknown>).LanguageModel;
  delete (globalThis as Record<string, unknown>).ai;
  storageStore = createMockChromeStorage({
    aiSettings: { ...DEFAULT_SETTINGS }
  });
});

describe('Decisions API Stage 1 screening', () => {
  it('sends valid v1beta/decisions payload and skips Stage 2 when safe', async () => {
    const calls = installFetchMock((call) => {
      assert.equal(call.url, 'https://generativelanguage.googleapis.com/v1beta/decisions');
      assert.equal(call.headers['x-goog-api-key'], 'test-api-key');
      assert.equal(call.body.model, DECISION_MODEL);
      assert.equal(call.body.questions.is_suspicious.type, 'noul');
      assert.equal(call.body.questions.risk_level.type, 'score');
      assert.ok(Array.isArray(call.body.questions.risk_level.criteria));
      assert.equal(call.body.questions.risk_level.criteria.length, 4);

      return makeJsonResponse({
        answers: {
          is_suspicious: { type: 'noul', noul: 0.05, confidence: 0.95 },
          risk_level: { type: 'score', score: 0.2, confidence: 0.96 }
        }
      });
    });

    const result = await analyzeWithGemini('https://www.admin.ch/gov/en/start.html', 'url', DEFAULT_SETTINGS);
    assert.equal(calls.length, 1);
    assert.equal(result.isSuspicious, false);
    assert.ok(result.score < 0.2);
  });

  it('escalates suspicious Decisions API score to Stage 2 Interactions API for localized reasoning', async () => {
    const calls = installFetchMock((call) => {
      if (call.url.endsWith('/decisions')) {
        return makeJsonResponse({
          answers: {
            is_suspicious: { type: 'noul', noul: 0.9, confidence: 0.92 },
            risk_level: { type: 'score', score: 2.7, confidence: 0.91 }
          }
        });
      }

      return makeInteractionSuccessResponse(
        call.body.model,
        JSON.stringify({
          isSuspicious: true,
          score: 0.91,
          reasoning: 'Lookalike banking domain requesting login credentials.'
        })
      );
    });

    const result = await analyzeWithGemini(
      'https://tsb-internetbanking-verify.example.com',
      'url',
      { ...DEFAULT_SETTINGS, language: 'en-GB' }
    );

    assert.equal(calls.length, 2);
    assert.ok(calls[0].url.endsWith('/v1beta/decisions'));
    assert.equal(calls[1].url, INTERACTIONS_ENDPOINT);
    assert.equal(calls[1].body.model, 'gemma-4-26b-a4b-it');
    assert.equal(result.isSuspicious, true);
    assert.equal(result.score, 0.91);
    assert.equal(result.reasoning, 'Lookalike banking domain requesting login credentials.');
  });

  it('escalates borderline low-confidence Decisions API result to Stage 2', async () => {
    const calls = installFetchMock((call) => {
      if (call.url.endsWith('/decisions')) {
        return makeJsonResponse({
          answers: {
            is_suspicious: { type: 'noul', noul: 0.42, confidence: 0.58 },
            risk_level: { type: 'score', score: 1.2, confidence: 0.61 }
          }
        });
      }

      return makeInteractionSuccessResponse(
        call.body.model,
        JSON.stringify({
          isSuspicious: false,
          score: 0.35,
          reasoning: 'Legitimate store with aggressive promotional countdown.'
        })
      );
    });

    const result = await analyzeWithGemini(
      'Limited time offer! 50% off today only.',
      'content',
      DEFAULT_SETTINGS,
      { url: 'https://shop.example.com/sale' }
    );

    assert.equal(calls.length, 2);
    assert.equal(calls[1].url, INTERACTIONS_ENDPOINT);
    assert.equal(result.isSuspicious, false);
    assert.equal(result.score, 0.35);
  });

  it('returns Stage 1 suspicious warning when Stage 2 models are all rate-limited', async () => {
    const calls = installFetchMock((call) => {
      if (call.url.endsWith('/decisions')) {
        return makeJsonResponse({
          answers: {
            is_suspicious: { type: 'noul', noul: 0.92, confidence: 0.94 },
            risk_level: { type: 'score', score: 2.8, confidence: 0.93 }
          }
        });
      }

      return makeJsonResponse(
        { error: { message: 'Resource exhausted' } },
        429,
        { 'retry-after': '45' }
      );
    });

    const result = await analyzeWithGemini(
      'https://phishing-login-update.example.com',
      'url',
      DEFAULT_SETTINGS
    );

    assert.equal(calls.length, 1 + GENERATIVE_MODELS.length);
    assert.equal(result.isSuspicious, true);
    assert.ok(result.score >= 0.9);
    assert.ok(result.reasoning.includes('Automated screening detected high-risk'));
  });

  it('falls back to Stage 2 and cools down decision model when Stage 1 returns 429', async () => {
    const calls = installFetchMock((call) => {
      if (call.url.endsWith('/decisions')) {
        return makeJsonResponse({ error: { message: 'Quota exceeded' } }, 429);
      }

      return makeInteractionSuccessResponse(
        call.body.model,
        JSON.stringify({
          isSuspicious: false,
          score: 0.05,
          reasoning: 'Official site.'
        })
      );
    });

    const first = await analyzeWithGemini('https://elderton.ch', 'url', DEFAULT_SETTINGS);
    assert.equal(first.isSuspicious, false);
    assert.equal(calls.length, 2);
    assert.equal(await isModelCoolingDown(DECISION_MODEL), true);

    const second = await analyzeWithGemini('https://accounts.google.com', 'url', DEFAULT_SETTINGS);
    assert.equal(second.isSuspicious, false);
    // Second call skips cooled-down gemini-decision-1 and goes straight to Stage 2
    assert.equal(calls.length, 3);
    assert.equal(calls[2].url, INTERACTIONS_ENDPOINT);
    assert.equal(calls[2].body.model, 'gemma-4-26b-a4b-it');
  });

  it('skips Stage 1 when requireReasoning is true', async () => {
    const calls = installFetchMock((call) =>
      makeInteractionSuccessResponse(
        call.body.model,
        JSON.stringify({
          isSuspicious: false,
          score: 0.1,
          reasoning: 'Detailed reasoning requested directly.'
        })
      )
    );

    const result = await analyzeWithGemini(
      'Official city council page.',
      'content',
      DEFAULT_SETTINGS,
      { url: 'https://zurich.ch', requireReasoning: true }
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, INTERACTIONS_ENDPOINT);
    assert.equal(calls[0].body.model, 'gemma-4-26b-a4b-it');
    assert.equal(result.reasoning, 'Detailed reasoning requested directly.');
  });
});

describe('Interactions API fallback pool & response parsing', () => {
  it('sends valid Interactions API payloads with per-model generation_config and falls through cleanly', async () => {
    const calls = installFetchMock((call) => {
      if (call.body.model === 'gemini-4-hydrogen') {
        return makeInteractionSuccessResponse(
          'gemini-4-hydrogen',
          JSON.stringify({
            isSuspicious: false,
            score: 0.12,
            reasoning: 'Handled by Gemini 4 Hydrogen.'
          })
        );
      }

      return makeJsonResponse({ error: { message: 'Rate limited' } }, 429);
    });

    const result = await analyzeWithGemini(
      'Sample webpage content for model verification.',
      'content',
      DEFAULT_SETTINGS,
      { url: 'https://example.org', requireReasoning: true }
    );

    assert.equal(calls.length, GENERATIVE_MODELS.length);
    assert.equal(result.reasoning, 'Handled by Gemini 4 Hydrogen.');

    const [moeCall, denseCall, flash35Call, flash31Call, hydrogenCall] = calls;

    for (const call of calls) {
      assert.equal(call.url, INTERACTIONS_ENDPOINT);
      assert.equal(call.headers['x-goog-api-key'], 'test-api-key');
      assert.equal(call.headers['Api-Revision'], INTERACTIONS_API_REVISION);
      assert.equal(call.body.system_instruction, SYSTEM_PROMPT);
      assert.equal(typeof call.body.input, 'string');
      assert.equal(call.body.store, false);
      assert.equal(call.body.response_format.type, 'text');
      assert.equal(call.body.response_format.mime_type, 'application/json');
      assert.deepEqual(call.body.response_format.schema, AI_RESPONSE_JSON_SCHEMA);
    }

    assert.equal(moeCall.body.generation_config.temperature, 0.1);
    assert.equal(moeCall.body.generation_config.thinking_level, 'minimal');

    assert.equal(denseCall.body.generation_config.temperature, 0.1);
    assert.equal(denseCall.body.generation_config.thinking_level, 'minimal');

    assert.equal('temperature' in flash35Call.body.generation_config, false);
    assert.equal(flash35Call.body.generation_config.thinking_level, 'minimal');

    assert.equal(flash31Call.body.generation_config.temperature, 0.1);
    assert.equal('thinking_level' in flash31Call.body.generation_config, false);

    assert.equal('temperature' in hydrogenCall.body.generation_config, false);
    assert.equal(hydrogenCall.body.generation_config.thinking_level, 'low');
  });

  it('ignores thought steps, reads trailing model_output steps, and falls back on failed status or malformed JSON', async () => {
    const extractedFromSteps = extractInteractionText({
      status: 'completed',
      steps: [
        { type: 'user_input', content: [{ type: 'text', text: 'Analyze...' }] },
        { type: 'model_output', content: [{ type: 'text', text: 'stale partial' }] },
        { type: 'thought', summary: [{ type: 'text', text: 'Let me think carefully...' }] },
        {
          type: 'model_output',
          content: [
            { type: 'text', text: '```json\n{"isSuspicious": false, "score": 0.15, ' },
            { type: 'text', text: '"reasoning": "Clean"}\n```' }
          ]
        }
      ]
    });
    const parsed = parseAIResponseJson(extractedFromSteps);
    assert.equal(parsed.isSuspicious, false);
    assert.equal(parsed.score, 0.15);
    assert.equal(parsed.reasoning, 'Clean');

    assert.equal(
      extractInteractionText({ status: 'completed', output_text: '{"ok":true}' }),
      '{"ok":true}'
    );
    assert.throws(
      () => extractInteractionText({ status: 'failed', error: { message: 'Model crashed' } }),
      /Model crashed/
    );

    const calls = installFetchMock((call) => {
      if (call.body.model === 'gemma-4-26b-a4b-it') {
        return makeJsonResponse({
          status: 'failed',
          error: { message: 'Temporary execution error' }
        });
      }

      if (call.body.model === 'gemma-4-31b-it') {
        return makeInteractionSuccessResponse(
          'gemma-4-31b-it',
          'Sorry, I cannot output JSON right now.'
        );
      }

      return makeInteractionSuccessResponse(
        call.body.model,
        JSON.stringify({
          isSuspicious: false,
          score: 0.08,
          reasoning: 'Parsed after skipping thought step and earlier failures.'
        }),
        [{ type: 'thought', summary: [{ type: 'text', text: 'internal reasoning...' }] }]
      );
    });

    const result = await analyzeWithGemini(
      'https://example.com',
      'url',
      DEFAULT_SETTINGS,
      { requireReasoning: true }
    );

    assert.equal(calls.length, 3);
    assert.equal(calls[1].body.model, 'gemma-4-31b-it');
    assert.equal(calls[2].body.model, 'gemini-3.5-flash-lite');
    assert.equal(result.isSuspicious, false);
    assert.equal(result.score, 0.08);
    assert.equal(result.reasoning, 'Parsed after skipping thought step and earlier failures.');
  });
});

describe('Rate-limit cooldown tracking', () => {
  it('parses Retry-After headers and Gemini retry delay messages', () => {
    assert.equal(parseRetryAfterMs('30', undefined, 1000), 32_000);
    assert.equal(parseRetryAfterMs(null, 'Quota exceeded. Please retry in 42.5s.', 1000), 44_500);
    assert.equal(parseRetryAfterMs('5', undefined, 1000), 15_000);
  });

  it('applies differentiated cooldowns for RPD, 404, and 503 and persists across memory resets', async () => {
    const now = Date.now();
    const rpdUntil = await markModelUnavailable(
      'gemma-4-26b-a4b-it',
      429,
      null,
      'Quota exceeded for metric: GenerateRequestsPerDayPerProjectPerModel',
      now
    );
    assert.equal(rpdUntil, now + DAILY_QUOTA_COOLDOWN_MS);

    const notFoundUntil = await markModelUnavailable('gemini-3.1-flash-lite', 404, null, 'Not found', now);
    assert.equal(notFoundUntil, now + NOT_FOUND_COOLDOWN_MS);

    const overloadUntil = await markModelUnavailable('gemma-4-31b-it', 503, null, 'Overloaded', now);
    assert.equal(overloadUntil, now + OVERLOAD_COOLDOWN_MS);

    assert.ok(storageStore[COOLDOWN_STORAGE_KEY]);

    resetRateLimitStateForTests();
    assert.equal(await getModelCooldownUntil('gemma-4-26b-a4b-it', now + 1000), rpdUntil);
    assert.equal(await getModelCooldownUntil('gemini-3.1-flash-lite', now + 1000), notFoundUntil);
  });

  it('skips cooling-down models on subsequent calls and probes only soonest-expiring when all cool down', async () => {
    const calls = installFetchMock((call) => {
      if (call.body.model === 'gemma-4-26b-a4b-it') {
        return makeJsonResponse(
          { error: { message: 'Please retry in 30s.' } },
          429,
          { 'retry-after': '30' }
        );
      }

      return makeInteractionSuccessResponse(
        call.body.model,
        JSON.stringify({
          isSuspicious: false,
          score: 0.1,
          reasoning: 'Fallback succeeded.'
        })
      );
    });

    await analyzeWithGemini('https://site1.example', 'url', DEFAULT_SETTINGS, { requireReasoning: true });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].body.model, 'gemma-4-26b-a4b-it');
    assert.equal(calls[1].body.model, 'gemma-4-31b-it');

    await analyzeWithGemini('https://site2.example', 'url', DEFAULT_SETTINGS, { requireReasoning: true });
    assert.equal(calls.length, 3);
    assert.equal(calls[2].body.model, 'gemma-4-31b-it');

    resetRateLimitStateForTests();
    const t0 = Date.now();
    await markModelUnavailable('gemma-4-26b-a4b-it', 429, '60', undefined, t0);
    await markModelUnavailable('gemma-4-31b-it', 429, '45', undefined, t0);
    await markModelUnavailable('gemini-3.5-flash-lite', 503, null, undefined, t0);
    await markModelUnavailable('gemini-3.1-flash-lite', 404, null, undefined, t0);
    await markModelUnavailable('gemini-4-hydrogen', 429, '90', undefined, t0);

    const selected = await selectModelsForAttempt(GENERATIVE_MODELS, t0 + 1_000);
    assert.equal(selected.length, 1);
    assert.equal(selected[0].id, 'gemini-3.5-flash-lite');
  });
});

describe('Caching and in-flight request deduplication', () => {
  it('reuses safe domain URL cache across paths while isolating multi-tenant hosts', async () => {
    const calls = installFetchMock(() =>
      makeJsonResponse({
        answers: {
          is_suspicious: { type: 'noul', noul: 0.04, confidence: 0.96 },
          risk_level: { type: 'score', score: 0.1, confidence: 0.97 }
        }
      })
    );

    const first = await analyze('https://bbc.co.uk/news/a', 'url', {
      url: 'https://bbc.co.uk/news/a'
    });
    const second = await analyze('https://bbc.co.uk/news/b', 'url', {
      url: 'https://bbc.co.uk/news/b'
    });

    assert.equal(first.isSuspicious, false);
    assert.equal(second.isSuspicious, false);
    assert.equal(calls.length, 1);

    await analyze('https://sites.google.com/view/site-a', 'url', {
      url: 'https://sites.google.com/view/site-a'
    });
    await analyze('https://sites.google.com/view/site-b', 'url', {
      url: 'https://sites.google.com/view/site-b'
    });
    assert.equal(calls.length, 3);

    const keyA = buildCacheKey({
      type: 'url',
      content: 'https://sites.google.com/view/site-a',
      provider: 'gemini',
      language: 'en-US'
    });
    const keyB = buildCacheKey({
      type: 'url',
      content: 'https://sites.google.com/view/site-b',
      provider: 'gemini',
      language: 'en-US'
    });
    assert.notEqual(keyA, keyB);
  });

  it('caches content scans, re-evaluates threshold on cache hit, deduplicates concurrent calls, and honors bypassCache', async () => {
    let fetchCount = 0;
    let stage2Count = 0;
    installFetchMock(async (call) => {
      fetchCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 15));
      if (call.url.endsWith('/decisions')) {
        return makeJsonResponse({
          answers: {
            is_suspicious: { type: 'noul', noul: 0.55, confidence: 0.85 },
            risk_level: { type: 'score', score: 1.5, confidence: 0.85 }
          }
        });
      }
      stage2Count += 1;
      return makeInteractionSuccessResponse(
        call.body.model,
        JSON.stringify({
          isSuspicious: true,
          score: 0.6,
          reasoning: `Scan #${stage2Count}`
        })
      );
    });

    const [resA, resB] = await Promise.all([
      analyze('Buy gift cards urgently to verify account', 'content', {
        url: 'https://example.org/promo'
      }),
      analyze('Buy gift cards urgently to verify account', 'content', {
        url: 'https://example.org/promo'
      })
    ]);

    assert.equal(fetchCount, 2);
    assert.equal(resA.isSuspicious, true);
    assert.equal(resB.isSuspicious, true);
    assert.equal(resA.score, 0.6);

    storageStore.aiSettings = { ...DEFAULT_SETTINGS, warningThreshold: 0.7 };
    const cachedReEvaluated = await analyze('Buy gift cards urgently to verify account', 'content', {
      url: 'https://example.org/promo'
    });
    assert.equal(fetchCount, 2);
    assert.equal(cachedReEvaluated.score, 0.6);
    assert.equal(cachedReEvaluated.isSuspicious, false);

    const fresh = await analyze('Buy gift cards urgently to verify account', 'content', {
      url: 'https://example.org/promo',
      bypassCache: true,
      requireReasoning: true
    });
    assert.equal(fetchCount, 3);
    assert.equal(fresh.reasoning, 'Scan #2');
  });
});

describe('Chrome Built-in AI (LanguageModel API)', () => {
  it('checks LanguageModel.availability() across available, downloadable, and unavailable states', async () => {
    let status = 'available';
    (globalThis as Record<string, unknown>).LanguageModel = {
      availability: async () => status,
      create: async () => ({ prompt: async () => '{}' })
    };

    assert.equal(await isNanoAvailable(), true);
    status = 'downloadable';
    assert.equal(await isNanoAvailable(), true);
    status = 'unavailable';
    assert.equal(await isNanoAvailable(), false);
  });

  it('creates LanguageModel session with initialPrompts and sends responseConstraint schema', async () => {
    let capturedCreateOptions: unknown;
    let capturedPromptInput: string | undefined;
    let capturedPromptOptions: unknown;

    (globalThis as Record<string, unknown>).LanguageModel = {
      availability: async () => 'available',
      create: async (options?: unknown) => {
        capturedCreateOptions = options;
        return {
          prompt: async (input: string, promptOptions?: unknown) => {
            capturedPromptInput = input;
            capturedPromptOptions = promptOptions;
            return JSON.stringify({
              isSuspicious: false,
              score: 0.12,
              reasoning: 'Local LanguageModel verified safe page.'
            });
          }
        };
      }
    };

    const result = await analyzeWithNano(
      'Welcome to our local bakery site.',
      'content',
      { ...DEFAULT_SETTINGS, provider: 'nano' },
      { url: 'https://bakery.example' }
    );

    assert.deepEqual(capturedCreateOptions, {
      initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }]
    });
    assert.ok(capturedPromptInput?.includes('Page URL: "https://bakery.example"'));
    assert.deepEqual(capturedPromptOptions, {
      responseConstraint: AI_RESPONSE_JSON_SCHEMA
    });
    assert.equal(result.isSuspicious, false);
    assert.equal(result.score, 0.12);
    assert.equal(result.reasoning, 'Local LanguageModel verified safe page.');
  });

  it('falls back to legacy globalThis.ai.languageModel when LanguageModel global is absent', async () => {
    let legacyPromptText = '';
    (globalThis as Record<string, unknown>).ai = {
      languageModel: {
        create: async () => ({
          prompt: async (text: string) => {
            legacyPromptText = text;
            return JSON.stringify({
              isSuspicious: true,
              score: 0.88,
              reasoning: 'Phishing warning from legacy Nano fallback.'
            });
          }
        })
      }
    };

    assert.equal(await isNanoAvailable(), true);
    const result = await analyzeWithNano('https://fake-bank-login.example', 'url', {
      ...DEFAULT_SETTINGS,
      provider: 'nano'
    });

    assert.ok(legacyPromptText.includes(SYSTEM_PROMPT));
    assert.equal(result.isSuspicious, true);
    assert.equal(result.score, 0.88);
    assert.equal(result.reasoning, 'Phishing warning from legacy Nano fallback.');
  });
});
