import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { signAccessToken } from '../auth/tokens.js';
import { prisma } from '../db.js';
import { CONSENT_VERSION } from '../households/service.js';
import { makeHousehold, makeUser, resetDb } from '../households/testUtils.js';
import { createServices } from '../services.js';

const makeApp = () =>
  buildApp(
    createServices(prisma, async (idToken) => {
      if (idToken !== 'good') throw new Error('bad');
      return { sub: 'sub-asha', email: 'asha@example.com', name: 'Asha' };
    }),
  );
let app: ReturnType<typeof makeApp>;

beforeEach(async () => {
  await resetDb(prisma);
  app = makeApp();
});
afterEach(() => app.close());
afterAll(() => prisma.$disconnect());

const asUser = async (id: string) => ({ authorization: `Bearer ${await signAccessToken(id)}` });
const del = async (id: string, payload: unknown = { confirm: 'DELETE' }) =>
  app.inject({ method: 'DELETE', url: '/me', headers: await asUser(id), payload: payload as object });

describe('DELETE /me', () => {
  it('needs the explicit confirmation word', async () => {
    const user = await makeUser(prisma, 'solo');
    expect((await del(user.id, {})).statusCode).toBe(400);
    expect((await del(user.id, { confirm: 'yes' })).statusCode).toBe(400);
    expect(await prisma.user.count()).toBe(1);
  });

  it('erases a solo account with its sessions and agreements', async () => {
    const user = await makeUser(prisma, 'solo');
    await prisma.consentRecord.create({ data: { userId: user.id, version: CONSENT_VERSION } });
    await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: 'h', expiresAt: new Date(Date.now() + 1e9) } });
    expect((await del(user.id)).statusCode).toBe(204);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.consentRecord.count()).toBe(0);
    expect(await prisma.refreshToken.count()).toBe(0);
  });

  it('leaves the household with spending kept only as anonymous totals and no personal details', async () => {
    const owner = await makeUser(prisma, 'owner');
    const spender = await makeUser(prisma, 'spender');
    const household = await makeHousehold(prisma, [
      { userId: owner.id, role: 'OWNER' },
      { userId: spender.id, role: 'SPENDER' },
    ]);
    const mine = household.members.find((m) => m.userId === spender.id)!;
    await prisma.transaction.create({
      data: { householdId: household.id, memberId: mine.id, merchant: 'Cafe', category: 'Food', amount: 25000, date: new Date('2026-10-01') },
    });

    expect((await del(spender.id)).statusCode).toBe(204);

    expect(await prisma.user.findUnique({ where: { id: spender.id } })).toBeNull();
    const kept = await prisma.membership.findUniqueOrThrow({ where: { id: mine.id } });
    expect([kept.userId, kept.leftAt === null]).toEqual([null, false]);
    expect(await prisma.transaction.count({ where: { memberId: mine.id } })).toBe(1);
    // Nothing in the database still carries the deleted person's identity.
    const dump = JSON.stringify({
      users: await prisma.user.findMany(),
      memberships: await prisma.membership.findMany(),
    });
    expect(dump).not.toContain('spender@example.com');
    expect(dump).not.toContain('sub-spender');
  });

  it('deletes a household the user was alone in', async () => {
    const user = await makeUser(prisma, 'solo');
    await makeHousehold(prisma, [{ userId: user.id, role: 'OWNER' }]);
    expect((await del(user.id)).statusCode).toBe(204);
    expect(await prisma.household.count()).toBe(0);
  });

  it('blocks a sole owner of a household with others, and changes nothing', async () => {
    const owner = await makeUser(prisma, 'owner');
    const spender = await makeUser(prisma, 'spender');
    const household = await makeHousehold(prisma, [
      { userId: owner.id, role: 'OWNER' },
      { userId: spender.id, role: 'SPENDER' },
    ]);
    const res = await del(owner.id);
    expect(res.statusCode).toBe(409);
    expect(await prisma.user.count()).toBe(2);
    expect(await prisma.membership.count({ where: { householdId: household.id, leftAt: null } })).toBe(2);

    // After handing over ownership the same request succeeds.
    const target = household.members.find((m) => m.userId === spender.id)!;
    const transfer = await app.inject({
      method: 'POST', url: `/households/${household.id}/members/${target.id}/make-owner`, headers: await asUser(owner.id),
    });
    expect(transfer.statusCode).toBe(200);
    expect((await del(owner.id)).statusCode).toBe(204);
    expect(await prisma.household.count()).toBe(1);
  });

  it('rejects the deleted account\'s still-valid access token everywhere, including household creation', async () => {
    const user = await makeUser(prisma, 'solo');
    const headers = await asUser(user.id);
    await del(user.id);
    for (const [method, url] of [['GET', '/me'], ['GET', '/households'], ['POST', '/households']] as const) {
      const res = await app.inject({ method, url, headers, payload: method === 'POST' ? { name: 'x', consentVersion: CONSENT_VERSION } : undefined });
      expect([method, url, res.statusCode]).toEqual([method, url, 401]);
    }
    expect(await prisma.household.count()).toBe(0);
  });

  it('kills refresh tokens, and signing in again starts a brand-new empty account', async () => {
    const login = () => app.inject({ method: 'POST', url: '/auth/google', payload: { idToken: 'good' } });
    const first = (await login()).json();
    await app.inject({
      method: 'POST', url: '/households', headers: { authorization: `Bearer ${first.accessToken}` },
      payload: { name: 'Home', consentVersion: CONSENT_VERSION },
    });
    expect((await del(first.user.id)).statusCode).toBe(204);

    const refresh = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: first.refreshToken } });
    expect(refresh.statusCode).toBe(401);

    const again = (await login()).json();
    expect(again.user.id).not.toBe(first.user.id);
    const mine = await app.inject({ method: 'GET', url: '/households', headers: { authorization: `Bearer ${again.accessToken}` } });
    expect(mine.json()).toEqual([]);
  });
});
