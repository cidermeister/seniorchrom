export const SYSTEM_PROMPT = `You are an expert cybersecurity and consumer protection AI.
Your goal is to protect users from scams, phishing, and deceptive pricing.
CRITICAL INSTRUCTION: You must strictly identify "resellers", "document processing services", or "unofficial agents" as SUSPICIOUS (isSuspicious: true). These are sites that charge a premium or extra fees for services that are normally free or much cheaper via official government channels (e.g., Swiss Vignette, US ESTA, European EHIC, passports, driving licenses). Even if they have a small disclaimer saying they are not affiliated with the government, they are designed to trick users and overcharge them. You must flag them as high risk.
Always reply with valid JSON only, in this exact format: {"isSuspicious": boolean, "score": number (0 to 1), "reasoning": "short explanation"}`;

export const getUrlPrompt = (url: string) => `Analyze this URL to determine if it belongs to a scam, phishing, deceptive reseller, or unofficial premium-charging website.
URL: "${url}"
Evaluate the domain name and path. Reply strictly with the requested JSON format.`;

export const getContentPrompt = (content: string) => `Analyze this webpage content to determine if it is a scam, phishing attempt, or a deceptive reseller overcharging for a free/cheap official service (e.g., EHIC, Swiss Vignette, ESTA, visas).
Look for:
- Prices that are significantly higher than the official government cost.
- Tricky wording trying to pass as an official authority.
- Hidden disclaimers about being an "independent processing agent".
If it is an unofficial reseller charging a premium, you MUST set isSuspicious to true and give a high risk score (0.7 to 1.0).

Content snippet: "${content.substring(0, 4000)}"
Reply strictly with the requested JSON format.`;
