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
  categoryKey: 'fun', icon: '🎮', title: 'Fun', colorKey: 'fun', type: 'monthly', budgetLimit: 500000,
};
const tx = (merchant: string, extra = {}) => ({
  envelopeId: null, merchant, category: 'Fun', amount: 10000, date: '2026-10-05', ...extra,
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
  const m = (userId: string) => household.members.find((x) => x.userId === userId)!;
  const merchants = async (userId: string) =>
    (await transactions.list(userId, household.id)).map((t) => t.merchant).sort();
  return { owner, spender, spender2, household, mOwner: m(owner.id), mSpender2: m(spender2.id), merchants };
}

describe('stamping on create', () => {
  it('defaults: earner gets a TOTAL stamp (not itemised), fellow spender gets nothing', async () => {
    const { owner, spender, spender2, household, mOwner, merchants } = await setup();
    const created = await transactions.create(spender.id, household.id, tx('Game'));
    const stamps = await prisma.transactionVisibility.findMany({ where: { transactionId: created.id } });
    expect(stamps).toEqual([{ transactionId: created.id, viewerId: mOwner.id, level: 'TOTAL' }]);
    expect(await merchants(owner.id)).toEqual([]);
    expect(await merchants(spender2.id)).toEqual([]);
    expect(await merchants(spender.id)).toEqual(['Game']);
  });

  it('FULL share lets the chosen viewer itemise, and nobody else', async () => {
    const { owner, spender, spender2, household, mOwner, merchants } = await setup();
    await visibility.set(spender.id, household.id, mOwner.id, 'FULL');
    await transactions.create(spender.id, household.id, tx('Game'));
    expect(await merchants(owner.id)).toEqual(['Game']);
    expect(await merchants(spender2.id)).toEqual([]);
  });

  it('shared-envelope spending is never stamped', async () => {
    const { owner, spender, household } = await setup();
    const shared = await envelopes.create(owner.id, household.id, { ...envelopeFields, scope: 'SHARED' });
    const created = await transactions.create(spender.id, household.id, tx('Milk', { envelopeId: shared.id }));
    expect(await prisma.transactionVisibility.count({ where: { transactionId: created.id } })).toBe(0);
  });
});

describe('changing a setting only affects future transactions', () => {
  it('sharing more later does not expose earlier spending', async () => {
    const { owner, spender, household, mOwner, merchants } = await setup();
    await transactions.create(spender.id, household.id, tx('Before'));
    await visibility.set(spender.id, household.id, mOwner.id, 'FULL');
    await transactions.create(spender.id, household.id, tx('After'));
    expect(await merchants(owner.id)).toEqual(['After']);
  });

  it('sharing less later does not hide earlier spending', async () => {
    const { owner, spender, household, mOwner, merchants } = await setup();
    await visibility.set(spender.id, household.id, mOwner.id, 'FULL');
    await transactions.create(spender.id, household.id, tx('Before'));
    await visibility.set(spender.id, household.id, mOwner.id, 'TOTAL');
    await transactions.create(spender.id, household.id, tx('After'));
    expect(await merchants(owner.id)).toEqual(['Before']);
  });

  it("a member who joins later has no stamps for old spending", async () => {
    const { spender, household } = await setup();
    await visibility.set(spender.id, household.id, 'everyone', 'FULL');
    const created = await transactions.create(spender.id, household.id, tx('Old'));
    const late = await makeUser(prisma, 'late');
    await prisma.membership.create({ data: { householdId: household.id, userId: late.id, role: 'EARNER' } });
    expect(await transactions.list(late.id, household.id)).toEqual([]);
    expect(await prisma.transactionVisibility.count({ where: { transactionId: created.id } })).toBe(2);
  });
});

describe('moving a transaction between envelopes', () => {
  it('re-stamps when going private and clears stamps when going shared', async () => {
    const { owner, spender, household, mOwner } = await setup();
    await visibility.set(spender.id, household.id, mOwner.id, 'FULL');
    const shared = await envelopes.create(owner.id, household.id, { ...envelopeFields, scope: 'SHARED' });
    const created = await transactions.create(spender.id, household.id, tx('Thing', { envelopeId: shared.id }));
    expect(await prisma.transactionVisibility.count({ where: { transactionId: created.id } })).toBe(0);

    await transactions.update(spender.id, household.id, created.id, { envelopeId: null });
    expect(await prisma.transactionVisibility.count({ where: { transactionId: created.id } })).toBe(1);

    await transactions.update(spender.id, household.id, created.id, { envelopeId: shared.id });
    expect(await prisma.transactionVisibility.count({ where: { transactionId: created.id } })).toBe(0);
  });
});

describe('viewing is not editing', () => {
  it('a FULL viewer can see but not change or delete (403), others get 404', async () => {
    const { owner, spender, spender2, household, mOwner } = await setup();
    await visibility.set(spender.id, household.id, mOwner.id, 'FULL');
    const created = await transactions.create(spender.id, household.id, tx('Game'));
    await expect(transactions.update(owner.id, household.id, created.id, { amount: 1 })).rejects.toMatchObject({ status: 403 });
    await expect(transactions.remove(owner.id, household.id, created.id)).rejects.toMatchObject({ status: 403 });
    await expect(transactions.remove(spender2.id, household.id, created.id)).rejects.toMatchObject({ status: 404 });
  });
});
