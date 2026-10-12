import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/tokens.js';
import { prisma } from './db.js';
import { makeHousehold, makeUser, resetDb } from './households/testUtils.js';
import { MAX_PAISE, rupeesToPaise } from './money.js';
import { createServices } from './services.js';

const app = buildApp(
  createServices(prisma, async () => {
    throw new Error('unused');
  }),
);

beforeEach(() => resetDb(prisma));
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('money', () => {
  it('converts rupees to whole paise without float drift', () => {
    expect(rupeesToPaise(199.99)).toBe(19999);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
    expect(rupeesToPaise(1)).toBe(100);
  });

  it('keeps the cap inside the 32-bit column', () => {
    expect(MAX_PAISE).toBeLessThan(2 ** 31);
  });

  // Regression: amounts above the Postgres INT range used to pass validation and
  // surface as a 500 from the database.
  it('rejects over-large amounts with 400 on every endpoint that takes money', async () => {
    const owner = await makeUser(prisma, 'owner');
    const spender = await makeUser(prisma, 'spender');
    const household = await makeHousehold(prisma, [
      { userId: owner.id, role: 'OWNER' },
      { userId: spender.id, role: 'SPENDER' },
    ]);
    const spenderMembership = household.members.find((m) => m.userId === spender.id)!;
    const headers = { authorization: `Bearer ${await signAccessToken(owner.id)}` };
    const base = `/households/${household.id}`;
    const tooBig = MAX_PAISE + 1;
    const envelope = { scope: 'SHARED', categoryKey: 'a', icon: 'i', title: 't', colorKey: 'c', type: 'spending' };

    const calls = [
      { method: 'POST', url: `${base}/transactions`, payload: { envelopeId: null, merchant: 'x', category: 'y', amount: tooBig, date: '2026-10-05' } },
      { method: 'POST', url: `${base}/envelopes`, payload: { ...envelope, budgetLimit: tooBig } },
      { method: 'POST', url: `${base}/income`, payload: { label: 'x', amount: tooBig } },
      { method: 'PUT', url: `${base}/allowances/${spenderMembership.id}`, payload: { amount: tooBig } },
    ] as const;
    for (const call of calls) {
      const res = await app.inject({ ...call, headers });
      expect([call.url, res.statusCode]).toEqual([call.url, 400]);
    }

    // ...and the largest allowed value is accepted end to end.
    const ok = await app.inject({ method: 'POST', url: `${base}/income`, headers, payload: { label: 'Max', amount: MAX_PAISE } });
    expect(ok.statusCode).toBe(201);
  });
});
