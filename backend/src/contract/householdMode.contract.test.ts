import { createRequire } from 'node:module';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { signAccessToken } from '../auth/tokens.js';
import { prisma } from '../db.js';
import { makeHousehold, makeUser, resetDb } from '../households/testUtils.js';
import { createServices } from '../services.js';

// End-to-end contract: the React Native app's REAL sync and write actions, with its real API
// client and Redux store, run against this real server and database. It proves the two
// sides agree on units (rupees vs paise), field names and response shapes - things a fake
// API in the app's own tests can never catch. Excluded from `tsc` (plain JS from outside
// backend/), so only Vitest runs it.
// Redux Toolkit comes from the app's own dependencies (the repo root), resolved the way Node
// would from there, so this doesn't depend on any file inside the package.
const rootRequire = createRequire(new URL('../../../package.json', import.meta.url));
const { configureStore, combineReducers } = rootRequire('@reduxjs/toolkit');

/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
const { createApiClient } = await import('../../../src/services/apiClient.js');
// @ts-ignore
const { createDataActions } = await import('../../../src/services/dataActions.js');
// @ts-ignore
const { createHouseholdActions } = await import('../../../src/services/householdActions.js');
// @ts-ignore
const selectors = await import('../../../src/store/selectors.js');
// @ts-ignore
const { default: householdReducer, householdSet, signedIn } = await import('../../../src/store/slices/householdSlice.js');
// @ts-ignore
const { default: householdDataReducer } = await import('../../../src/store/slices/householdDataSlice.js');
// @ts-ignore
const { default: budgetReducer } = await import('../../../src/store/slices/budgetSlice.js');
// @ts-ignore
const { default: transactionsReducer } = await import('../../../src/store/slices/transactionsSlice.js');
// @ts-ignore
const { default: profileReducer } = await import('../../../src/store/slices/profileSlice.js');
/* eslint-enable @typescript-eslint/ban-ts-comment */

// A fresh server per test: the API's rate limit (100 requests/minute) is tracked per instance,
// and this file makes far more than that across all its tests.
const makeApp = () => buildApp(createServices(prisma, async () => { throw new Error('unused'); }));
let app: ReturnType<typeof makeApp>;
beforeEach(async () => {
  await resetDb(prisma);
  app = makeApp();
});
afterEach(() => app.close());
afterAll(() => prisma.$disconnect());

// A fetch that goes straight into the Fastify app.
const fetchViaApp = async (url: string, init: { method?: string; headers?: Record<string, string>; body?: string }) => {
  const res = await app.inject({
    method: (init.method ?? 'GET') as 'GET',
    url: url.replace('http://test', ''),
    headers: init.headers,
    payload: init.body,
  });
  return { status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, text: async () => res.body };
};

// One phone: its own API client, store and actions, signed in as `userId`.
async function phoneFor(userId: string, membership: { id: string; householdId: string; role: string }, householdName = 'Test home') {
  let session: { accessToken: string; refreshToken: string } | null = {
    accessToken: await signAccessToken(userId),
    refreshToken: 'unused',
  };
  const api = createApiClient({
    baseUrl: 'http://test',
    fetchImpl: fetchViaApp,
    store: { load: async () => session, save: async (s: typeof session) => { session = s; }, clear: async () => { session = null; } },
  });
  const store = configureStore({
    reducer: combineReducers({
      household: householdReducer,
      householdData: householdDataReducer,
      budget: budgetReducer,
      transactions: transactionsReducer,
      profile: profileReducer,
    }),
  });
  store.dispatch(signedIn({ id: userId, email: 'x@example.com', name: 'X' }));
  store.dispatch(householdSet({ id: membership.householdId, name: householdName, role: membership.role, membershipId: membership.id }));
  const householdActions = createHouseholdActions({ api, googleAuth: { signIn: async () => ({}), signOut: async () => {} } });
  const dataActions = createDataActions({ api });
  const state = () => store.getState();
  return {
    store,
    sync: () => store.dispatch(householdActions.syncData()),
    do: (action: unknown) => store.dispatch(action),
    dataActions,
    householdActions,
    envelopes: () => selectors.selectEnvelopes(state()) as { id: string; title: string; budgetLimit: number; shared: boolean }[],
    transactions: () => selectors.selectTransactions(state()) as { id: string; merchant: string; amount: number; category: string; mine: boolean; memberName: string | null }[],
    income: () => selectors.selectMonthlyIncome(state()) as number | null,
  };
}

async function setup() {
  const owner = await makeUser(prisma, 'owner');
  const spender = await makeUser(prisma, 'spender');
  const household = await makeHousehold(prisma, [
    { userId: owner.id, role: 'OWNER' },
    { userId: spender.id, role: 'SPENDER' },
  ]);
  const m = (id: string) => household.members.find((x) => x.userId === id)!;
  return {
    household,
    ownerPhone: await phoneFor(owner.id, m(owner.id)),
    spenderPhone: await phoneFor(spender.id, m(spender.id)),
  };
}

const groceries = { categoryKey: 'groceries', icon: '🛒', title: 'Groceries', colorKey: 'groceries', type: 'spending', budgetLimit: 10000 };
const tx = (merchant: string, amount: number, extra: Record<string, unknown> = {}) => ({ merchant, category: 'Groceries', amount, date: '2026-10-05', ...extra });

describe('app <-> server: household mode round trip', () => {
  it('loads an empty household', async () => {
    const { ownerPhone } = await setup();
    await expect(ownerPhone.sync()).resolves.toBe(true);
    expect(ownerPhone.store.getState().householdData.status).toBe('ready');
    expect(ownerPhone.envelopes()).toEqual([]);
    expect(ownerPhone.transactions()).toEqual([]);
  });

  it('rupees in the app are paise on the server and rupees again on the way back', async () => {
    const { ownerPhone } = await setup();
    await ownerPhone.sync();
    await ownerPhone.do(ownerPhone.dataActions.addEnvelope({ ...groceries, budgetLimit: 8000.5, scope: 'SHARED' }));
    await ownerPhone.do(ownerPhone.dataActions.addTransaction(tx('Blinkit', 199.99)));

    expect((await prisma.envelope.findFirstOrThrow()).budgetLimit).toBe(800050);
    expect((await prisma.transaction.findFirstOrThrow()).amount).toBe(19999);
    expect(ownerPhone.envelopes()[0]).toMatchObject({ title: 'Groceries', budgetLimit: 8000.5, shared: true });
    expect(ownerPhone.transactions()[0]).toMatchObject({ merchant: 'Blinkit', amount: 199.99, mine: true });

    // ...and a fresh load from the server gives exactly the same.
    const before = ownerPhone.transactions();
    await ownerPhone.sync();
    expect(ownerPhone.transactions()).toEqual(before);
  });

  it('a transaction in a category with a shared budget joins it, and the whole household sees it', async () => {
    const { ownerPhone, spenderPhone } = await setup();
    await ownerPhone.sync();
    await ownerPhone.do(ownerPhone.dataActions.addEnvelope({ ...groceries, scope: 'SHARED' }));
    await spenderPhone.sync();
    await spenderPhone.do(spenderPhone.dataActions.addTransaction(tx('Mart', 450, { category: 'groceries' }))); // different case

    const row = await prisma.transaction.findFirstOrThrow();
    expect(row.envelopeId).not.toBeNull();
    await ownerPhone.sync();
    expect(ownerPhone.transactions()).toMatchObject([{ merchant: 'Mart', amount: 450, mine: false, memberName: 'spender' }]);
  });

  it('private spending stays private to everyone else on the phone, too', async () => {
    const { ownerPhone, spenderPhone } = await setup();
    await spenderPhone.sync();
    await spenderPhone.do(spenderPhone.dataActions.addTransaction(tx('Secret gadget', 999, { category: 'Gadgets' })));
    expect(spenderPhone.transactions().map((t) => t.merchant)).toEqual(['Secret gadget']);
    await ownerPhone.sync();
    expect(ownerPhone.transactions()).toEqual([]);
  });

  it('edit and delete round-trip, and only the owner of a transaction can change it', async () => {
    const { ownerPhone, spenderPhone } = await setup();
    await ownerPhone.sync();
    await ownerPhone.do(ownerPhone.dataActions.addEnvelope({ ...groceries, scope: 'SHARED' }));
    await spenderPhone.sync();
    await spenderPhone.do(spenderPhone.dataActions.addTransaction(tx('Mart', 100)));
    const id = spenderPhone.transactions()[0].id;

    await spenderPhone.do(spenderPhone.dataActions.updateTransaction({ id, ...tx('Mart 2', 150.25) }));
    expect(spenderPhone.transactions()[0]).toMatchObject({ merchant: 'Mart 2', amount: 150.25 });
    expect((await prisma.transaction.findFirstOrThrow()).amount).toBe(15025);

    await ownerPhone.sync();
    await expect(ownerPhone.do(ownerPhone.dataActions.deleteTransaction(id))).rejects.toThrow(/only delete spending you added/);
    expect(await prisma.transaction.count()).toBe(1);

    await spenderPhone.do(spenderPhone.dataActions.deleteTransaction(id));
    expect(spenderPhone.transactions()).toEqual([]);
    expect(await prisma.transaction.count()).toBe(0);
  });

  it('bulk add is all-or-nothing and merge is atomic', async () => {
    const { spenderPhone } = await setup();
    await spenderPhone.sync();
    await spenderPhone.do(spenderPhone.dataActions.addTransactions([tx('A', 10), tx('B', 20.5), tx('C', 30)]));
    expect(spenderPhone.transactions()).toHaveLength(3);
    expect(await prisma.transaction.count()).toBe(3);

    const ids = spenderPhone.transactions().filter((t) => t.merchant !== 'C').map((t) => t.id);
    await spenderPhone.do(spenderPhone.dataActions.mergeTransactions({ ids, ...tx('A+B', 30.5) }));
    expect(spenderPhone.transactions().map((t) => t.merchant).sort()).toEqual(['A+B', 'C']);
    expect(await prisma.transaction.count()).toBe(2);
    await spenderPhone.sync();
    expect(spenderPhone.transactions().map((t) => t.merchant).sort()).toEqual(['A+B', 'C']);
  });

  it('income: an earner sets their own; a spender cannot, and sees their allowance instead', async () => {
    const { household, ownerPhone, spenderPhone } = await setup();
    await ownerPhone.sync();
    await ownerPhone.do(ownerPhone.dataActions.setMonthlyIncome(80000));
    expect((await prisma.incomeSource.findFirstOrThrow()).amount).toBe(8000000);
    expect(ownerPhone.income()).toBe(80000);
    await ownerPhone.do(ownerPhone.dataActions.setMonthlyIncome(90000.5)); // updates the same source
    expect(await prisma.incomeSource.count()).toBe(1);
    expect(ownerPhone.income()).toBe(90000.5);

    await spenderPhone.sync();
    await expect(spenderPhone.do(spenderPhone.dataActions.setMonthlyIncome(500))).rejects.toThrow(/allowance/);
    const spenderMembership = household.members.find((m) => m.role === 'SPENDER')!;
    await prisma.allowance.create({ data: { householdId: household.id, fromId: household.members.find((m) => m.role === 'OWNER')!.id, toId: spenderMembership.id, amount: 300000 } });
    await spenderPhone.sync();
    expect(spenderPhone.income()).toBe(3000);
    expect(JSON.stringify(spenderPhone.store.getState().householdData)).not.toContain('9000050'); // never sees household income
  });

  it('a spender cannot make a shared budget, but can make a personal one', async () => {
    const { spenderPhone } = await setup();
    await spenderPhone.sync();
    await expect(spenderPhone.do(spenderPhone.dataActions.addEnvelope({ ...groceries, scope: 'SHARED' }))).rejects.toMatchObject({ status: 403 });
    await spenderPhone.do(spenderPhone.dataActions.addEnvelope({ ...groceries, title: 'Pocket money', scope: 'PERSONAL' }));
    expect(spenderPhone.envelopes().map((e) => [e.title, e.shared])).toEqual([['Pocket money', false]]);
  });

  it('deleting an envelope keeps the spending in it', async () => {
    const { ownerPhone } = await setup();
    await ownerPhone.sync();
    await ownerPhone.do(ownerPhone.dataActions.addEnvelope({ ...groceries, scope: 'SHARED' }));
    await ownerPhone.do(ownerPhone.dataActions.addTransaction(tx('Mart', 100)));
    const envelopeId = ownerPhone.envelopes()[0].id;
    await ownerPhone.do(ownerPhone.dataActions.deleteEnvelope(envelopeId));
    expect(ownerPhone.envelopes()).toEqual([]);
    expect(await prisma.transaction.count()).toBe(1);
    await ownerPhone.sync();
    expect(ownerPhone.transactions()).toHaveLength(1); // still the owner's, now unfiled
  });

  it('rejects an out-of-range amount in the app before it reaches the server', async () => {
    const { spenderPhone } = await setup();
    await spenderPhone.sync();
    await expect(spenderPhone.do(spenderPhone.dataActions.addTransaction(tx('Huge', 30_000_000)))).rejects.toThrow(/between/);
    expect(await prisma.transaction.count()).toBe(0);
  });

  it('the solo data on the phone is never touched by any of it', async () => {
    const { ownerPhone } = await setup();
    const before = JSON.stringify([ownerPhone.store.getState().budget, ownerPhone.store.getState().transactions]);
    await ownerPhone.sync();
    await ownerPhone.do(ownerPhone.dataActions.addEnvelope({ ...groceries, scope: 'SHARED' }));
    await ownerPhone.do(ownerPhone.dataActions.addTransaction(tx('Mart', 100)));
    expect(JSON.stringify([ownerPhone.store.getState().budget, ownerPhone.store.getState().transactions])).toBe(before);
  });
});
