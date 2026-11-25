export const SYSTEM_PROMPT = `You are an expert cybersecurity and consumer protection AI.
Your goal is to protect users from scams, phishing, overpaying, and false information, keeping them safe online.

CRITICAL INSTRUCTIONS:
1. SCAMS & FALSE INFORMATION: Strictly identify sites with malicious intent, phishing, or spreading false information as HIGH RISK (isSuspicious: true, score > 0.7).
2. OVERCHARGING & PREDATORY RESELLERS: Sites that charge a premium for services that are normally free or much cheaper elsewhere should be flagged. If they are highly deceptive about being the official provider, mark them as high risk.
3. LEGITIMATE BUT SALESY: Websites that are legitimate businesses but use aggressive sales tactics (e.g., upsells, strong marketing language) should NOT be flagged as high risk scams. Give them a middling to low score (e.g., 0.3 to 0.5) and isSuspicious: false unless they cross the line into outright deception.
4. SAFE WEBSITES: Official state portals (.gov, .admin.ch, .europa.eu), primary service providers, and explicitly trusted sites like "elderton.ch" and "accounts.google.com" must be marked as safe (isSuspicious: false, low score).
5. ONLINE BANKING: Genuine online banking portals and standard secure subdomains (e.g., "internetbanking.tsb.co.uk", "chase.com") must be marked as safe. However, strictly verify that the domain name exactly matches the official bank's domain without any typos or lookalike characters. Lookalikes must be flagged as HIGH RISK phishing.

Always reply with valid JSON only, in this exact format: {"isSuspicious": boolean, "score": number (0 to 1), "reasoning": "short explanation"}`;

export const getUrlPrompt = (url: string, language?: string) => `Analyze this URL to determine if it belongs to a scam, phishing, deceptive reseller, or otherwise dangerous website.
URL: "${url}"
Evaluate the domain name and path. Identify if it looks like a legitimate domain, a known trusted site (e.g., official government sites, "elderton.ch", "accounts.google.com"), or a genuine online banking portal (e.g., "internetbanking.tsb.co.uk"). Ensure online banking URLs are exact domain matches to avoid typosquatting. Reply strictly with the requested JSON format.
${language ? `CRITICAL: You MUST write the "reasoning" value in the following language: ${language}` : ''}`;

export const getContentPrompt = (content: string, language?: string, url?: string) => `Analyze this webpage content to determine if it is a scam, phishing attempt, spreading false information, or a deceptive reseller overcharging for services.
Look for:
- Outright scams, false information, or phishing (high risk).
- Prices that are significantly higher than normal without clear justification.
- Hidden disclaimers about being an "independent processing agent" when pretending to be official.
- Legitimate but "salesy" marketing should receive a middling/lower score, not be flagged as a high-risk scam.
- Official providers or well-known safe content (including genuine online banking portals) should be marked safe.

${url ? `Page URL: "${url}"\n` : ''}Content snippet: "${content.substring(0, 4000)}"
Reply strictly with the requested JSON format.
${language ? `CRITICAL: You MUST write the "reasoning" value in the following language: ${language}` : ''}`;

export const AI_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    isSuspicious: { type: 'boolean' },
    score: { type: 'number' },
    reasoning: { type: 'string' }
  },
  required: ['isSuspicious', 'score', 'reasoning']
} as const;

export interface DecisionNoulQuestion {
  type: 'noul';
  instructions: string;
}

export interface DecisionScoreQuestion {
  type: 'score';
  instructions: string;
  criteria: string[];
}

export function getDecisionInput(content: string, type: 'url' | 'content', url?: string): string {
  if (type === 'url') {
    return `URL to evaluate: ${content}`;
  }

  const snippet = content.substring(0, 4000);
  if (url) {
    return `Page URL: ${url}\n\nWebpage content snippet:\n${snippet}`;
  }
  return `Webpage content snippet:\n${snippet}`;
}

export function getDecisionQuestions(type: 'url' | 'content'): {
  is_suspicious: DecisionNoulQuestion;
  risk_level: DecisionScoreQuestion;
} {
  const subject = type === 'url' ? 'URL' : 'webpage content';
  return {
    is_suspicious: {
      type: 'noul',
      instructions:
        `Is this ${subject} a scam, phishing site, typosquatted or lookalike banking/official domain, deceptive/predatory overcharging reseller, or harmful misinformation? ` +
        `Answer no for official state portals (.gov, .admin.ch, .europa.eu), trusted sites ("elderton.ch", "accounts.google.com"), genuine online banking portals with exact official domains (e.g., "internetbanking.tsb.co.uk", "chase.com"), primary service providers, and legitimate businesses using aggressive sales or upsell marketing without deception.`
    },
    risk_level: {
      type: 'score',
      instructions: `Classify the consumer safety risk of this ${subject} using the rubric.`,
      criteria: [
        'Safe: Official government portals (.gov, .admin.ch, .europa.eu), exact-match genuine online banking portals (e.g., internetbanking.tsb.co.uk, chase.com), explicitly trusted sites (elderton.ch, accounts.google.com), primary service providers, or benign everyday websites.',
        'Legitimate but salesy: Real business using aggressive marketing, strong sales language, or upsells without outright deception or fraud.',
        'Predatory reseller or questionable: Intermediary charging excessive fees for services normally free or much cheaper elsewhere, or hiding "independent processing agent" disclaimers while mimicking official providers.',
        'High risk scam, phishing, or misinformation: Outright scam, credential theft, phishing, typosquatted or lookalike banking/official domain, or harmful false information.'
      ]
    }
  };
}
