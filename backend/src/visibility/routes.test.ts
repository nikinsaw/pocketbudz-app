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

describe('visibility routes', () => {
  it('requires authentication', async () => {
    expect((await app.inject({ method: 'GET', url: '/households/x/visibility' })).statusCode).toBe(401);
  });

  it('sets, reads and resets sharing settings', async () => {
    const owner = await makeUser(prisma, 'owner');
    const spender = await makeUser(prisma, 'spender');
    const household = await makeHousehold(prisma, [
      { userId: owner.id, role: 'OWNER' },
      { userId: spender.id, role: 'SPENDER' },
    ]);
    const ownerMembership = household.members.find((m) => m.userId === owner.id)!;
    const headers = { authorization: `Bearer ${await signAccessToken(spender.id)}` };
    const base = `/households/${household.id}/visibility`;

    const put = await app.inject({ method: 'PUT', url: `${base}/${ownerMembership.id}`, headers, payload: { level: 'FULL' } });
    expect(put.statusCode).toBe(200);
    const overview = await app.inject({ method: 'GET', url: base, headers });
    expect(overview.json().members[0]).toMatchObject({ explicit: 'FULL', effective: 'FULL' });

    expect((await app.inject({ method: 'DELETE', url: `${base}/${ownerMembership.id}`, headers })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: base, headers })).json().members[0].explicit).toBeNull();

    const bad = await app.inject({ method: 'PUT', url: `${base}/everyone`, headers, payload: { level: 'ALL' } });
    expect(bad.statusCode).toBe(400);
    const hide = await app.inject({ method: 'PUT', url: `${base}/${ownerMembership.id}`, headers, payload: { level: 'NONE' } });
    expect(hide.statusCode).toBe(400);
  });
});
