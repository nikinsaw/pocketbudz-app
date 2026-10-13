// The only place that talks to Google's Gemini API, and the only place the API key is used.
// A port of the call the app used to make itself (src/services/gemini.js), with the HTTP
// call injectable so every failure mode can be tested without reaching Google.
//
// Request/response shapes follow the generateContent docs:
//  - the model id is in the path; auth is the x-goog-api-key header (so the key never ends
//    up in a URL or a log line)
//  - files go in an inline_data part (snake_case)
//  - the answer is candidates[0].content.parts[0].text

export interface GenerateInput {
  prompt: string;
  systemInstruction?: string;
  responseSchema?: Record<string, unknown>;
  file?: { mimeType: string; base64: string };
}

export type Gemini = (input: GenerateInput) => Promise<string>;

export type GeminiFailure =
  | 'not-configured' // no API key on this server
  | 'unreachable' // network error or timeout talking to Google
  | 'upstream' // Google answered with an HTTP error
  | 'empty'; // Google answered 200 but with no text (e.g. blocked)

export class GeminiError extends Error {
  constructor(
    public readonly kind: GeminiFailure,
    message: string,
    // The HTTP status Google returned (kind 'upstream') or the finish reason (kind 'empty').
    public readonly detail?: string | number,
  ) {
    super(message);
  }
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export function createGemini(options: {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Gemini {
  const { apiKey, model, fetchImpl = fetch, timeoutMs = 60_000 } = options;

  return async (input) => {
    if (!apiKey) {
      throw new GeminiError('not-configured', 'AI is not set up on this server');
    }

    const parts: unknown[] = [{ text: input.prompt }];
    if (input.file) {
      parts.push({ inline_data: { mime_type: input.file.mimeType, data: input.file.base64 } });
    }
    const body: Record<string, unknown> = { contents: [{ role: 'user', parts }] };
    if (input.systemInstruction) {
      body.systemInstruction = { parts: [{ text: input.systemInstruction }] };
    }
    if (input.responseSchema) {
      body.generationConfig = { responseMimeType: 'application/json', responseSchema: input.responseSchema };
    }

    let response: Response;
    try {
      response = await fetchImpl(`${ENDPOINT}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new GeminiError('unreachable', 'Could not reach the AI service');
    }

    if (!response.ok) {
      let apiMessage = '';
      try {
        apiMessage = ((await response.json()) as { error?: { message?: string } })?.error?.message ?? '';
      } catch {
        // Not JSON - nothing more to say.
      }
      throw new GeminiError('upstream', apiMessage || `AI service error ${response.status}`, response.status);
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: unknown }[] }; finishReason?: string }[];
    };
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
      throw new GeminiError('empty', 'The AI returned no answer', candidate?.finishReason);
    }
    return text;
  };
}
