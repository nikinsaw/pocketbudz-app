import { GEMINI_API_KEY } from '@env';

// Verified against the live Gemini API docs (ai.google.dev/api/generate-content
// and ai.google.dev/gemini-api/docs/models) rather than assumed:
// - endpoint takes the model id in the path, POST .../models/{model}:generateContent
// - auth via the x-goog-api-key header (avoids the key ending up in URL/logs)
// - generated text lives at candidates[0].content.parts[0].text
const MODEL = 'gemini-2.5-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export class AIUnavailableError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'AIUnavailableError';
    this.reason = reason;
  }
}

// Plain fetch, no SDK. Callers pass either a bare `prompt` for a free-text
// answer, or add `responseSchema` to force structured JSON output.
export async function callGemini({ prompt, systemInstruction, responseSchema }) {
  if (!GEMINI_API_KEY) {
    throw new AIUnavailableError('missing-key');
  }

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  if (responseSchema) {
    body.generationConfig = { responseMimeType: 'application/json', responseSchema };
  }

  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    // fetch rejects (rather than resolving with a bad status) on no
    // connectivity / DNS failure — this is the "offline" case.
    throw new AIUnavailableError('offline');
  }

  if (!response.ok) {
    throw new AIUnavailableError(`api-error-${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    throw new AIUnavailableError('empty-response');
  }
  return text;
}

// Shared by both AI features so the same failure looks the same everywhere.
export function describeAIError(error) {
  if (error instanceof AIUnavailableError) {
    switch (error.reason) {
      case 'missing-key':
        return "AI features aren't set up yet — add a Gemini API key to use them.";
      case 'offline':
        return 'AI features need internet — check your connection and try again.';
      default:
        return 'AI is temporarily unavailable — try again in a moment.';
    }
  }
  return 'Something went wrong — try again.';
}
