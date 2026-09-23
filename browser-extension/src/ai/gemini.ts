import type { AIResponse, AISettings } from './types';
import { SYSTEM_PROMPT, getUrlPrompt, getContentPrompt } from './prompts';

export async function analyzeWithGemini(content: string, type: 'url' | 'content', settings: AISettings): Promise<AIResponse> {
  if (!settings.geminiApiKey) {
    throw new Error("Gemini API Key is not configured. Please add an API Key in settings.");
  }

  const promptText = type === 'url' ? getUrlPrompt(content) : getContentPrompt(content);

  // Use Gemini 1.5 Flash as it is fast and cheap/free tier
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${settings.geminiApiKey}`;

  try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: {
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
        throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
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
        console.error("Failed to parse Gemini response as JSON:", resultString);
        return {
          isSuspicious: true,
          score: 0.8,
          reasoning: "AI analysis completed, but failed to return a valid structured response. Treating as potentially suspicious."
        };
      }
  } catch (err: any) {
      console.error("Gemini Fetch Error:", err);
      throw new Error(`Failed to connect to Gemini API: ${err.message}`);
  }
}
