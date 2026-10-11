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
const body = { envelopeId: null, merchant: 'Blue Tokai', category: 'Food', amount: 45000, date: '2026-10-05' };

beforeEach(() => resetDb(prisma));
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function setup() {
  const user = await makeUser(prisma, 'asha');
  const household = await makeHousehold(prisma, [{ userId: user.id, role: 'OWNER' }]);
  const headers = { authorization: `Bearer ${await signAccessToken(user.id)}` };
  return { household, headers };
}

describe('transaction routes', () => {
  it('requires authentication', async () => {
    const { household } = await setup();
    const res = await app.inject({ method: 'GET', url: `/households/${household.id}/transactions` });
    expect(res.statusCode).toBe(401);
  });

  it('creates, lists, edits and deletes', async () => {
    const { household, headers } = await setup();
    const base = `/households/${household.id}/transactions`;
    const created = await app.inject({ method: 'POST', url: base, headers, payload: body });
    expect(created.statusCode).toBe(201);
    const { id } = created.json();

    const list = await app.inject({ method: 'GET', url: `${base}?from=2026-10-01&to=2026-10-31&limit=10`, headers });
    expect(list.json()).toHaveLength(1);
    const patched = await app.inject({ method: 'PATCH', url: `${base}/${id}`, headers, payload: { merchant: 'Starbucks' } });
    expect(patched.json().merchant).toBe('Starbucks');
    expect((await app.inject({ method: 'DELETE', url: `${base}/${id}`, headers })).statusCode).toBe(204);
  });

  it('rejects bad input: non-integer or non-positive paise, bad dates, empty patch', async () => {
    const { household, headers } = await setup();
    const base = `/households/${household.id}/transactions`;
    for (const payload of [
      { ...body, amount: 10.5 },
      { ...body, amount: 0 },
      { ...body, amount: -5 },
      { ...body, date: '05/10/2026' },
      { ...body, date: '2026-02-31' },
      { ...body, merchant: '' },
    ]) {
      expect((await app.inject({ method: 'POST', url: base, headers, payload })).statusCode).toBe(400);
    }
    const { id } = (await app.inject({ method: 'POST', url: base, headers, payload: body })).json();
    expect((await app.inject({ method: 'PATCH', url: `${base}/${id}`, headers, payload: {} })).statusCode).toBe(400);
  });
});
