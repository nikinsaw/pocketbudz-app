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

describe('allowance routes', () => {
  it('requires authentication', async () => {
    expect((await app.inject({ method: 'GET', url: '/households/x/allowances' })).statusCode).toBe(401);
  });

  it('sets, lists and removes', async () => {
    const owner = await makeUser(prisma, 'owner');
    const spender = await makeUser(prisma, 'spender');
    const household = await makeHousehold(prisma, [
      { userId: owner.id, role: 'OWNER' },
      { userId: spender.id, role: 'SPENDER' },
    ]);
    const spenderMembership = household.members.find((m) => m.userId === spender.id)!;
    const headers = { authorization: `Bearer ${await signAccessToken(owner.id)}` };
    const url = `/households/${household.id}/allowances/${spenderMembership.id}`;

    expect((await app.inject({ method: 'PUT', url, headers, payload: { amount: 150000 } })).statusCode).toBe(200);
    const list = await app.inject({ method: 'GET', url: `/households/${household.id}/allowances`, headers });
    expect(list.json().total).toBe(150000);
    expect((await app.inject({ method: 'PUT', url, headers, payload: { amount: 10.5 } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url, headers, payload: { amount: 0 } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'DELETE', url, headers })).statusCode).toBe(204);
    expect((await app.inject({ method: 'DELETE', url, headers })).statusCode).toBe(404);
  });
});
