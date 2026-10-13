import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { signAccessToken } from '../auth/tokens.js';
import { prisma } from '../db.js';
import { makeUser, resetDb } from '../households/testUtils.js';
import { createServices } from '../services.js';
import { GeminiError, createGemini, type Gemini } from './gemini.js';
import { MAX_FILE_BYTES } from './routes.js';

const SECRET_KEY = 'AIzaSyThisIsAFakeKeyForTestsOnly1234567890';

// A fresh server per test: the rate limit and the daily counter are per instance/user.
const makeApp = (gemini: Gemini) =>
  buildApp(createServices(prisma, async () => { throw new Error('unused'); }, { gemini }));
let app: ReturnType<typeof makeApp>;
let gemini: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await resetDb(prisma);
  gemini = vi.fn(async () => 'the answer');
  app = makeApp(gemini as unknown as Gemini);
});
afterEach(() => app.close());
afterAll(() => prisma.$disconnect());

async function asUser() {
  const user = await makeUser(prisma, 'asha');
  return { user, headers: { authorization: `Bearer ${await signAccessToken(user.id)}` } };
}
const post = (headers: Record<string, string> | undefined, payload: unknown) =>
  app.inject({ method: 'POST', url: '/ai/generate', headers, payload: payload as object });

describe('authentication', () => {
  it('refuses anonymous callers and never reaches Gemini', async () => {
    expect((await post(undefined, { prompt: 'hi' })).statusCode).toBe(401);
    expect((await post({ authorization: 'Bearer nope' }, { prompt: 'hi' })).statusCode).toBe(401);
    expect(gemini).not.toHaveBeenCalled();
  });

  it('refuses a deleted account’s token', async () => {
    const { user, headers } = await asUser();
    await prisma.user.delete({ where: { id: user.id } });
    expect((await post(headers, { prompt: 'hi' })).statusCode).toBe(401);
  });

  it('rejects an anonymous huge upload before reading it', async () => {
    const huge = { prompt: 'x', file: { mimeType: 'image/png', base64: 'A'.repeat(20 * 1024 * 1024) } };
    expect((await post(undefined, huge)).statusCode).toBe(401);
    expect(gemini).not.toHaveBeenCalled();
  });
});

describe('POST /ai/generate', () => {
  it('returns the answer and the day’s usage', async () => {
    const { headers } = await asUser();
    const res = await post(headers, { prompt: 'what is 2+2' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ text: 'the answer', usage: { used: 1, limit: 100 } });
  });

  it('passes through a system instruction, a JSON schema and an image', async () => {
    const { headers } = await asUser();
    const input = { prompt: 'read it', systemInstruction: 'be exact', responseSchema: { type: 'OBJECT' }, file: { mimeType: 'image/jpeg', base64: 'AAAA' } };
    await post(headers, input);
    expect(gemini).toHaveBeenCalledWith(input);
  });

  it('does not forward anything the app was not meant to control', async () => {
    const { headers } = await asUser();
    await post(headers, { prompt: 'hi', model: 'gemini-pro-expensive', tools: [{ x: 1 }], safetySettings: [], apiKey: 'mine' });
    expect(gemini).toHaveBeenCalledWith({ prompt: 'hi' });
  });
});

describe('input limits', () => {
  it.each([
    ['no prompt', {}],
    ['empty prompt', { prompt: '' }],
    ['prompt over the limit', { prompt: 'x'.repeat(400_001) }],
    ['system instruction over the limit', { prompt: 'x', systemInstruction: 's'.repeat(20_001) }],
    ['schema over the limit', { prompt: 'x', responseSchema: { big: 'y'.repeat(20_001) } }],
    ['file type not allowed', { prompt: 'x', file: { mimeType: 'application/zip', base64: 'AAAA' } }],
    ['executable disguised as a file', { prompt: 'x', file: { mimeType: 'application/x-msdownload', base64: 'AAAA' } }],
    ['empty file', { prompt: 'x', file: { mimeType: 'image/png', base64: '' } }],
    ['file over the limit', { prompt: 'x', file: { mimeType: 'application/pdf', base64: 'A'.repeat(Math.ceil(MAX_FILE_BYTES / 3) * 4 + 4) } }],
    ['prompt that is not text', { prompt: { a: 1 } }],
  ])('rejects %s with 400, without calling Gemini or using up an AI request', async (_name, payload) => {
    const { user, headers } = await asUser();
    expect((await post(headers, payload)).statusCode).toBe(400);
    expect(gemini).not.toHaveBeenCalled();
    expect(await prisma.aiUsage.count({ where: { userId: user.id } })).toBe(0);
  });

  it('accepts the biggest allowed statement text and a file right at the limit', async () => {
    const { headers } = await asUser();
    expect((await post(headers, { prompt: 'x'.repeat(400_000) })).statusCode).toBe(200);
    const atLimit = { prompt: 'x', file: { mimeType: 'application/pdf', base64: 'A'.repeat(Math.ceil(MAX_FILE_BYTES / 3) * 4) } };
    expect((await post(headers, atLimit)).statusCode).toBe(200);
  });

  it('accepts every image type the app can send, and PDFs', async () => {
    const { headers } = await asUser();
    for (const mimeType of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']) {
      expect([mimeType, (await post(headers, { prompt: 'x', file: { mimeType, base64: 'AAAA' } })).statusCode]).toEqual([mimeType, 200]);
    }
  });
});

describe('the daily limit', () => {
  it('answers 429 with a reason the app can act on once the day’s limit is used - and never calls Google for it', async () => {
    await app.close();
    app = buildApp(createServices(prisma, async () => { throw new Error('unused'); }, { gemini: gemini as unknown as Gemini, aiDailyLimit: 2 }));
    const { headers } = await asUser();

    expect((await post(headers, { prompt: 'one' })).statusCode).toBe(200);
    expect((await post(headers, { prompt: 'two' })).statusCode).toBe(200);
    const refused = await post(headers, { prompt: 'three' });
    expect(refused.statusCode).toBe(429);
    expect(refused.json().reason).toBe('daily-limit');
    expect(refused.json().error).toContain('2 AI requests');
    expect(gemini).toHaveBeenCalledTimes(2);
  });

  it('is per person: one user hitting the limit does not block another', async () => {
    await app.close();
    app = buildApp(createServices(prisma, async () => { throw new Error('unused'); }, { gemini: gemini as unknown as Gemini, aiDailyLimit: 1 }));
    const first = await asUser();
    const other = await makeUser(prisma, 'ravi');
    const otherHeaders = { authorization: `Bearer ${await signAccessToken(other.id)}` };
    await post(first.headers, { prompt: 'a' });
    expect((await post(first.headers, { prompt: 'b' })).statusCode).toBe(429);
    expect((await post(otherHeaders, { prompt: 'c' })).statusCode).toBe(200);
  });

  it('reports the usage so far', async () => {
    const { headers } = await asUser();
    await post(headers, { prompt: 'a' });
    await post(headers, { prompt: 'b' });
    const res = await app.inject({ method: 'GET', url: '/ai/usage', headers });
    expect(res.json()).toEqual({ used: 2, limit: 100 });
  });

  it('/ai/usage needs sign-in', async () => {
    expect((await app.inject({ method: 'GET', url: '/ai/usage' })).statusCode).toBe(401);
  });
});

describe('failures reach the app as a reason, never as Google’s own words', () => {
  it('a Gemini outage is a 502 with a reason, and the user is not charged', async () => {
    const { user, headers } = await asUser();
    gemini.mockRejectedValue(new GeminiError('unreachable', 'down'));
    const res = await post(headers, { prompt: 'x' });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({ reason: 'unreachable', error: 'AI is temporarily unavailable' });
    expect(await prisma.aiUsage.findFirst({ where: { userId: user.id } }).then((r) => r?.count ?? 0)).toBe(0);
  });

  it('a server with no key answers 503 "not-configured"', async () => {
    await app.close();
    app = buildApp(createServices(prisma, async () => { throw new Error('unused'); }, { gemini: createGemini({ apiKey: '', model: 'm' }) }));
    const { headers } = await asUser();
    const res = await post(headers, { prompt: 'x' });
    expect(res.statusCode).toBe(503);
    expect(res.json().reason).toBe('not-configured');
  });

  it('THE KEY NEVER APPEARS IN ANY RESPONSE - not on success, not on Google errors', async () => {
    await app.close();
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ error: { message: `API key ${SECRET_KEY} is invalid` } }) }) as unknown as Response);
    app = buildApp(createServices(prisma, async () => { throw new Error('unused'); }, { gemini: createGemini({ apiKey: SECRET_KEY, model: 'm', fetchImpl: fetchImpl as unknown as typeof fetch }) }));
    const { headers } = await asUser();

    const failure = await post(headers, { prompt: 'x' });
    expect(failure.statusCode).toBe(502);
    expect(failure.body).not.toContain(SECRET_KEY);
    expect(failure.body).not.toContain('AIza');
    expect(failure.json().reason).toBe('api-error-403');

    fetchImpl.mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'fine' }] } }] }) } as unknown as Response);
    const success = await post(headers, { prompt: 'x' });
    expect(success.statusCode).toBe(200);
    expect(success.body).not.toContain(SECRET_KEY);
    // ...and it really did use the key, in a header, not in the URL.
    const [url, init] = fetchImpl.mock.calls[1] as unknown as [string, { headers: Record<string, string> }];
    expect(init.headers['x-goog-api-key']).toBe(SECRET_KEY);
    expect(url).not.toContain(SECRET_KEY);
  });
});
