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

beforeEach(() => resetDb(prisma));
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function setup(role: 'OWNER' | 'SPENDER' = 'OWNER') {
  const user = await makeUser(prisma, 'asha');
  const household = await makeHousehold(prisma, [{ userId: user.id, role }]);
  const headers = { authorization: `Bearer ${await signAccessToken(user.id)}` };
  return { household, headers };
}

describe('income routes', () => {
  it('requires authentication', async () => {
    const { household } = await setup();
    expect((await app.inject({ method: 'GET', url: `/households/${household.id}/income` })).statusCode).toBe(401);
  });

  it('creates, lists with a total, edits and deletes', async () => {
    const { household, headers } = await setup();
    const base = `/households/${household.id}/income`;
    const created = await app.inject({ method: 'POST', url: base, headers, payload: { label: 'Salary', amount: 5000000 } });
    expect(created.statusCode).toBe(201);
    const { id } = created.json();

    expect((await app.inject({ method: 'GET', url: base, headers })).json().total).toBe(5000000);
    const patched = await app.inject({ method: 'PATCH', url: `${base}/${id}`, headers, payload: { amount: 5500000 } });
    expect(patched.json().amount).toBe(5500000);
    expect((await app.inject({ method: 'DELETE', url: `${base}/${id}`, headers })).statusCode).toBe(204);
  });

  it('rejects bad amounts and spenders', async () => {
    const { household, headers } = await setup();
    const base = `/households/${household.id}/income`;
    for (const amount of [0, -1, 10.5]) {
      const res = await app.inject({ method: 'POST', url: base, headers, payload: { label: 'x', amount } });
      expect(res.statusCode).toBe(400);
    }
    await prisma.membership.updateMany({ data: { role: 'SPENDER' } });
    expect((await app.inject({ method: 'GET', url: base, headers })).statusCode).toBe(403);
  });
});
