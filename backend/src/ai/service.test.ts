import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../db.js';
import { makeUser, resetDb } from '../households/testUtils.js';
import { GeminiError, type Gemini } from './gemini.js';
import { createAiService } from './service.js';

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

const ok: Gemini = async () => 'the answer';
function make(gemini: Gemini = ok, opts: { dailyLimit?: number; now?: () => Date; dayOffsetMinutes?: number } = {}) {
  return createAiService({ prisma, gemini, dailyLimit: opts.dailyLimit ?? 3, dayOffsetMinutes: opts.dayOffsetMinutes ?? 0, now: opts.now });
}
const count = async (userId: string) => (await prisma.aiUsage.findFirst({ where: { userId } }))?.count ?? 0;

describe('generate', () => {
  it('passes the input to Gemini, returns the text and reports usage', async () => {
    const user = await makeUser(prisma, 'asha');
    const gemini = vi.fn(ok);
    const result = await make(gemini).generate(user.id, { prompt: 'hello', systemInstruction: 's' });
    expect(gemini).toHaveBeenCalledWith({ prompt: 'hello', systemInstruction: 's' });
    expect(result).toEqual({ text: 'the answer', usage: { used: 1, limit: 3 } });
  });

  it('counts each successful request against the day', async () => {
    const user = await makeUser(prisma, 'asha');
    const ai = make();
    await ai.generate(user.id, { prompt: 'a' });
    await ai.generate(user.id, { prompt: 'b' });
    expect(await count(user.id)).toBe(2);
    expect(await ai.usage(user.id)).toEqual({ used: 2, limit: 3 });
  });
});

describe('the daily limit', () => {
  it('refuses the request after the limit, without calling Google, and says why', async () => {
    const user = await makeUser(prisma, 'asha');
    const gemini = vi.fn(ok);
    const ai = make(gemini, { dailyLimit: 2 });
    await ai.generate(user.id, { prompt: '1' });
    await ai.generate(user.id, { prompt: '2' });
    const error = await ai.generate(user.id, { prompt: '3' }).catch((e) => e);
    expect(error).toMatchObject({ status: 429, extra: { reason: 'daily-limit' } });
    expect(error.message).toContain('2 AI requests');
    expect(gemini).toHaveBeenCalledTimes(2); // the refused one never reached Google
  });

  it('a refused request does not push the counter past the limit', async () => {
    const user = await makeUser(prisma, 'asha');
    const ai = make(ok, { dailyLimit: 1 });
    await ai.generate(user.id, { prompt: '1' });
    for (let i = 0; i < 5; i++) await ai.generate(user.id, { prompt: 'x' }).catch(() => undefined);
    expect(await count(user.id)).toBe(1);
  });

  it('holds under concurrency: exactly the limit succeed', async () => {
    const user = await makeUser(prisma, 'asha');
    const gemini = vi.fn(ok);
    const ai = make(gemini, { dailyLimit: 3 });
    const results = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => ai.generate(user.id, { prompt: `q${i}` })));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    expect(gemini).toHaveBeenCalledTimes(3);
    expect(await count(user.id)).toBe(3);
  });

  it('limits each user separately', async () => {
    const a = await makeUser(prisma, 'a');
    const b = await makeUser(prisma, 'b');
    const ai = make(ok, { dailyLimit: 1 });
    await ai.generate(a.id, { prompt: '1' });
    await expect(ai.generate(a.id, { prompt: '2' })).rejects.toMatchObject({ status: 429 });
    await expect(ai.generate(b.id, { prompt: '1' })).resolves.toBeTruthy();
  });

  it('starts fresh the next day', async () => {
    const user = await makeUser(prisma, 'asha');
    let clock = new Date('2026-10-13T10:00:00Z');
    const ai = make(ok, { dailyLimit: 1, now: () => clock });
    await ai.generate(user.id, { prompt: '1' });
    await expect(ai.generate(user.id, { prompt: '2' })).rejects.toMatchObject({ status: 429 });
    clock = new Date('2026-10-14T10:00:00Z');
    await expect(ai.generate(user.id, { prompt: '3' })).resolves.toBeTruthy();
  });

  it('resets at midnight in the configured time zone, not UTC (India is UTC+5:30)', async () => {
    const user = await makeUser(prisma, 'asha');
    let clock = new Date('2026-10-13T18:00:00Z'); // 23:30 IST on the 13th
    const ai = make(ok, { dailyLimit: 1, dayOffsetMinutes: 330, now: () => clock });
    await ai.generate(user.id, { prompt: '1' });
    clock = new Date('2026-10-13T18:29:00Z'); // 23:59 IST - still the 13th
    await expect(ai.generate(user.id, { prompt: '2' })).rejects.toMatchObject({ status: 429 });
    clock = new Date('2026-10-13T18:31:00Z'); // 00:01 IST on the 14th - a new day, though UTC is still the 13th
    await expect(ai.generate(user.id, { prompt: '3' })).resolves.toBeTruthy();
  });
});

describe('failures give the request back', () => {
  const failing = (error: GeminiError): Gemini => async () => {
    throw error;
  };

  it.each([
    ['unreachable', new GeminiError('unreachable', 'x'), 502, 'unreachable'],
    ['upstream 429', new GeminiError('upstream', 'x', 429), 502, 'api-error-429'],
    ['upstream 403 (bad key)', new GeminiError('upstream', 'x', 403), 502, 'api-error-403'],
    ['not configured', new GeminiError('not-configured', 'x'), 503, 'not-configured'],
  ])('%s: maps to the right response and costs the user nothing', async (_name, error, status, reason) => {
    const user = await makeUser(prisma, 'asha');
    const ai = make(failing(error));
    await expect(ai.generate(user.id, { prompt: 'q' })).rejects.toMatchObject({ status, extra: { reason } });
    expect(await count(user.id)).toBe(0);
  });

  it('does not leak Google’s own error text to the user', async () => {
    const user = await makeUser(prisma, 'asha');
    const ai = make(failing(new GeminiError('upstream', 'API key not valid: AIza-secret', 403)));
    const error = await ai.generate(user.id, { prompt: 'q' }).catch((e) => e);
    expect(JSON.stringify([error.message, error.extra])).not.toMatch(/AIza|API key/);
  });

  it('an answer the model refused to give still counts, and reports why', async () => {
    const user = await makeUser(prisma, 'asha');
    const ai = make(failing(new GeminiError('empty', 'x', 'SAFETY')));
    await expect(ai.generate(user.id, { prompt: 'q' })).rejects.toMatchObject({ status: 502, extra: { reason: 'empty-response', detail: 'SAFETY' } });
    expect(await count(user.id)).toBe(1);
  });

  it('an unexpected crash is a plain 500 and is also refunded', async () => {
    const user = await makeUser(prisma, 'asha');
    const ai = make(async () => {
      throw new Error('boom');
    });
    await expect(ai.generate(user.id, { prompt: 'q' })).rejects.toMatchObject({ status: 500 });
    expect(await count(user.id)).toBe(0);
  });

  it('a refund never takes the counter below zero', async () => {
    const user = await makeUser(prisma, 'asha');
    const ai = make(failing(new GeminiError('unreachable', 'x')));
    for (let i = 0; i < 3; i++) await ai.generate(user.id, { prompt: 'q' }).catch(() => undefined);
    expect(await count(user.id)).toBe(0);
  });
});

describe('usage', () => {
  it('is zero for someone who has not used it today', async () => {
    const user = await makeUser(prisma, 'asha');
    expect(await make().usage(user.id)).toEqual({ used: 0, limit: 3 });
  });

  it('is removed with the account', async () => {
    const user = await makeUser(prisma, 'asha');
    await make().generate(user.id, { prompt: 'q' });
    await prisma.user.delete({ where: { id: user.id } });
    expect(await prisma.aiUsage.count()).toBe(0);
  });
});
