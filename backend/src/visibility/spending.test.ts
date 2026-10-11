import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../db.js';
import { createEnvelopeService } from '../envelopes/service.js';
import { makeHousehold, makeUser, resetDb } from '../households/testUtils.js';
import { createTransactionService } from '../transactions/service.js';
import { createVisibilityService } from './service.js';

const transactions = createTransactionService(prisma);
const envelopes = createEnvelopeService(prisma);
const visibility = createVisibilityService(prisma);
const envelopeFields = {
  categoryKey: 'food', icon: '🍕', title: 'Food', colorKey: 'food', type: 'monthly', budgetLimit: 500000,
};
const tx = (amount: number, extra = {}) => ({
  envelopeId: null, merchant: 'Shop', category: 'Food', amount, date: '2026-10-05', ...extra,
});

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

async function setup() {
  const owner = await makeUser(prisma, 'owner');
  const spender = await makeUser(prisma, 'spender');
  const spender2 = await makeUser(prisma, 'spender2');
  const household = await makeHousehold(prisma, [
    { userId: owner.id, role: 'OWNER' },
    { userId: spender.id, role: 'SPENDER' },
    { userId: spender2.id, role: 'SPENDER' },
  ]);
  const shared = await envelopes.create(owner.id, household.id, { ...envelopeFields, scope: 'SHARED' });
  const m = (userId: string) => household.members.find((x) => x.userId === userId)!;
  const view = async (userId: string, range = {}) =>
    Object.fromEntries((await visibility.spending(userId, household.id, range)).map((r) => [r.name, r]));
  return { owner, spender, spender2, household, shared, mOwner: m(owner.id), view };
}

describe('spending summary', () => {
  it('an earner sees a non-sharing spender\'s total but nothing itemised', async () => {
    const { owner, spender, household, shared, view } = await setup();
    await transactions.create(spender.id, household.id, tx(30000, { envelopeId: shared.id }));
    await transactions.create(spender.id, household.id, tx(20000));
    await transactions.create(spender.id, household.id, tx(5000));

    const seen = (await view(owner.id)).spender;
    expect(seen).toMatchObject({ sharedSpent: 30000, privateSpent: 25000, itemisedSpent: 0, currentLevel: 'TOTAL' });
  });

  it('an earner sees the full breakdown once the spender shares it', async () => {
    const { owner, spender, household, mOwner, view } = await setup();
    await visibility.set(spender.id, household.id, mOwner.id, 'FULL');
    await transactions.create(spender.id, household.id, tx(20000));
    expect((await view(owner.id)).spender).toMatchObject({ privateSpent: 20000, itemisedSpent: 20000, currentLevel: 'FULL' });
  });

  it('a fellow spender sees only shared-envelope spending, not private totals', async () => {
    const { spender, spender2, household, shared, view } = await setup();
    await transactions.create(spender.id, household.id, tx(30000, { envelopeId: shared.id }));
    await transactions.create(spender.id, household.id, tx(20000));
    expect((await view(spender2.id)).spender).toMatchObject({ sharedSpent: 30000, privateSpent: 0, itemisedSpent: 0, currentLevel: 'NONE' });
  });

  it('a spender sees their own spending in full', async () => {
    const { spender, household, shared, view } = await setup();
    await transactions.create(spender.id, household.id, tx(30000, { envelopeId: shared.id }));
    await transactions.create(spender.id, household.id, tx(20000));
    expect((await view(spender.id)).spender).toMatchObject({
      isMe: true, sharedSpent: 30000, privateSpent: 20000, itemisedSpent: 20000,
    });
  });

  it('respects the date range', async () => {
    const { owner, spender, household, view } = await setup();
    await transactions.create(spender.id, household.id, tx(1000, { date: '2026-09-30' }));
    await transactions.create(spender.id, household.id, tx(2000, { date: '2026-10-10' }));
    const seen = (await view(owner.id, { from: '2026-10-01', to: '2026-10-31' })).spender;
    expect(seen.privateSpent).toBe(2000);
  });

  it('keeps a leaver\'s visible spending as "Former member" and drops empty leavers', async () => {
    const { owner, spender, spender2, household, shared, view } = await setup();
    await transactions.create(spender.id, household.id, tx(30000, { envelopeId: shared.id }));
    await prisma.membership.updateMany({ where: { userId: spender.id }, data: { userId: null, leftAt: new Date() } });
    await prisma.membership.updateMany({ where: { userId: spender2.id }, data: { userId: null, leftAt: new Date() } });
    const seen = await view(owner.id);
    expect(seen['Former member']).toMatchObject({ sharedSpent: 30000 });
    expect(Object.keys(seen)).toEqual(['owner', 'Former member']);
  });

  it('is closed to non-members', async () => {
    const { household } = await setup();
    const outsider = await makeUser(prisma, 'outsider');
    await expect(visibility.spending(outsider.id, household.id)).rejects.toMatchObject({ status: 404 });
  });
});
