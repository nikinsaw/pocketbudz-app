import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { GeminiError, type Gemini } from '../ai/gemini.js';
import { signAccessToken } from '../auth/tokens.js';
import { prisma } from '../db.js';
import { makeUser, resetDb } from '../households/testUtils.js';
import { createServices } from '../services.js';

// End-to-end contract for AI: the app's REAL AI client (src/services/aiClient.js) and API
// client talk to this real server and database. Gemini itself is faked, so nothing reaches
// Google, but everything between the phone and Google is the real code. It proves the app
// and server agree on request shape, failure reasons and the wording people finally see.
// Plain JS from outside backend/, so this file is excluded from `tsc` (Vitest only).
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
const { createApiClient } = await import('../../../src/services/apiClient.js');
// @ts-ignore
const { createCallGemini, describeAIError, AIUnavailableError } = await import('../../../src/services/aiClient.js');
/* eslint-enable @typescript-eslint/ban-ts-comment */

const makeApp = (gemini: Gemini, aiDailyLimit?: number) =>
  buildApp(createServices(prisma, async () => { throw new Error('unused'); }, { gemini, aiDailyLimit }));
let app: ReturnType<typeof makeApp>;
let gemini: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await resetDb(prisma);
  gemini = vi.fn(async () => 'the answer');
  app = makeApp(gemini as unknown as Gemini);
});
afterEach(() => app.close());
afterAll(() => prisma.$disconnect());

const viaApp = async (url: string, init: { method?: string; headers?: Record<string, string>; body?: string }) => {
  const res = await app.inject({ method: (init.method ?? 'GET') as 'GET', url: url.replace('http://test', ''), headers: init.headers, payload: init.body });
  return { status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, text: async () => res.body };
};

async function phone(options: { signedIn?: boolean; token?: string } = {}) {
  const user = await makeUser(prisma, 'asha');
  let session: { accessToken: string; refreshToken: string } | null =
    options.signedIn === false ? null : { accessToken: options.token ?? (await signAccessToken(user.id)), refreshToken: 'not-a-real-refresh-token' };
  const api = createApiClient({
    baseUrl: 'http://test',
    fetchImpl: viaApp,
    store: { load: async () => session, save: async (s: typeof session) => { session = s; }, clear: async () => { session = null; } },
  });
  const callGemini = createCallGemini(api);
  return { user, callGemini, ask: (input: object = { prompt: 'hello' }) => callGemini(input).catch((e: unknown) => e) };
}

describe('the happy path', () => {
  it('a signed-in phone gets Gemini’s answer', async () => {
    const { callGemini } = await phone();
    await expect(callGemini({ prompt: 'what is 2+2' })).resolves.toBe('the answer');
    expect(gemini).toHaveBeenCalledWith({ prompt: 'what is 2+2' });
  });

  it('system instruction, JSON schema and an image arrive at Gemini exactly as the features build them', async () => {
    const { callGemini } = await phone();
    const input = {
      prompt: 'read this receipt',
      systemInstruction: 'extract transactions',
      responseSchema: { type: 'ARRAY', items: { type: 'OBJECT', properties: { amount: { type: 'NUMBER' } } } },
      file: { mimeType: 'image/jpeg', base64: 'QUJD' },
    };
    await callGemini(input);
    expect(gemini).toHaveBeenCalledWith(input);
  });

  it('a 5 MB photo makes it through end to end', async () => {
    const { callGemini } = await phone();
    const base64 = Buffer.alloc(5 * 1024 * 1024, 7).toString('base64');
    await expect(callGemini({ prompt: 'read', file: { mimeType: 'image/png', base64 } })).resolves.toBe('the answer');
    expect((gemini.mock.calls[0][0] as { file: { base64: string } }).file.base64).toHaveLength(base64.length);
  });
});

describe('signing in', () => {
  it('a phone that is not signed in is told to sign in, and the server is never contacted', async () => {
    const { ask } = await phone({ signedIn: false });
    const error = await ask();
    expect(error).toBeInstanceOf(AIUnavailableError);
    expect(error.reason).toBe('sign-in-required');
    expect(describeAIError(error)).toBe('Sign in with Google to use AI features.');
    expect(gemini).not.toHaveBeenCalled();
  });

  it('a stale or forged login is also asked to sign in again - not shown a technical error', async () => {
    const { ask } = await phone({ token: 'a.forged.token' });
    const error = await ask();
    expect(error.reason).toBe('sign-in-required');
    expect(gemini).not.toHaveBeenCalled();
  });

  it('an account that was deleted can no longer use AI', async () => {
    const { ask, user } = await phone();
    await prisma.user.delete({ where: { id: user.id } });
    expect((await ask()).reason).toBe('sign-in-required');
  });
});

describe('the daily limit', () => {
  it('shows the person the server’s own sentence, naming the limit', async () => {
    await app.close();
    app = makeApp(gemini as unknown as Gemini, 2);
    const { ask } = await phone();
    await ask({ prompt: '1' });
    await ask({ prompt: '2' });
    const error = await ask({ prompt: '3' });
    expect(error.reason).toBe('daily-limit');
    expect(describeAIError(error)).toContain('2 AI requests');
    expect(gemini).toHaveBeenCalledTimes(2);
  });
});

describe('failures end up as honest, actionable messages', () => {
  const failWith = (error: GeminiError) => gemini.mockRejectedValue(error);

  it('Google down: "temporarily unavailable", and the person keeps their request', async () => {
    failWith(new GeminiError('unreachable', 'x'));
    const { ask, user } = await phone();
    const error = await ask();
    expect(error.reason).toBe('unreachable');
    expect(describeAIError(error)).toMatch(/temporarily unavailable/);
    expect(await prisma.aiUsage.findFirst({ where: { userId: user.id } }).then((r) => r?.count ?? 0)).toBe(0);
  });

  it('Google rate-limiting us: "busy", not a scary error', async () => {
    failWith(new GeminiError('upstream', 'quota', 429));
    const { ask } = await phone();
    expect(describeAIError(await ask())).toMatch(/busy/);
  });

  it('a bad or revoked server key is NOT shown to the person as something they should fix', async () => {
    failWith(new GeminiError('upstream', 'API key not valid. Please pass a valid API key.', 403));
    const { ask } = await phone();
    const message = describeAIError(await ask());
    expect(message).toMatch(/temporarily unavailable/);
    expect(message).not.toMatch(/key|\.env|GEMINI/i);
  });

  it('the AI declining to answer says why', async () => {
    failWith(new GeminiError('empty', 'x', 'SAFETY'));
    const { ask } = await phone();
    const error = await ask();
    expect(error.reason).toBe('empty-response');
    expect(describeAIError(error)).toMatch(/declined to answer \(safety\)/);
  });

  it('a server with no Gemini key reports "not available"', async () => {
    failWith(new GeminiError('not-configured', 'x'));
    const { ask } = await phone();
    expect(describeAIError(await ask())).toMatch(/isn.t available/);
  });

  it('an oversized request is refused cleanly and costs nothing', async () => {
    const { ask, user } = await phone();
    const error = await ask({ prompt: 'x'.repeat(400_001) });
    expect(error).toBeInstanceOf(AIUnavailableError);
    expect(error.reason).toBe('api-error-400');
    expect(gemini).not.toHaveBeenCalled();
    expect(await prisma.aiUsage.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe('offline', () => {
  it('no connection to the server reads as "needs internet"', async () => {
    const api = createApiClient({
      baseUrl: 'http://test',
      fetchImpl: async () => { throw new TypeError('Network request failed'); },
      store: { load: async () => ({ accessToken: 'a', refreshToken: 'r' }), save: async () => {}, clear: async () => {} },
    });
    const error = await createCallGemini(api)({ prompt: 'hi' }).catch((e: unknown) => e);
    expect((error as { reason: string }).reason).toBe('offline');
    expect(describeAIError(error)).toMatch(/need internet/);
  });
});
