// How the app asks for AI answers. The Gemini API key is NOT in the app: requests go to the
// PocketBudz server (POST /ai/generate), which holds the key, requires sign-in, enforces a
// daily limit per person, and calls Gemini. Kept free of the app's wiring (no React Native
// imports) so it can be tested against the real server; services/gemini.js binds it to the
// app's API client.

export class AIUnavailableError extends Error {
  constructor(reason, detail) {
    super(detail || reason);
    this.name = 'AIUnavailableError';
    this.reason = reason;
    this.detail = detail;
  }
}

// Turns a failed request into the reason the rest of the app understands.
//   offline           no connection to the server
//   sign-in-required  not signed in (or the session ended)
//   daily-limit       today's allowance is used up (the message is the server's, with the number)
//   not-configured    the server has no Gemini key / AI is switched off
//   unreachable       the server couldn't reach Gemini
//   api-error-<code>  Gemini itself refused (429 = busy, others = a problem on our side)
//   empty-response    Gemini answered with nothing (detail = why, e.g. SAFETY)
function toUnavailable(error) {
  const status = error?.status;
  const reason = error?.data?.reason;
  if (status === 0) {
    return new AIUnavailableError('offline');
  }
  if (status === 401) {
    return new AIUnavailableError('sign-in-required');
  }
  if (reason === 'daily-limit') {
    return new AIUnavailableError('daily-limit', error.message);
  }
  if (typeof reason === 'string') {
    return new AIUnavailableError(reason, error.data.detail);
  }
  return new AIUnavailableError(status ? `api-error-${status}` : 'unreachable');
}

// `api` is the app's API client. Callers pass either a bare `prompt` for a free-text answer,
// or add `responseSchema` to force structured JSON; `file` ({ mimeType, base64 }) is an image
// or PDF to read. Resolves with the answer text.
// Gemini can take a long time (a real call took ~50 s when Google was busy). The server gives
// up on Google after 60 s, so the phone waits a little longer than that - it must hear the
// server's verdict, not abort first and leave the person charged for an answer they never got.
export const AI_REQUEST_TIMEOUT_MS = 75000;

export function createCallGemini(api) {
  return async function callGemini({ prompt, systemInstruction, responseSchema, file }) {
    try {
      const { text } = await api.request('/ai/generate', {
        method: 'POST',
        body: { prompt, systemInstruction, responseSchema, file },
        timeoutMs: AI_REQUEST_TIMEOUT_MS,
      });
      return text;
    } catch (error) {
      throw toUnavailable(error);
    }
  };
}

// One message for every AI feature, so the same failure reads the same everywhere.
export function describeAIError(error) {
  if (error instanceof AIUnavailableError) {
    switch (error.reason) {
      case 'offline':
        return 'AI features need internet — check your connection and try again.';
      case 'sign-in-required':
        return 'Sign in with Google to use AI features.';
      case 'daily-limit':
        // The server's own sentence, which names the limit and when it resets.
        return error.detail || 'You’ve used today’s AI requests. They reset at midnight.';
      case 'not-configured':
        return 'AI isn’t available right now.';
      case 'api-error-429':
        return 'AI is busy right now — wait a moment and try again.';
      case 'empty-response':
        return error.detail && error.detail !== 'STOP'
          ? `The AI declined to answer (${String(error.detail).toLowerCase()}) — try rephrasing.`
          : 'The AI returned an empty response — try again.';
      default:
        return 'AI is temporarily unavailable — try again in a moment.';
    }
  }
  return 'Something went wrong — try again.';
}
