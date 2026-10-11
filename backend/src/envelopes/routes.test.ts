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
const body = {
  scope: 'SHARED', categoryKey: 'rent', icon: '🏠', title: 'Rent', colorKey: 'rent', type: 'monthly', budgetLimit: 1500000,
};

beforeEach(() => resetDb(prisma));
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function setup() {
  const owner = await makeUser(prisma, 'owner');
  const household = await makeHousehold(prisma, [{ userId: owner.id, role: 'OWNER' }]);
  const headers = { authorization: `Bearer ${await signAccessToken(owner.id)}` };
  return { household, headers };
}

describe('envelope routes', () => {
  it('requires authentication', async () => {
    const { household } = await setup();
    const res = await app.inject({ method: 'GET', url: `/households/${household.id}/envelopes` });
    expect(res.statusCode).toBe(401);
  });

  it('creates, lists, edits and deletes', async () => {
    const { household, headers } = await setup();
    const base = `/households/${household.id}/envelopes`;
    const created = await app.inject({ method: 'POST', url: base, headers, payload: body });
    expect(created.statusCode).toBe(201);
    const { id } = created.json();

    expect((await app.inject({ method: 'GET', url: base, headers })).json()).toHaveLength(1);
    const patched = await app.inject({ method: 'PATCH', url: `${base}/${id}`, headers, payload: { budgetLimit: 1600000 } });
    expect(patched.json().budgetLimit).toBe(1600000);
    expect((await app.inject({ method: 'DELETE', url: `${base}/${id}`, headers })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: base, headers })).json()).toHaveLength(0);
  });

  it('rejects bad input: fractional or negative paise, empty patch, unknown scope', async () => {
    const { household, headers } = await setup();
    const base = `/households/${household.id}/envelopes`;
    for (const payload of [
      { ...body, budgetLimit: 10.5 },
      { ...body, budgetLimit: -1 },
      { ...body, scope: 'PUBLIC' },
      { ...body, title: '   ' },
    ]) {
      expect((await app.inject({ method: 'POST', url: base, headers, payload })).statusCode).toBe(400);
    }
    const { id } = (await app.inject({ method: 'POST', url: base, headers, payload: body })).json();
    expect((await app.inject({ method: 'PATCH', url: `${base}/${id}`, headers, payload: {} })).statusCode).toBe(400);
  });
});
