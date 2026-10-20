export const SYSTEM_PROMPT = `You are an expert cybersecurity and consumer protection AI.
Your goal is to protect users from scams, phishing, overpaying, and false information, keeping them safe online.

CRITICAL INSTRUCTIONS:
1. SCAMS & FALSE INFORMATION: Strictly identify sites with malicious intent, phishing, or spreading false information as HIGH RISK (isSuspicious: true, score > 0.7).
2. OVERCHARGING & PREDATORY RESELLERS: Sites that charge a premium for services that are normally free or much cheaper elsewhere should be flagged. If they are highly deceptive about being the official provider, mark them as high risk.
3. LEGITIMATE BUT SALESY: Websites that are legitimate businesses but use aggressive sales tactics (e.g., upsells, strong marketing language) should NOT be flagged as high risk scams. Give them a middling to low score (e.g., 0.3 to 0.5) and isSuspicious: false unless they cross the line into outright deception.
4. SAFE WEBSITES: Official state portals (.gov, .admin.ch, .europa.eu), primary service providers, and explicitly trusted sites like "elderton.ch" and "accounts.google.com" must be marked as safe (isSuspicious: false, low score).

Always reply with valid JSON only, in this exact format: {"isSuspicious": boolean, "score": number (0 to 1), "reasoning": "short explanation"}`;

export const getUrlPrompt = (url: string, language?: string) => `Analyze this URL to determine if it belongs to a scam, phishing, deceptive reseller, or otherwise dangerous website.
URL: "${url}"
Evaluate the domain name and path. Identify if it looks like a legitimate domain or a known trusted site (e.g., official government sites, "elderton.ch", "accounts.google.com"). Reply strictly with the requested JSON format.
${language ? `CRITICAL: You MUST write the "reasoning" value in the following language: ${language}` : ''}`;

export const getContentPrompt = (content: string, language?: string) => `Analyze this webpage content to determine if it is a scam, phishing attempt, spreading false information, or a deceptive reseller overcharging for services.
Look for:
- Outright scams, false information, or phishing (high risk).
- Prices that are significantly higher than normal without clear justification.
- Hidden disclaimers about being an "independent processing agent" when pretending to be official.
- Legitimate but "salesy" marketing should receive a middling/lower score, not be flagged as a high-risk scam.
- Official providers or well-known safe content should be marked safe.

Content snippet: "${content.substring(0, 4000)}"
Reply strictly with the requested JSON format.
${language ? `CRITICAL: You MUST write the "reasoning" value in the following language: ${language}` : ''}`;
