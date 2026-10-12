import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createAllowanceService } from '../allowances/service.js';
import { prisma } from '../db.js';
import { createEnvelopeService } from '../envelopes/service.js';
import { createIncomeService } from '../income/service.js';
import { createTransactionService } from '../transactions/service.js';
import { createVisibilityService } from '../visibility/service.js';
import { createHouseholdService } from './service.js';
import { makeHousehold, makeUser, resetDb } from './testUtils.js';

const households = createHouseholdService(prisma);
const transactions = createTransactionService(prisma);
const envelopes = createEnvelopeService(prisma);
const visibility = createVisibilityService(prisma);
const income = createIncomeService(prisma);
const allowances = createAllowanceService(prisma);
const fields = { categoryKey: 'fun', icon: '🎮', title: 'Fun', colorKey: 'fun', type: 'monthly', budgetLimit: 100000 };
const tx = (merchant: string, extra = {}) => ({ envelopeId: null, merchant, category: 'Fun', amount: 10000, date: '2026-10-05', ...extra });

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

async function setup() {
  const owner = await makeUser(prisma, 'owner');
  const earner = await makeUser(prisma, 'earner');
  const spender = await makeUser(prisma, 'spender');
  const household = await makeHousehold(prisma, [
    { userId: owner.id, role: 'OWNER' },
    { userId: earner.id, role: 'EARNER' },
    { userId: spender.id, role: 'SPENDER' },
  ]);
  const m = (userId: string) => household.members.find((x) => x.userId === userId)!;
  return { owner, earner, spender, household, mOwner: m(owner.id), mEarner: m(earner.id), mSpender: m(spender.id) };
}

describe('leaving cleans up personal data but keeps anonymous totals', () => {
  it("removes a spender's envelopes, grants and allowances, and downgrades itemised detail to totals", async () => {
    const { owner, spender, household, mOwner, mSpender } = await setup();
    await visibility.set(spender.id, household.id, mOwner.id, 'FULL');
    await envelopes.create(spender.id, household.id, { ...fields, scope: 'PERSONAL' });
    await allowances.set(owner.id, household.id, mSpender.id, 100000);
    await transactions.create(spender.id, household.id, tx('Game'));
    expect((await transactions.list(owner.id, household.id)).map((t) => t.merchant)).toEqual(['Game']);

    await households.leave(spender.id, household.id);

    expect(await prisma.envelope.count()).toBe(0);
    expect(await prisma.visibilityGrant.count()).toBe(0);
    expect(await prisma.allowance.count()).toBe(0);
    // The merchant is no longer readable, but the amount is still in the household's totals.
    expect(await transactions.list(owner.id, household.id)).toEqual([]);
    const seen = (await visibility.spending(owner.id, household.id)).find((r) => r.name === 'Former member')!;
    expect(seen).toMatchObject({ privateSpent: 10000, itemisedSpent: 0 });
    expect(await prisma.transaction.count()).toBe(1);
  });

  it("removes an earner's income so it stops counting toward the household", async () => {
    const { owner, earner, household } = await setup();
    await income.create(owner.id, household.id, { label: 'Salary', amount: 5000000 });
    await income.create(earner.id, household.id, { label: 'Freelance', amount: 2000000 });
    await households.leave(earner.id, household.id);
    expect((await income.list(owner.id, household.id)).total).toBe(5000000);
  });

  it('keeps shared-envelope spending itemised as Former member', async () => {
    const { owner, spender, household } = await setup();
    const shared = await envelopes.create(owner.id, household.id, { ...fields, scope: 'SHARED' });
    await transactions.create(spender.id, household.id, tx('Milk', { envelopeId: shared.id }));
    await households.leave(spender.id, household.id);
    const rows = await transactions.list(owner.id, household.id);
    expect(rows.map((r) => [r.merchant, r.member.name])).toEqual([['Milk', 'Former member']]);
  });

  it("drops the stamps that let a leaving earner view others' spending", async () => {
    const { spender, earner, household, mEarner } = await setup();
    await visibility.set(spender.id, household.id, mEarner.id, 'FULL');
    await transactions.create(spender.id, household.id, tx('Game'));
    expect(await prisma.transactionVisibility.count({ where: { viewerId: mEarner.id } })).toBe(1);

    await households.leave(earner.id, household.id);

    expect(await prisma.transactionVisibility.count({ where: { viewerId: mEarner.id } })).toBe(0);
    // The spender's own view of their spending is unaffected.
    expect((await transactions.list(spender.id, household.id)).map((t) => t.merchant)).toEqual(['Game']);
  });
});
