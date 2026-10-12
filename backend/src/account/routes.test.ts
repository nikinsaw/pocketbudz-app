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

describe('export routes', () => {
  it('require authentication', async () => {
    expect((await app.inject({ method: 'GET', url: '/me/export' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/households/x/export' })).statusCode).toBe(401);
  });

  it('return the caller\'s data', async () => {
    const user = await makeUser(prisma, 'asha');
    const household = await makeHousehold(prisma, [{ userId: user.id, role: 'OWNER' }]);
    const headers = { authorization: `Bearer ${await signAccessToken(user.id)}` };

    const mine = await app.inject({ method: 'GET', url: '/me/export', headers });
    expect(mine.statusCode).toBe(200);
    expect(mine.json().households).toHaveLength(1);
    const one = await app.inject({ method: 'GET', url: `/households/${household.id}/export`, headers });
    expect(one.json().household.id).toBe(household.id);
  });

  it('hides households from non-members', async () => {
    const owner = await makeUser(prisma, 'owner');
    const outsider = await makeUser(prisma, 'outsider');
    const household = await makeHousehold(prisma, [{ userId: owner.id, role: 'OWNER' }]);
    const headers = { authorization: `Bearer ${await signAccessToken(outsider.id)}` };
    expect((await app.inject({ method: 'GET', url: `/households/${household.id}/export`, headers })).statusCode).toBe(404);
  });
});
