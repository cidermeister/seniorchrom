import type { AIResponse } from './types';
import { SYSTEM_PROMPT, getUrlPrompt, getContentPrompt } from './prompts';

// Declare the experimental ai for TypeScript on globalThis
declare global {
  // eslint-disable-next-line no-var
  var ai: {
    languageModel?: {
      create: (options?: any) => Promise<{ prompt: (text: string) => Promise<string> }>;
    };
    assistant?: {
      create: (options?: any) => Promise<{ prompt: (text: string) => Promise<string> }>;
    };
    createTextSession?: () => Promise<any>;
  } | undefined;
}

let nanoSession: any = null;

export async function isNanoAvailable(): Promise<boolean> {
  const aiObj = globalThis.ai;
  return !!aiObj && (!!aiObj.languageModel || !!aiObj.assistant || !!aiObj.createTextSession);
}

export async function initNanoSession() {
  if (nanoSession) return nanoSession;

  const aiObj = globalThis.ai;

  // Try to pass the system prompt as initial context if supported by the local API
  const options = {
      systemPrompt: SYSTEM_PROMPT
  };

  if (aiObj?.languageModel?.create) {
    // Newer API might support systemPrompt configuration
    try {
        nanoSession = await aiObj.languageModel.create(options);
    } catch(e) {
        nanoSession = await aiObj.languageModel.create();
    }
  } else if (aiObj?.assistant?.create) {
    try {
        nanoSession = await aiObj.assistant.create(options);
    } catch(e) {
        nanoSession = await aiObj.assistant.create();
    }
  } else if (aiObj?.createTextSession) {
    nanoSession = await aiObj.createTextSession();
  } else {
    throw new Error('Gemini Nano is not available in this browser context.');
  }

  return nanoSession;
}

export async function analyzeWithNano(content: string, type: 'url' | 'content'): Promise<AIResponse> {
  try {
    const session = await initNanoSession();

    // For Nano, since system prompt injection isn't always reliable across experimental versions,
    // we prepend the system prompt instructions directly to the user prompt just in case.
    const basePrompt = type === 'url' ? getUrlPrompt(content) : getContentPrompt(content);
    const combinedPrompt = `${SYSTEM_PROMPT}\n\nTask:\n${basePrompt}`;

    const resultString = await session.prompt(combinedPrompt);

    try {
      // Clean up potential markdown formatting from AI output
      const cleanJson = resultString.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(cleanJson) as AIResponse;
      return result;
    } catch (parseError) {
      console.error("Failed to parse Nano response as JSON:", resultString);
      return {
        isSuspicious: true, // Default to cautious
        score: 0.8,
        reasoning: "AI analysis completed, but failed to return structured response. Treating as potentially suspicious."
      };
    }
  } catch (error: any) {
    console.error("Nano AI Error:", error);
    throw error;
  }
}
