import type { AIResponse, AISettings, AnalyzeOptions } from './types';
import {
  AI_RESPONSE_JSON_SCHEMA,
  SYSTEM_PROMPT,
  getContentPrompt,
  getDecisionInput,
  getDecisionQuestions,
  getUrlPrompt
} from './prompts';
import {
  clearModelCooldown,
  isModelCoolingDown,
  markModelUnavailable,
  selectModelsForAttempt
} from './rateLimit';

export const DECISION_MODEL = 'gemini-decision-1';
export const INTERACTIONS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1/interactions';
export const INTERACTIONS_API_REVISION = '2026-05-20';

export interface GenerativeModelConfig {
  id: string;
  supportsTemperature: boolean;
  thinkingLevel?: 'minimal' | 'low';
}

export const GENERATIVE_MODELS: readonly GenerativeModelConfig[] = [
  { id: 'gemma-4-26b-a4b-it', supportsTemperature: true, thinkingLevel: 'minimal' },
  { id: 'gemma-4-31b-it', supportsTemperature: true, thinkingLevel: 'minimal' },
  { id: 'gemini-3.5-flash-lite', supportsTemperature: false, thinkingLevel: 'minimal' },
  { id: 'gemini-3.1-flash-lite', supportsTemperature: true },
  { id: 'gemini-4-hydrogen', supportsTemperature: false, thinkingLevel: 'low' }
];

export interface DecisionScreeningResult {
  screeningScore: number;
  noulScore: number;
  rubricScore: number;
  minConfidence: number;
}

interface InteractionContentPart {
  type?: unknown;
  text?: unknown;
}

interface InteractionStep {
  type?: unknown;
  content?: InteractionContentPart[];
}

interface InteractionResponse {
  status?: unknown;
  error?: {
    message?: string;
  };
  output_text?: unknown;
  steps?: InteractionStep[];
}

interface DecisionsApiResponse {
  answers?: {
    is_suspicious?: {
      type?: string;
      noul?: unknown;
      confidence?: unknown;
    };
    risk_level?: {
      type?: string;
      score?: unknown;
      confidence?: unknown;
    };
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

async function buildHttpError(response: Response, modelId: string, prefix: string): Promise<Error> {
  let errorMsg = `${prefix} (${modelId}): ${response.status} ${response.statusText}`;
  try {
    const errData = (await response.json()) as { error?: { message?: string } };
    if (errData?.error?.message) {
      errorMsg = `${prefix} (${modelId}): ${errData.error.message}`;
    }
  } catch {
    // Ignore non-JSON error bodies
  }

  if (response.status === 404) {
    errorMsg = `${prefix} 404 (${modelId}): The model might not exist or may be misspelled.`;
  }

  await markModelUnavailable(
    modelId,
    response.status,
    response.headers?.get?.('retry-after') ?? null,
    errorMsg
  );

  return new Error(errorMsg);
}

export function buildInteractionPayload(model: GenerativeModelConfig, promptText: string) {
  const generationConfig: Record<string, unknown> = {};

  if (model.supportsTemperature) {
    generationConfig.temperature = 0.1;
  }

  if (model.thinkingLevel) {
    generationConfig.thinking_level = model.thinkingLevel;
  }

  return {
    model: model.id,
    system_instruction: SYSTEM_PROMPT,
    input: promptText,
    store: false,
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: AI_RESPONSE_JSON_SCHEMA
    },
    ...(Object.keys(generationConfig).length > 0 ? { generation_config: generationConfig } : {})
  };
}

export function extractInteractionText(data: unknown): string {
  const response = data as InteractionResponse | null | undefined;
  if (response?.status === 'failed') {
    throw new Error(response.error?.message || 'Gemini interaction failed');
  }

  const steps = response?.steps;
  if (Array.isArray(steps)) {
    const trailingTexts: string[] = [];
    let seenModelOutput = false;

    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i];
      if (step?.type === 'model_output') {
        seenModelOutput = true;
        if (Array.isArray(step.content)) {
          const stepText = step.content
            .filter(
              (part) =>
                (part?.type === 'text' || part?.type === undefined) && typeof part?.text === 'string'
            )
            .map((part) => part.text as string)
            .join('');
          if (stepText.length > 0) {
            trailingTexts.unshift(stepText);
          }
        }
      } else if (seenModelOutput) {
        break;
      }
    }

    if (trailingTexts.length > 0) {
      return trailingTexts.join('');
    }
  }

  if (typeof response?.output_text === 'string') {
    return response.output_text;
  }

  return '';
}

export function parseAIResponseJson(resultString: string): AIResponse {
  const cleanJson = resultString.replace(/```json/gi, '').replace(/```/g, '').trim();
  let parsed: unknown;

  try {
    parsed = JSON.parse(cleanJson);
  } catch {
    const match = cleanJson.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Failed to find JSON object in model response');
    }
    parsed = JSON.parse(match[0]);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid response format');
  }

  const candidate = parsed as Record<string, unknown>;
  if (
    typeof candidate.isSuspicious !== 'boolean' ||
    typeof candidate.score !== 'number' ||
    !Number.isFinite(candidate.score)
  ) {
    throw new Error('Invalid response format');
  }

  return {
    isSuspicious: candidate.isSuspicious,
    score: clamp01(candidate.score),
    reasoning:
      typeof candidate.reasoning === 'string' && candidate.reasoning.trim().length > 0
        ? candidate.reasoning.trim()
        : 'No reasoning provided.'
  };
}

export async function screenWithDecisionsApi(
  content: string,
  type: 'url' | 'content',
  apiKey: string,
  url?: string
): Promise<DecisionScreeningResult> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/decisions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      model: DECISION_MODEL,
      input: getDecisionInput(content, type, url),
      questions: getDecisionQuestions(type)
    })
  });

  if (!response.ok) {
    throw await buildHttpError(response, DECISION_MODEL, 'Gemini Decisions API Error');
  }

  const data = (await response.json()) as DecisionsApiResponse;
  const isSuspiciousAns = data?.answers?.is_suspicious;
  const riskLevelAns = data?.answers?.risk_level;

  if (
    typeof isSuspiciousAns?.noul !== 'number' ||
    !Number.isFinite(isSuspiciousAns.noul) ||
    typeof riskLevelAns?.score !== 'number' ||
    !Number.isFinite(riskLevelAns.score)
  ) {
    throw new Error('Invalid Decisions API response format');
  }

  await clearModelCooldown(DECISION_MODEL);

  const noulScore = clamp01(isSuspiciousAns.noul);
  const rubricScore = clamp01(riskLevelAns.score / 3);
  const screeningScore = Math.round(((noulScore + rubricScore) / 2) * 1000) / 1000;
  const noulConfidence =
    typeof isSuspiciousAns.confidence === 'number' && Number.isFinite(isSuspiciousAns.confidence)
      ? clamp01(isSuspiciousAns.confidence)
      : 1;
  const rubricConfidence =
    typeof riskLevelAns.confidence === 'number' && Number.isFinite(riskLevelAns.confidence)
      ? clamp01(riskLevelAns.confidence)
      : 1;

  return {
    screeningScore,
    noulScore,
    rubricScore,
    minConfidence: Math.min(noulConfidence, rubricConfidence)
  };
}

async function analyzeWithGenerativePool(promptText: string, apiKey: string): Promise<AIResponse> {
  const modelsToTry = await selectModelsForAttempt(GENERATIVE_MODELS);
  let lastError: unknown;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(INTERACTIONS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
          'Api-Revision': INTERACTIONS_API_REVISION
        },
        body: JSON.stringify(buildInteractionPayload(model, promptText))
      });

      if (!response.ok) {
        throw await buildHttpError(response, model.id, 'Gemini API Error');
      }

      const data = await response.json();
      const resultString = extractInteractionText(data);
      const parsed = parseAIResponseJson(resultString);

      await clearModelCooldown(model.id);
      return parsed;
    } catch (err) {
      console.warn(`Gemini Fetch Error for model ${model.id}:`, err);
      lastError = err;
    }
  }

  const message =
    lastError instanceof Error
      ? lastError.message
      : 'Failed to connect to Gemini API after trying all fallback models.';
  throw new Error(message);
}

export async function analyzeWithGemini(
  content: string,
  type: 'url' | 'content',
  settings: AISettings,
  options?: AnalyzeOptions
): Promise<AIResponse> {
  if (!settings.geminiApiKey) {
    throw new Error('Gemini API Key is not configured. Please add an API Key in settings.');
  }

  const apiKey = settings.geminiApiKey.trim();
  const threshold = settings.warningThreshold ?? 0.5;
  const promptText =
    type === 'url'
      ? getUrlPrompt(content, settings.language)
      : getContentPrompt(content, settings.language, options?.url);

  if (!options?.requireReasoning && !(await isModelCoolingDown(DECISION_MODEL))) {
    let screening: DecisionScreeningResult | null = null;
    try {
      screening = await screenWithDecisionsApi(content, type, apiKey, options?.url);
    } catch (err) {
      console.warn(`Decisions API screening error (${DECISION_MODEL}):`, err);
    }

    if (screening) {
      const { screeningScore, noulScore, rubricScore, minConfidence } = screening;
      const shouldEscalate =
        screeningScore >= threshold ||
        noulScore >= threshold ||
        rubricScore >= threshold ||
        (minConfidence < 0.7 && screeningScore >= Math.max(0.25, threshold - 0.15));

      if (!shouldEscalate) {
        return {
          isSuspicious: false,
          score: screeningScore,
          reasoning: 'No scam or phishing indicators detected.'
        };
      }

      try {
        return await analyzeWithGenerativePool(promptText, apiKey);
      } catch (stage2Err) {
        console.warn('Stage 2 generative explanation failed after screening escalation:', stage2Err);
        if (screeningScore >= threshold) {
          return {
            isSuspicious: true,
            score: screeningScore,
            reasoning:
              rubricScore >= 0.67
                ? 'Automated screening detected high-risk scam, phishing, or deceptive reseller patterns (detailed explanation temporarily unavailable due to API rate limits).'
                : 'Automated screening flagged potentially suspicious patterns on this page (detailed explanation temporarily unavailable due to API rate limits).'
          };
        }
        return {
          isSuspicious: false,
          score: screeningScore,
          reasoning: 'No confirmed scam indicators detected.'
        };
      }
    }
  }

  return analyzeWithGenerativePool(promptText, apiKey);
}
