import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { signAccessToken } from '../auth/tokens.js';
import { prisma } from '../db.js';
import { createServices } from '../services.js';
import { makeHousehold, makeUser, resetDb } from './testUtils.js';

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

async function setup() {
  const owner = await makeUser(prisma, 'owner');
  const spender = await makeUser(prisma, 'spender');
  const outsider = await makeUser(prisma, 'outsider');
  const household = await makeHousehold(prisma, [
    { userId: owner.id, role: 'OWNER' },
    { userId: spender.id, role: 'SPENDER' },
  ]);
  const auth = async (userId: string) => ({ authorization: `Bearer ${await signAccessToken(userId)}` });
  return { household, owner: await auth(owner.id), spender: await auth(spender.id), outsider: await auth(outsider.id) };
}

describe('household settings', () => {
  it('lets any member read and only the owner change them', async () => {
    const { household, owner, spender } = await setup();
    const url = `/households/${household.id}`;
    expect((await app.inject({ method: 'GET', url, headers: spender })).json()).toMatchObject({
      currencyFormat: 'indian', budgetCycleStartDay: 1,
    });

    const changed = await app.inject({
      method: 'PATCH', url, headers: owner,
      payload: { name: 'Sharma home', currencyFormat: 'international', budgetCycleStartDay: 15 },
    });
    expect(changed.json()).toMatchObject({ name: 'Sharma home', currencyFormat: 'international', budgetCycleStartDay: 15 });
    expect((await app.inject({ method: 'PATCH', url, headers: spender, payload: { name: 'Mine now' } })).statusCode).toBe(403);
  });

  it('hides the household from outsiders and validates input', async () => {
    const { household, owner, outsider } = await setup();
    const url = `/households/${household.id}`;
    expect((await app.inject({ method: 'GET', url, headers: outsider })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PATCH', url, headers: outsider, payload: { name: 'x' } })).statusCode).toBe(404);
    for (const payload of [{}, { name: ' ' }, { currencyFormat: 'euro' }, { budgetCycleStartDay: 31 }, { budgetCycleStartDay: 0 }]) {
      expect((await app.inject({ method: 'PATCH', url, headers: owner, payload })).statusCode).toBe(400);
    }
  });
});
