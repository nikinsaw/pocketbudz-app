import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { signAccessToken } from '../auth/tokens.js';
import { prisma } from '../db.js';
import { makeHousehold, makeUser, resetDb } from '../households/testUtils.js';
import { createServices } from '../services.js';

// Contract test: the React Native app builds the upload with buildSoloData() and this
// posts exactly that output to the real endpoint, so the two can't drift apart unnoticed.
// It imports the app's JavaScript from outside backend/, so it is excluded from `tsc`
// (see tsconfig.json) and only runs under Vitest.
// @ts-expect-error - plain JS module from the app, no type declarations
const appModule = await import('../../../src/utils/soloData.js');
const buildSoloData: (data: unknown, scope: 'SHARED' | 'PERSONAL') => {
  payload: unknown;
  counts: { envelopes: number; transactions: number };
  skipped: { envelopes: number; transactions: number };
} = appModule.buildSoloData;

const makeApp = () =>
  buildApp(
    createServices(prisma, async () => {
      throw new Error('unused');
    }),
  );
let app: ReturnType<typeof makeApp>;

// What a real phone can hold, including legacy rows the app must filter out.
const phoneData = {
  monthlyIncome: 62500.5,
  envelopes: [
    { id: 'env_1', categoryKey: 'groceries', icon: '🛒', title: 'Groceries', colorKey: 'groceries', type: 'spending', budgetLimit: 8000 },
    { id: 'env_2', categoryKey: 'rent', icon: '🏠', title: 'Rent', colorKey: 'householdSupplies', type: 'fixed', budgetLimit: 18000.75 },
    { id: 'env_3', categoryKey: 'x', icon: 'x', title: '   ', colorKey: 'x', type: 'spending', budgetLimit: 10 }, // dropped
  ],
  transactions: [
    { id: 't1', merchant: 'Blinkit', category: 'groceries', amount: 449.5, date: '2026-10-02', icon: 'x', colorKey: 'groceries' },
    { id: 't2', merchant: 'Landlord', category: 'Rent', amount: 18000.75, date: '2026-10-01', icon: 'x', colorKey: 'x' },
    { id: 't3', merchant: '', category: '', amount: 99.99, date: '2026-10-03', icon: 'x', colorKey: 'x' },
    { id: 't4', merchant: 'Broken', category: 'Food', amount: 10, date: '2026-02-31', icon: 'x', colorKey: 'x' }, // dropped
    { id: 't5', merchant: 'Free', category: 'Food', amount: 0, date: '2026-10-04', icon: 'x', colorKey: 'x' }, // dropped
  ],
};

beforeEach(async () => {
  await resetDb(prisma);
  app = makeApp();
});
afterEach(() => app.close());
afterAll(() => prisma.$disconnect());

async function asMember(role: 'OWNER' | 'SPENDER') {
  const user = await makeUser(prisma, 'asha');
  const household = await makeHousehold(prisma, [{ userId: user.id, role }]);
  const headers = { authorization: `Bearer ${await signAccessToken(user.id)}` };
  return { household, headers, url: `/households/${household.id}/import` };
}

describe('app <-> server import contract', () => {
  it('a spender’s personal upload is accepted and arrives intact', async () => {
    const { payload, counts, skipped } = buildSoloData(phoneData, 'PERSONAL');
    const { headers, url } = await asMember('SPENDER');
    const res = await app.inject({ method: 'POST', url, headers, payload: payload as object });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ envelopes: counts.envelopes, transactions: counts.transactions, incomeImported: false });
    expect(skipped).toEqual({ envelopes: 1, transactions: 2 });

    const rows = await prisma.transaction.findMany({ orderBy: { amount: 'asc' }, include: { envelope: true } });
    expect(rows.map((t) => [t.merchant, t.category, t.amount, t.envelope?.title ?? null])).toEqual([
      ['Unknown', 'Other', 9999, null], // blanks filled in
      ['Blinkit', 'groceries', 44950, 'Groceries'], // matched to its envelope, case-insensitively
      ['Landlord', 'Rent', 1800075, 'Rent'],
    ]);
    const envelopes = await prisma.envelope.findMany({ orderBy: { title: 'asc' } });
    expect(envelopes.map((e) => [e.title, e.scope, e.budgetLimit])).toEqual([
      ['Groceries', 'PERSONAL', 800000],
      ['Rent', 'PERSONAL', 1800075],
    ]);
  });

  it('an owner’s shared upload is accepted and carries income', async () => {
    const { payload } = buildSoloData(phoneData, 'SHARED');
    const { headers, url } = await asMember('OWNER');
    const res = await app.inject({ method: 'POST', url, headers, payload: payload as object });

    expect(res.statusCode).toBe(200);
    expect(res.json().incomeImported).toBe(true);
    expect((await prisma.incomeSource.findFirstOrThrow()).amount).toBe(6250050);
    expect(await prisma.envelope.count({ where: { scope: 'SHARED' } })).toBe(2);
  });

  it('an empty phone uploads cleanly', async () => {
    const { payload } = buildSoloData({ envelopes: [], transactions: [], monthlyIncome: null }, 'PERSONAL');
    const { headers, url } = await asMember('SPENDER');
    const res = await app.inject({ method: 'POST', url, headers, payload: payload as object });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ envelopes: 0, transactions: 0, incomeImported: false });
  });

  it('is exactly what the server accepts for a maximum-size upload', async () => {
    const big = {
      monthlyIncome: null,
      envelopes: [],
      transactions: Array.from({ length: 10000 }, (_, i) => ({
        id: `t${i}`, merchant: `Shop ${i}`, category: 'Food', amount: 10 + (i % 90), date: '2026-10-02', icon: 'x', colorKey: 'x',
      })),
    };
    const { payload, counts } = buildSoloData(big, 'PERSONAL');
    const { headers, url } = await asMember('SPENDER');
    const res = await app.inject({ method: 'POST', url, headers, payload: payload as object });
    expect(res.statusCode).toBe(200);
    expect(res.json().transactions).toBe(counts.transactions);
  }, 60_000);
});
