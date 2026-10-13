import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { signAccessToken } from '../auth/tokens.js';
import { prisma } from '../db.js';
import { makeHousehold, makeUser, resetDb } from '../households/testUtils.js';
import { createServices } from '../services.js';

const app = buildApp(
  createServices(prisma, async () => {
    throw new Error('unused');
  }),
);
const row = (merchant: string, amount = 1000) => ({ envelopeId: null, merchant, category: 'Food', amount, date: '2026-10-05' });

beforeEach(() => resetDb(prisma));
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function setup() {
  const user = await makeUser(prisma, 'asha');
  const household = await makeHousehold(prisma, [{ userId: user.id, role: 'OWNER' }]);
  const headers = { authorization: `Bearer ${await signAccessToken(user.id)}` };
  return { household, headers, base: `/households/${household.id}/transactions` };
}

describe('POST /transactions/bulk', () => {
  it('requires authentication', async () => {
    const { base } = await setup();
    expect((await app.inject({ method: 'POST', url: `${base}/bulk`, payload: { transactions: [row('x')] } })).statusCode).toBe(401);
  });

  it('adds them all and returns them', async () => {
    const { headers, base } = await setup();
    const res = await app.inject({ method: 'POST', url: `${base}/bulk`, headers, payload: { transactions: [row('A'), row('B')] } });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toHaveLength(2);
  });

  it('rejects empty, oversized and invalid batches without adding anything', async () => {
    const { headers, base } = await setup();
    const bad = [
      { transactions: [] },
      { transactions: Array.from({ length: 501 }, (_, i) => row(`S${i}`)) },
      { transactions: [row('ok'), { ...row('bad'), amount: -5 }] },
      { transactions: [row('ok'), { ...row('bad'), date: '2026-02-31' }] },
      {},
    ];
    for (const payload of bad) {
      const res = await app.inject({ method: 'POST', url: `${base}/bulk`, headers, payload });
      expect([res.statusCode, JSON.stringify(payload).slice(0, 40)]).toEqual([400, JSON.stringify(payload).slice(0, 40)]);
    }
    expect(await prisma.transaction.count()).toBe(0);
  });
});

describe('POST /transactions/merge', () => {
  it('merges and returns the new transaction', async () => {
    const { headers, base } = await setup();
    const created = (await app.inject({ method: 'POST', url: `${base}/bulk`, headers, payload: { transactions: [row('A', 100), row('B', 200)] } })).json();
    const res = await app.inject({
      method: 'POST', url: `${base}/merge`, headers,
      payload: { ids: created.map((t: { id: string }) => t.id), ...row('A + B', 300) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ merchant: 'A + B', amount: 300 });
    expect(await prisma.transaction.count()).toBe(1);
  });

  it('needs at least two distinct transactions and valid values', async () => {
    const { headers, base } = await setup();
    const one = (await app.inject({ method: 'POST', url: `${base}/bulk`, headers, payload: { transactions: [row('A')] } })).json()[0];
    for (const payload of [{ ids: [one.id], ...row('X') }, { ids: [], ...row('X') }, { ids: [one.id, 'b'], ...row('X'), amount: 0 }]) {
      expect((await app.inject({ method: 'POST', url: `${base}/merge`, headers, payload })).statusCode).toBe(400);
    }
    expect(await prisma.transaction.count()).toBe(1);
  });

  it('does not treat "merge" or "bulk" as a transaction id', async () => {
    const { headers, base } = await setup();
    expect((await app.inject({ method: 'DELETE', url: `${base}/merge`, headers })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PATCH', url: `${base}/bulk`, headers, payload: { merchant: 'x' } })).statusCode).toBe(404);
  });
});
