import type { AIResponse, AISettings } from './types';
import { SYSTEM_PROMPT, getUrlPrompt, getContentPrompt } from './prompts';

export async function analyzeWithCloud(content: string, type: 'url' | 'content', settings: AISettings): Promise<AIResponse> {
  if (!settings.cloudApiUrl) {
    throw new Error("Cloud API URL is not configured. Please add an API URL in settings.");
  }

  const promptText = type === 'url' ? getUrlPrompt(content) : getContentPrompt(content);

  // Normalize LMStudio / OpenAI endpoint
  // Handles http://localhost:1234 or http://localhost:1234/
  let endpoint = settings.cloudApiUrl.trim();

  // Strip trailing slash first to make logic uniform
  if (endpoint.endsWith('/')) {
      endpoint = endpoint.slice(0, -1);
  }

  // If the user just typed the base domain/port, add /v1
  if (endpoint.match(/^https?:\/\/[^\/]+$/)) {
      endpoint += '/v1';
  }

  // Append /chat/completions if missing
  if (!endpoint.endsWith('/chat/completions')) {
      endpoint += '/chat/completions';
  }

  try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.cloudApiKey ? { 'Authorization': `Bearer ${settings.cloudApiKey}` } : {})
        },
        body: JSON.stringify({
          model: "local-model",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: promptText }
          ],
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`Cloud API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const resultString = data.choices?.[0]?.message?.content || '';

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
        console.error("Failed to parse Cloud response as JSON:", resultString);
        return {
          isSuspicious: true,
          score: 0.8,
          reasoning: "AI analysis completed, but failed to return a valid structured response. Treating as potentially suspicious."
        };
      }
  } catch (err: any) {
      console.error("Cloud Fetch Error:", err);
      throw new Error(`Failed to connect to Cloud API: ${err.message}`);
  }
}
