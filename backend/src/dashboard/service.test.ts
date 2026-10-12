import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createAllowanceService } from '../allowances/service.js';
import { prisma } from '../db.js';
import { createEnvelopeService } from '../envelopes/service.js';
import { makeHousehold, makeUser, resetDb } from '../households/testUtils.js';
import { createIncomeService } from '../income/service.js';
import { createTransactionService } from '../transactions/service.js';
import { createVisibilityService } from '../visibility/service.js';
import { createDashboardService } from './service.js';

const dashboard = createDashboardService(prisma);
const envelopes = createEnvelopeService(prisma);
const transactions = createTransactionService(prisma);
const income = createIncomeService(prisma);
const allowances = createAllowanceService(prisma);
const visibility = createVisibilityService(prisma);

const TODAY = '2026-10-12'; // cycle: 2026-10-01 .. 2026-10-31 (household default start day 1)
const envFields = (title: string, budgetLimit: number) => ({
  categoryKey: title.toLowerCase(), icon: '🧾', title, colorKey: 'groceries', type: 'spending', budgetLimit,
});
const tx = (amount: number, extra: Record<string, unknown> = {}) => ({
  envelopeId: null, merchant: 'Shop', category: 'Misc', amount, date: '2026-10-05', ...extra,
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
  const groceries = await envelopes.create(owner.id, household.id, { ...envFields('Groceries', 1000000), scope: 'SHARED' });
  const rent = await envelopes.create(owner.id, household.id, { ...envFields('Rent', 2500000), type: 'fixed', scope: 'SHARED' });
  const get = (userId: string, today = TODAY) => dashboard.get(userId, household.id, today);
  return { owner, spender, spender2, household, groceries, rent, mOwner: m(owner.id), mSpender: m(spender.id), get };
}

describe('period', () => {
  it('uses the household cycle start day and the caller’s date', async () => {
    const { owner, household, get } = await setup();
    expect((await get(owner.id)).period).toEqual({ from: '2026-10-01', to: '2026-10-31', daysTotal: 31, daysElapsed: 12 });
    await prisma.household.update({ where: { id: household.id }, data: { budgetCycleStartDay: 15 } });
    // Today (Oct 12) is before the 15th, so the cycle began on Sep 15.
    expect((await get(owner.id)).period).toMatchObject({ from: '2026-09-15', to: '2026-10-14' });
    expect((await get(owner.id, '2026-10-20')).period).toMatchObject({ from: '2026-10-15', to: '2026-11-14' });
  });

  it('rejects an invalid date', async () => {
    const { owner, household } = await setup();
    await expect(dashboard.get(owner.id, household.id, '2026-02-31')).rejects.toMatchObject({ status: 400 });
  });

  it('only counts spending inside the cycle', async () => {
    const { spender, household, groceries, get } = await setup();
    for (const date of ['2026-09-30', '2026-10-01', '2026-10-31', '2026-11-01']) {
      await transactions.create(spender.id, household.id, tx(1000, { envelopeId: groceries.id, date }));
    }
    const view = await get(spender.id);
    expect(view.envelopes.find((e) => e.title === 'Groceries')!.spent).toBe(2000); // Oct 1 and Oct 31 only
  });
});

describe('shared envelopes', () => {
  it('sums everyone’s spending in a shared envelope, identically for every member', async () => {
    const { owner, spender, spender2, household, groceries, get } = await setup();
    await transactions.create(spender.id, household.id, tx(30000, { envelopeId: groceries.id }));
    await transactions.create(spender2.id, household.id, tx(20000, { envelopeId: groceries.id }));
    await transactions.create(owner.id, household.id, tx(10000, { envelopeId: groceries.id }));

    for (const user of [owner, spender, spender2]) {
      const view = await get(user.id);
      const e = view.envelopes.find((x) => x.title === 'Groceries')!;
      expect([e.budgetLimit, e.spent, e.scope, e.owner]).toEqual([1000000, 60000, 'SHARED', null]);
    }
  });

  it('reports shared budget vs shared spend in the headline', async () => {
    const { spender, household, groceries, get } = await setup();
    await transactions.create(spender.id, household.id, tx(30000, { envelopeId: groceries.id }));
    const { headline } = await get(spender.id);
    expect(headline.sharedBudget).toBe(3500000); // groceries 10,000 + rent 25,000 rupees
    expect(headline.sharedBudgetSpent).toBe(30000);
  });
});

describe('personal spending and visibility', () => {
  it('a spender sees their own personal envelope and spend; nobody else does by default', async () => {
    const { owner, spender, spender2, household, get } = await setup();
    const pocket = await envelopes.create(spender.id, household.id, { ...envFields('Pocket money', 500000), scope: 'PERSONAL' });
    await transactions.create(spender.id, household.id, tx(15000, { envelopeId: pocket.id }));

    const mine = (await get(spender.id)).envelopes.find((e) => e.title === 'Pocket money')!;
    expect([mine.spent, mine.mine, mine.owner]).toEqual([15000, true, null]);
    for (const other of [owner, spender2]) {
      expect((await get(other.id)).envelopes.map((e) => e.title)).not.toContain('Pocket money');
    }
  });

  it('shares the envelope and its itemised spending with a viewer chosen at FULL', async () => {
    const { owner, spender, household, mOwner, get } = await setup();
    const pocket = await envelopes.create(spender.id, household.id, { ...envFields('Pocket money', 500000), scope: 'PERSONAL' });
    await visibility.set(spender.id, household.id, mOwner.id, 'FULL');
    await transactions.create(spender.id, household.id, tx(15000, { envelopeId: pocket.id }));

    const seen = (await get(owner.id)).envelopes.find((e) => e.title === 'Pocket money')!;
    expect([seen.spent, seen.mine, seen.owner]).toEqual([15000, false, 'spender']);
  });

  it('only counts the transactions that were stamped FULL (earlier ones stay private)', async () => {
    const { owner, spender, household, mOwner, get } = await setup();
    const pocket = await envelopes.create(spender.id, household.id, { ...envFields('Pocket money', 500000), scope: 'PERSONAL' });
    await transactions.create(spender.id, household.id, tx(40000, { envelopeId: pocket.id })); // before sharing
    await visibility.set(spender.id, household.id, mOwner.id, 'FULL');
    await transactions.create(spender.id, household.id, tx(15000, { envelopeId: pocket.id })); // after
    expect((await get(owner.id)).envelopes.find((e) => e.title === 'Pocket money')!.spent).toBe(15000);
    expect((await get(spender.id)).envelopes.find((e) => e.title === 'Pocket money')!.spent).toBe(55000);
  });

  it('an earner sees a non-sharing spender’s total but not their envelope or details', async () => {
    const { owner, spender, household, groceries, get } = await setup();
    const pocket = await envelopes.create(spender.id, household.id, { ...envFields('Pocket money', 500000), scope: 'PERSONAL' });
    await transactions.create(spender.id, household.id, tx(30000, { envelopeId: groceries.id }));
    await transactions.create(spender.id, household.id, tx(15000, { envelopeId: pocket.id }));
    await transactions.create(spender.id, household.id, tx(5000));

    const view = await get(owner.id);
    const row = view.members.find((m) => m.name === 'spender')!;
    expect(row).toMatchObject({ sharedSpent: 30000, privateSpent: 20000, itemisedSpent: 0 });
    expect(view.envelopes.map((e) => e.title)).not.toContain('Pocket money');
    expect(JSON.stringify(view)).not.toContain('Shop'); // no merchant names anywhere
  });

  it('a fellow spender sees shared spending only, never another spender’s private total', async () => {
    const { spender, spender2, household, groceries, get } = await setup();
    await transactions.create(spender.id, household.id, tx(30000, { envelopeId: groceries.id }));
    await transactions.create(spender.id, household.id, tx(20000));
    const row = (await get(spender2.id)).members.find((m) => m.name === 'spender')!;
    expect(row).toMatchObject({ sharedSpent: 30000, privateSpent: 0 });
  });
});

describe('headline totals', () => {
  it('earners get a complete household figure; spenders get a partial one and are told so', async () => {
    const { owner, spender, spender2, household, groceries, get } = await setup();
    await transactions.create(spender.id, household.id, tx(30000, { envelopeId: groceries.id }));
    await transactions.create(spender.id, household.id, tx(20000)); // private
    await transactions.create(spender2.id, household.id, tx(7000)); // private

    const earnerView = await get(owner.id);
    expect(earnerView.headline).toMatchObject({ sharedSpent: 30000, privateSpent: 27000, householdSpent: 57000, complete: true });
    const spenderView = await get(spender.id);
    expect(spenderView.headline).toMatchObject({ sharedSpent: 30000, privateSpent: 20000, householdSpent: 50000, complete: false });
  });

  it('mySpent is the caller’s own spending, shared plus private', async () => {
    const { spender, household, groceries, get } = await setup();
    await transactions.create(spender.id, household.id, tx(30000, { envelopeId: groceries.id }));
    await transactions.create(spender.id, household.id, tx(20000));
    expect((await get(spender.id)).headline.mySpent).toBe(50000);
  });
});

describe('income and allowances', () => {
  it('earners see income and what is left after household spending; spenders see neither', async () => {
    const { owner, spender, household, groceries, get } = await setup();
    await income.create(owner.id, household.id, { label: 'Salary', amount: 8000000 });
    await transactions.create(spender.id, household.id, tx(30000, { envelopeId: groceries.id }));
    await transactions.create(spender.id, household.id, tx(20000));

    const earner = await get(owner.id);
    expect(earner.income).toMatchObject({ total: 8000000, leftOver: 8000000 - 50000 });
    const spenderView = await get(spender.id);
    expect(spenderView.income).toBeNull();
    expect(JSON.stringify(spenderView)).not.toContain('Salary');
    expect(JSON.stringify(spenderView)).not.toContain('8000000');
  });

  it('shows allowances given to an earner and received by a spender', async () => {
    const { owner, spender, spender2, household, mSpender, get } = await setup();
    await allowances.set(owner.id, household.id, mSpender.id, 200000);
    expect((await get(owner.id)).allowances).toEqual({ given: 200000, total: 200000 });
    expect((await get(spender.id)).allowances).toEqual({ received: 200000 });
    expect((await get(spender2.id)).allowances).toEqual({ received: 0 });
  });
});

describe('access', () => {
  it('404s for non-members and for people who left', async () => {
    const { household, spender } = await setup();
    const outsider = await makeUser(prisma, 'outsider');
    await expect(dashboard.get(outsider.id, household.id, TODAY)).rejects.toMatchObject({ status: 404 });
    await prisma.membership.updateMany({ where: { userId: spender.id }, data: { userId: null, leftAt: new Date() } });
    await expect(dashboard.get(spender.id, household.id, TODAY)).rejects.toMatchObject({ status: 404 });
  });

  it('works for a brand-new household with nothing in it', async () => {
    const user = await makeUser(prisma, 'solo');
    const home = await makeHousehold(prisma, [{ userId: user.id, role: 'OWNER' }]);
    const view = await dashboard.get(user.id, home.id, TODAY);
    expect(view.envelopes).toEqual([]);
    expect(view.headline).toMatchObject({ householdSpent: 0, sharedBudget: 0, mySpent: 0 });
    expect(view.income).toMatchObject({ total: 0, leftOver: 0 });
  });
});
