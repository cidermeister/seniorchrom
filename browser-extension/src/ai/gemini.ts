import type { AIResponse, AISettings } from './types';
import { SYSTEM_PROMPT, getUrlPrompt, getContentPrompt } from './prompts';

export async function analyzeWithGemini(content: string, type: 'url' | 'content', settings: AISettings): Promise<AIResponse> {
  if (!settings.geminiApiKey) {
    throw new Error("Gemini API Key is not configured. Please add an API Key in settings.");
  }

  const promptText = type === 'url' ? getUrlPrompt(content, settings.language) : getContentPrompt(content, settings.language);

  const models = ['gemini-3.5-flash-lite', 'gemma-4-31b'];
  let lastError: any;

  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.geminiApiKey.trim()}`;

    try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: SYSTEM_PROMPT }]
            },
            contents: [{
              parts: [{ text: promptText }]
            }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json"
            }
          })
        });

        if (!response.ok) {
          let errorMsg = `Gemini API Error (${model}): ${response.status} ${response.statusText}`;
          try {
             const errData = await response.json();
             if (errData.error && errData.error.message) {
                 errorMsg = `Gemini API Error (${model}): ${errData.error.message}`;
             }
          } catch(e) {}

          if (response.status === 404) {
              errorMsg = `Gemini API Error 404 (${model}): The model might not exist or may be misspelled.`;
          }

          throw new Error(errorMsg);
        }

        const data = await response.json();
        const resultString = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        try {
          const cleanJson = resultString.replace(/```json/gi, '').replace(/```/g, '').trim();
          const result = JSON.parse(cleanJson) as AIResponse;

          if (typeof result.isSuspicious !== 'boolean' || typeof result.score !== 'number') {
              throw new Error("Invalid response format");
          }

          return {
              isSuspicious: result.isSuspicious,
              score: result.score,
              reasoning: result.reasoning || "No reasoning provided."
          };
        } catch (parseError) {
          console.error(`Failed to parse Gemini response as JSON (${model}):`, resultString);
          return {
            isSuspicious: true,
            score: 0.8,
            reasoning: "AI analysis completed, but failed to return a valid structured response. Treating as potentially suspicious."
          };
        }
    } catch (err: any) {
        console.warn(`Gemini Fetch Error for model ${model}:`, err);
        lastError = err;
    }
  }

  throw new Error(lastError?.message || "Failed to connect to Gemini API after trying all fallback models.");
}
