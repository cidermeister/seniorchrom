import type { AIResponse } from './types';

// Declare the experimental ai for TypeScript on globalThis
declare global {
  // eslint-disable-next-line no-var
  var ai: {
    languageModel?: {
      create: () => Promise<{ prompt: (text: string) => Promise<string> }>;
    };
    assistant?: {
      create: () => Promise<{ prompt: (text: string) => Promise<string> }>;
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

  if (aiObj?.languageModel?.create) {
    nanoSession = await aiObj.languageModel.create();
  } else if (aiObj?.assistant?.create) {
    nanoSession = await aiObj.assistant.create();
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

    let promptText = '';
    if (type === 'url') {
      promptText = `Analyze this URL to determine if it belongs to a scam, phishing, or deceptive website.
URL: "${content}"
Reply strictly with a JSON object in this exact format, with no extra text: {"isSuspicious": boolean, "score": number (0 to 1), "reasoning": "short explanation"}`;
    } else {
       promptText = `Analyze this webpage content to determine if it is a scam, phishing attempt, or overcharging for a free/cheap service (e.g. EHIC, Vignette).
Content snippet: "${content.substring(0, 4000)}"
Reply strictly with a JSON object in this exact format, with no extra text: {"isSuspicious": boolean, "score": number (0 to 1), "reasoning": "short explanation"}`;
    }

    const resultString = await session.prompt(promptText);

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
