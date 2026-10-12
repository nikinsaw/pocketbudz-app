import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { signAccessToken } from '../auth/tokens.js';
import { prisma } from '../db.js';
import { makeHousehold, makeUser, resetDb } from '../households/testUtils.js';
import { createServices } from '../services.js';

// A fresh app per test: the route's rate limit (3/min) is tracked per app instance.
const makeApp = () =>
  buildApp(
    createServices(prisma, async () => {
      throw new Error('unused');
    }),
  );
let app: ReturnType<typeof makeApp>;
const payload = {
  envelopeScope: 'PERSONAL',
  monthlyIncome: null,
  envelopes: [{ categoryKey: 'food', icon: '🍕', title: 'Food', colorKey: 'food', type: 'spending', budgetLimit: 5000 }],
  transactions: [{ merchant: 'Cafe', category: 'Food', amount: 120.5, date: '2026-10-02' }],
};

beforeEach(async () => {
  await resetDb(prisma);
  app = makeApp();
});
afterEach(() => app.close());
afterAll(() => prisma.$disconnect());

async function setup() {
  const user = await makeUser(prisma, 'asha');
  const household = await makeHousehold(prisma, [{ userId: user.id, role: 'SPENDER' }]);
  const headers = { authorization: `Bearer ${await signAccessToken(user.id)}` };
  return { household, headers, url: `/households/${household.id}/import` };
}

describe('import route', () => {
  it('requires authentication', async () => {
    const { url } = await setup();
    expect((await app.inject({ method: 'POST', url, payload })).statusCode).toBe(401);
  });

  it('imports and then refuses a repeat', async () => {
    const { headers, url } = await setup();
    const first = await app.inject({ method: 'POST', url, headers, payload });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ envelopes: 1, transactions: 1, incomeImported: false });
    expect((await app.inject({ method: 'POST', url, headers, payload })).statusCode).toBe(409);
  });

  it('sanitises over-long and blank text instead of failing the whole upload', async () => {
    const { headers, url } = await setup();
    const messy = {
      ...payload,
      transactions: [{ merchant: 'M'.repeat(200), category: '   ', amount: 10, date: '2026-10-02' }],
    };
    expect((await app.inject({ method: 'POST', url, headers, payload: messy })).statusCode).toBe(200);
    const row = await prisma.transaction.findFirstOrThrow();
    expect(row.merchant).toHaveLength(60);
    expect(row.category).toBe('Other');
  });

  it('rejects malformed bodies', async () => {
    const { headers, url } = await setup();
    const bad = [
      { ...payload, envelopeScope: 'PUBLIC' },
      { ...payload, transactions: [{ merchant: 'x', category: 'y', amount: -5, date: '2026-10-02' }] },
      { ...payload, transactions: [{ merchant: 'x', category: 'y', amount: 5, date: 'yesterday' }] },
      { ...payload, transactions: [{ merchant: 'x', category: 'y', amount: 5 }] },
      { ...payload, monthlyIncome: 'lots' },
      { envelopeScope: 'PERSONAL' },
    ];
    for (const body of bad) {
      const fresh = makeApp(); // each attempt gets its own rate-limit budget
      expect((await fresh.inject({ method: 'POST', url, headers, payload: body })).statusCode).toBe(400);
      await fresh.close();
    }
    expect(await prisma.transaction.count()).toBe(0);
  });
});
