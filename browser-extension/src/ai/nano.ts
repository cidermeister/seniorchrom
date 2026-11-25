import type { AIResponse, AISettings, AnalyzeOptions } from './types';
import {
  AI_RESPONSE_JSON_SCHEMA,
  SYSTEM_PROMPT,
  getContentPrompt,
  getUrlPrompt
} from './prompts';
import { parseAIResponseJson } from './gemini';

export interface NanoSession {
  prompt: (text: string, options?: { responseConstraint?: unknown }) => Promise<string>;
  destroy?: () => void;
}

interface LanguageModelInitialPrompt {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LanguageModelAPI {
  availability?: () => Promise<string>;
  create: (options?: { initialPrompts?: LanguageModelInitialPrompt[] }) => Promise<NanoSession>;
}

interface LegacyBrowserAI {
  languageModel?: {
    create: (options?: { systemPrompt?: string }) => Promise<NanoSession>;
  };
  assistant?: {
    create: (options?: { systemPrompt?: string }) => Promise<NanoSession>;
  };
  createTextSession?: () => Promise<NanoSession>;
}

declare global {
  // eslint-disable-next-line no-var
  var LanguageModel: LanguageModelAPI | undefined;
  // eslint-disable-next-line no-var
  var ai: LegacyBrowserAI | undefined;
}

let nanoSession: NanoSession | null = null;
let nanoSessionSupportsConstraint = false;

export async function isNanoAvailable(): Promise<boolean> {
  if (globalThis.LanguageModel?.availability) {
    try {
      const availability = await globalThis.LanguageModel.availability();
      return availability !== 'unavailable' && availability !== 'no';
    } catch {
      return false;
    }
  }

  const aiObj = globalThis.ai;
  return !!aiObj && (!!aiObj.languageModel || !!aiObj.assistant || !!aiObj.createTextSession);
}

export async function initNanoSession(): Promise<NanoSession> {
  if (nanoSession) return nanoSession;

  if (globalThis.LanguageModel?.create) {
    try {
      nanoSession = await globalThis.LanguageModel.create({
        initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }]
      });
    } catch {
      nanoSession = await globalThis.LanguageModel.create();
    }
    nanoSessionSupportsConstraint = true;
    return nanoSession;
  }

  const aiObj = globalThis.ai;
  const legacyOptions = {
    systemPrompt: SYSTEM_PROMPT
  };

  if (aiObj?.languageModel?.create) {
    try {
      nanoSession = await aiObj.languageModel.create(legacyOptions);
    } catch {
      nanoSession = await aiObj.languageModel.create();
    }
  } else if (aiObj?.assistant?.create) {
    try {
      nanoSession = await aiObj.assistant.create(legacyOptions);
    } catch {
      nanoSession = await aiObj.assistant.create();
    }
  } else if (aiObj?.createTextSession) {
    nanoSession = await aiObj.createTextSession();
  } else {
    throw new Error('Gemini Nano is not available in this browser context.');
  }

  nanoSessionSupportsConstraint = false;
  return nanoSession;
}

export async function analyzeWithNano(
  content: string,
  type: 'url' | 'content',
  settings?: AISettings,
  options?: AnalyzeOptions
): Promise<AIResponse> {
  try {
    const session = await initNanoSession();
    const basePrompt =
      type === 'url'
        ? getUrlPrompt(content, settings?.language)
        : getContentPrompt(content, settings?.language, options?.url);

    let resultString: string;
    if (nanoSessionSupportsConstraint) {
      try {
        resultString = await session.prompt(basePrompt, {
          responseConstraint: AI_RESPONSE_JSON_SCHEMA
        });
      } catch {
        resultString = await session.prompt(`${SYSTEM_PROMPT}\n\nTask:\n${basePrompt}`);
      }
    } else {
      resultString = await session.prompt(`${SYSTEM_PROMPT}\n\nTask:\n${basePrompt}`);
    }

    try {
      return parseAIResponseJson(resultString);
    } catch {
      console.error('Failed to parse Nano response as JSON:', resultString);
      return {
        isSuspicious: true,
        score: 0.8,
        reasoning:
          'AI analysis completed, but failed to return structured response. Treating as potentially suspicious.'
      };
    }
  } catch (error) {
    console.error('Nano AI Error:', error);
    throw error;
  }
}

export function resetNanoSessionForTests(): void {
  nanoSession = null;
  nanoSessionSupportsConstraint = false;
}
