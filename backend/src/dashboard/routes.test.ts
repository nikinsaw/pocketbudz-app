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

describe('dashboard route', () => {
  it('requires authentication', async () => {
    expect((await app.inject({ method: 'GET', url: '/households/x/dashboard' })).statusCode).toBe(401);
  });

  it('returns the dashboard for the caller’s date', async () => {
    const user = await makeUser(prisma, 'asha');
    const household = await makeHousehold(prisma, [{ userId: user.id, role: 'OWNER' }]);
    const headers = { authorization: `Bearer ${await signAccessToken(user.id)}` };

    const res = await app.inject({ method: 'GET', url: `/households/${household.id}/dashboard?today=2026-10-12`, headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.period).toEqual({ from: '2026-10-01', to: '2026-10-31', daysTotal: 31, daysElapsed: 12 });
    expect(body.me.role).toBe('OWNER');
    expect(body.household.name).toBe('Test home');
  });

  it('defaults to the server’s date when none is given', async () => {
    const user = await makeUser(prisma, 'asha');
    const household = await makeHousehold(prisma, [{ userId: user.id, role: 'OWNER' }]);
    const headers = { authorization: `Bearer ${await signAccessToken(user.id)}` };
    const res = await app.inject({ method: 'GET', url: `/households/${household.id}/dashboard`, headers });
    expect(res.statusCode).toBe(200);
    const today = new Date().toISOString().slice(0, 10);
    expect(res.json().period.from <= today && today <= res.json().period.to).toBe(true);
  });

  it('rejects a malformed or impossible date with 400', async () => {
    const user = await makeUser(prisma, 'asha');
    const household = await makeHousehold(prisma, [{ userId: user.id, role: 'OWNER' }]);
    const headers = { authorization: `Bearer ${await signAccessToken(user.id)}` };
    for (const today of ['yesterday', '2026-02-31', '12-10-2026']) {
      const res = await app.inject({ method: 'GET', url: `/households/${household.id}/dashboard?today=${today}`, headers });
      expect([today, res.statusCode]).toEqual([today, 400]);
    }
  });

  it('hides the household from non-members', async () => {
    const owner = await makeUser(prisma, 'owner');
    const outsider = await makeUser(prisma, 'outsider');
    const household = await makeHousehold(prisma, [{ userId: owner.id, role: 'OWNER' }]);
    const headers = { authorization: `Bearer ${await signAccessToken(outsider.id)}` };
    expect((await app.inject({ method: 'GET', url: `/households/${household.id}/dashboard`, headers })).statusCode).toBe(404);
  });
});
