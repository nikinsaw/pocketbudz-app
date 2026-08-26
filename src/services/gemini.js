import { GEMINI_API_KEY } from '@env';

// Verified against the live Gemini API docs (ai.google.dev/api/generate-content
// and ai.google.dev/gemini-api/docs/models) rather than assumed:
// - endpoint takes the model id in the path, POST .../models/{model}:generateContent
// - auth via the x-goog-api-key header (avoids the key ending up in URL/logs)
// - generated text lives at candidates[0].content.parts[0].text
const MODEL = 'gemini-3.5-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export class AIUnavailableError extends Error {
  constructor(reason, detail) {
    super(detail || reason);
    this.name = 'AIUnavailableError';
    this.reason = reason;
    this.detail = detail;
  }
}

// Plain fetch, no SDK. Callers pass either a bare `prompt` for a free-text
// answer, or add `responseSchema` to force structured JSON output. `file`
// (optional) is { mimeType, base64 } for image/PDF understanding — sent as
// an inline_data part alongside the text (field names verified against the
// live generateContent docs: snake_case inline_data/mime_type, not camelCase).
export async function callGemini({ prompt, systemInstruction, responseSchema, file }) {
  if (!GEMINI_API_KEY) {
    throw new AIUnavailableError('missing-key');
  }

  const parts = [{ text: prompt }];
  if (file) {
    parts.push({ inline_data: { mime_type: file.mimeType, data: file.base64 } });
  }

  const body = {
    contents: [{ role: 'user', parts }],
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
    let apiMessage = '';
    try {
      const errorBody = await response.json();
      apiMessage = errorBody?.error?.message || '';
    } catch (parseError) {
      // response body wasn't JSON — nothing more to extract.
    }
    // Logged so the actual cause shows up in the Metro/device console —
    // the UI only ever shows a generic message, this is for debugging.
    console.error(`[Gemini] ${response.status} ${response.statusText}: ${apiMessage}`);
    throw new AIUnavailableError(`api-error-${response.status}`, apiMessage);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    console.error('[Gemini] empty response, finishReason:', candidate?.finishReason, data);
    throw new AIUnavailableError('empty-response', candidate?.finishReason);
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
      case 'api-error-400':
        return 'The request to Gemini was malformed — this is a bug, not a you problem.';
      case 'api-error-401':
      case 'api-error-403':
        return "That API key isn't valid — check GEMINI_API_KEY in your .env file.";
      case 'api-error-404':
        return "Gemini couldn't find that model — it may have been renamed or retired.";
      case 'api-error-429':
        return "You've hit the free-tier rate limit — wait a bit and try again.";
      case 'empty-response':
        return error.detail && error.detail !== 'STOP'
          ? `Gemini declined to answer (${error.detail.toLowerCase()}) — try rephrasing.`
          : 'Gemini returned an empty response — try again.';
      default:
        return 'AI is temporarily unavailable — try again in a moment.';
    }
  }
  return 'Something went wrong — try again.';
}
