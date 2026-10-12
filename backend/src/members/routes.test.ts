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

describe('member routes', () => {
  it('requires authentication', async () => {
    expect((await app.inject({ method: 'PATCH', url: '/households/x/members/y/role', payload: { role: 'EARNER' } })).statusCode).toBe(401);
  });

  it('changes a role and validates the body', async () => {
    const owner = await makeUser(prisma, 'owner');
    const spender = await makeUser(prisma, 'spender');
    const household = await makeHousehold(prisma, [
      { userId: owner.id, role: 'OWNER' },
      { userId: spender.id, role: 'SPENDER' },
    ]);
    const target = household.members.find((m) => m.userId === spender.id)!;
    const headers = { authorization: `Bearer ${await signAccessToken(owner.id)}` };
    const url = `/households/${household.id}/members/${target.id}/role`;

    const ok = await app.inject({ method: 'PATCH', url, headers, payload: { role: 'EARNER' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ membershipId: target.id, role: 'EARNER' });
    expect((await app.inject({ method: 'PATCH', url, headers, payload: { role: 'OWNER' } })).statusCode).toBe(400);
  });
});
