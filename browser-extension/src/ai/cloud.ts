import type { AIResponse, AISettings } from './types';

export async function analyzeWithCloud(content: string, type: 'url' | 'content', settings: AISettings): Promise<AIResponse> {
  if (!settings.cloudApiUrl) {
    throw new Error("Cloud API URL is not configured. Please add an API URL in settings.");
  }

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

  // Assuming LMStudio or OpenAI compatible endpoint
  // Standard format is http://localhost:1234/v1
  let endpoint = settings.cloudApiUrl;
  if (!endpoint.endsWith('/chat/completions')) {
      endpoint = endpoint.endsWith('/') ? endpoint + 'chat/completions' : endpoint + '/chat/completions';
  }

  try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.cloudApiKey ? { 'Authorization': `Bearer ${settings.cloudApiKey}` } : {})
        },
        body: JSON.stringify({
          // LMStudio usually needs a model specified, but can often default to the loaded one if "local-model" or anything is provided.
          model: "local-model",
          messages: [
            { role: "system", content: "You are a cybersecurity AI. Always reply with valid JSON only." },
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
        // Clean up potential markdown formatting from AI output
        const cleanJson = resultString.replace(/```json/gi, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson) as AIResponse;

        // Basic validation
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
          isSuspicious: true, // Default to cautious
          score: 0.8,
          reasoning: "AI analysis completed, but failed to return a valid structured response. Treating as potentially suspicious."
        };
      }
  } catch (err: any) {
      console.error("Cloud Fetch Error:", err);
      throw new Error(`Failed to connect to Cloud API: ${err.message}`);
  }
}
