import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createAuthService } from '../auth/service.js';
import { signAccessToken } from '../auth/tokens.js';
import { prisma } from '../db.js';
import { CONSENT_VERSION, createHouseholdService } from './service.js';
import { makeUser, resetDb } from './testUtils.js';

const app = buildApp({
  auth: createAuthService(prisma, async () => {
    throw new Error('unused');
  }),
  households: createHouseholdService(prisma),
});

beforeEach(() => resetDb(prisma));
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function asUser(name: string) {
  const user = await makeUser(prisma, name);
  const headers = { authorization: `Bearer ${await signAccessToken(user.id)}` };
  return { user, headers };
}

describe('household routes', () => {
  it('requires authentication', async () => {
    expect((await app.inject({ method: 'GET', url: '/households' })).statusCode).toBe(401);
  });

  it('serves the consent version publicly', async () => {
    const res = await app.inject({ method: 'GET', url: '/consent' });
    expect(res.json()).toEqual({ version: CONSENT_VERSION });
  });

  it('runs the full create, invite, join, leave flow', async () => {
    const owner = await asUser('owner');
    const spender = await asUser('spender');

    const created = await app.inject({
      method: 'POST', url: '/households', headers: owner.headers,
      payload: { name: 'Sharma family', consentVersion: CONSENT_VERSION },
    });
    expect(created.statusCode).toBe(201);
    const householdId = created.json().id;

    const invite = await app.inject({
      method: 'POST', url: `/households/${householdId}/invites`, headers: owner.headers,
      payload: { role: 'SPENDER' },
    });
    expect(invite.statusCode).toBe(201);

    const joined = await app.inject({
      method: 'POST', url: '/invites/join', headers: spender.headers,
      payload: { code: invite.json().code, consentVersion: CONSENT_VERSION },
    });
    expect(joined.statusCode).toBe(200);
    expect(joined.json()).toMatchObject({ householdId, role: 'SPENDER' });

    const members = await app.inject({
      method: 'GET', url: `/households/${householdId}/members`, headers: spender.headers,
    });
    expect(members.json()).toHaveLength(2);

    const left = await app.inject({
      method: 'POST', url: `/households/${householdId}/leave`, headers: spender.headers,
    });
    expect(left.json()).toEqual({ householdDeleted: false });
  });

  it('returns 403 when a spender tries to invite and 404 for outsiders', async () => {
    const owner = await asUser('owner');
    const spender = await asUser('spender');
    const outsider = await asUser('outsider');
    const { id } = (
      await app.inject({
        method: 'POST', url: '/households', headers: owner.headers,
        payload: { name: 'H', consentVersion: CONSENT_VERSION },
      })
    ).json();
    const { code } = (
      await app.inject({
        method: 'POST', url: `/households/${id}/invites`, headers: owner.headers,
        payload: { role: 'SPENDER' },
      })
    ).json();
    await app.inject({
      method: 'POST', url: '/invites/join', headers: spender.headers,
      payload: { code, consentVersion: CONSENT_VERSION },
    });

    const forbidden = await app.inject({
      method: 'POST', url: `/households/${id}/invites`, headers: spender.headers,
      payload: { role: 'EARNER' },
    });
    expect(forbidden.statusCode).toBe(403);

    const hidden = await app.inject({
      method: 'GET', url: `/households/${id}/members`, headers: outsider.headers,
    });
    expect(hidden.statusCode).toBe(404);
  });

  it('validates input: no owner invites, no blank names', async () => {
    const owner = await asUser('owner');
    const bad = await app.inject({
      method: 'POST', url: '/households', headers: owner.headers,
      payload: { name: '  ', consentVersion: CONSENT_VERSION },
    });
    expect(bad.statusCode).toBe(400);
    const { id } = (
      await app.inject({
        method: 'POST', url: '/households', headers: owner.headers,
        payload: { name: 'H', consentVersion: CONSENT_VERSION },
      })
    ).json();
    const ownerInvite = await app.inject({
      method: 'POST', url: `/households/${id}/invites`, headers: owner.headers,
      payload: { role: 'OWNER' },
    });
    expect(ownerInvite.statusCode).toBe(400);
  });
});
