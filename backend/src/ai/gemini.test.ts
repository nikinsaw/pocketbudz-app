import { describe, expect, it, vi } from 'vitest';
import { GeminiError, createGemini } from './gemini.js';

const KEY = 'test-key-not-a-real-secret-123';
const reply = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
const answer = (text: string) => reply(200, { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] });

function make(fetchImpl: ReturnType<typeof vi.fn>, apiKey = KEY) {
  return createGemini({ apiKey, model: 'gemini-test', fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 200 });
}
const sent = (fetchImpl: ReturnType<typeof vi.fn>) => {
  const [url, init] = fetchImpl.mock.calls[0];
  return { url: String(url), init, body: JSON.parse(init.body as string) };
};

describe('request', () => {
  it('puts the model in the path and the key in a header - never in the URL', async () => {
    const f = vi.fn(async () => answer('hi'));
    await make(f)({ prompt: 'hello' });
    const { url, init } = sent(f);
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    expect(url).not.toContain(KEY);
    expect(init.headers['x-goog-api-key']).toBe(KEY);
    expect(init.method).toBe('POST');
  });

  it('sends a plain prompt as one user text part', async () => {
    const f = vi.fn(async () => answer('hi'));
    await make(f)({ prompt: 'hello' });
    expect(sent(f).body).toEqual({ contents: [{ role: 'user', parts: [{ text: 'hello' }] }] });
  });

  it('sends a file as an inline_data part, a system instruction, and a JSON schema', async () => {
    const f = vi.fn(async () => answer('{}'));
    await make(f)({
      prompt: 'read this',
      systemInstruction: 'be careful',
      responseSchema: { type: 'OBJECT' },
      file: { mimeType: 'image/png', base64: 'AAAA' },
    });
    expect(sent(f).body).toEqual({
      contents: [{ role: 'user', parts: [{ text: 'read this' }, { inline_data: { mime_type: 'image/png', data: 'AAAA' } }] }],
      systemInstruction: { parts: [{ text: 'be careful' }] },
      generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT' } },
    });
  });

  it('omits the optional parts when not given', async () => {
    const f = vi.fn(async () => answer('hi'));
    await make(f)({ prompt: 'hello' });
    const { body } = sent(f);
    expect(body).not.toHaveProperty('systemInstruction');
    expect(body).not.toHaveProperty('generationConfig');
  });
});

describe('answers', () => {
  it('returns the first candidate’s text', async () => {
    const f = vi.fn(async () => answer('The answer'));
    await expect(make(f)({ prompt: 'q' })).resolves.toBe('The answer');
  });

  it('treats a response with no text as an empty answer, keeping the finish reason', async () => {
    const f = vi.fn(async () => reply(200, { candidates: [{ finishReason: 'SAFETY' }] }));
    await expect(make(f)({ prompt: 'q' })).rejects.toMatchObject({ kind: 'empty', detail: 'SAFETY' });
  });

  it('treats no candidates at all as empty', async () => {
    const f = vi.fn(async () => reply(200, {}));
    await expect(make(f)({ prompt: 'q' })).rejects.toMatchObject({ kind: 'empty' });
  });

  it('empty text is still text (an empty string is a valid answer from the model)', async () => {
    const f = vi.fn(async () => answer(''));
    await expect(make(f)({ prompt: 'q' })).resolves.toBe('');
  });
});

describe('failures', () => {
  it.each([400, 401, 403, 404, 429, 500, 503])('maps an HTTP %i from Google to an upstream error with that status', async (status) => {
    const f = vi.fn(async () => reply(status, { error: { message: `upstream said ${status}` } }));
    const error = await make(f)({ prompt: 'q' }).catch((e) => e);
    expect(error).toBeInstanceOf(GeminiError);
    expect(error).toMatchObject({ kind: 'upstream', detail: status, message: `upstream said ${status}` });
  });

  it('copes with an error body that is not JSON', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 502, json: async () => { throw new Error('html'); } }) as unknown as Response);
    await expect(make(f)({ prompt: 'q' })).rejects.toMatchObject({ kind: 'upstream', detail: 502, message: 'AI service error 502' });
  });

  it('maps a network failure to "unreachable"', async () => {
    const f = vi.fn(async () => { throw new TypeError('fetch failed'); });
    await expect(make(f)({ prompt: 'q' })).rejects.toMatchObject({ kind: 'unreachable' });
  });

  it('gives up on a request that takes too long', async () => {
    const f = vi.fn((_url: unknown, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
    );
    await expect(make(f)({ prompt: 'q' })).rejects.toMatchObject({ kind: 'unreachable' });
  });

  it('refuses without an API key, and never calls Google', async () => {
    const f = vi.fn();
    await expect(make(f, '')({ prompt: 'q' })).rejects.toMatchObject({ kind: 'not-configured' });
    expect(f).not.toHaveBeenCalled();
  });

  it('never puts the key in an error message', async () => {
    const f = vi.fn(async () => reply(403, { error: { message: 'API key not valid' } }));
    const error = await make(f)({ prompt: 'q' }).catch((e) => e);
    expect(JSON.stringify({ message: error.message, detail: error.detail })).not.toContain(KEY);
  });
});
