import { createRequire } from 'node:module';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { signAccessToken } from '../auth/tokens.js';
import { prisma } from '../db.js';
import { makeHousehold, makeUser, resetDb } from '../households/testUtils.js';
import { createServices } from '../services.js';

// End-to-end contract for "Account & data": the app's REAL account actions and API client
// run against this real server and database. It proves the phone and the server agree on how
// to ask for an export and for a deletion (DELETE with a body, a 204 reply, the 409 wording),
// and that after a deletion the account really is gone. Excluded from `tsc` (plain JS from
// outside backend/), so only Vitest runs it.
const rootRequire = createRequire(new URL('../../../package.json', import.meta.url));
const { configureStore, combineReducers } = rootRequire('@reduxjs/toolkit');

/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
const { createApiClient } = await import('../../../src/services/apiClient.js');
// @ts-ignore
const { createHouseholdActions } = await import('../../../src/services/householdActions.js');
// @ts-ignore
const { describeHouseholdError } = await import('../../../src/utils/householdErrors.js');
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

const makeApp = () => buildApp(createServices(prisma, async () => { throw new Error('unused'); }));
let app: ReturnType<typeof makeApp>;
beforeEach(async () => {
  await resetDb(prisma);
  app = makeApp();
});
afterEach(() => app.close());
afterAll(() => prisma.$disconnect());

const fetchViaApp = async (url: string, init: { method?: string; headers?: Record<string, string>; body?: string }) => {
  const res = await app.inject({
    method: (init.method ?? 'GET') as 'GET',
    url: url.replace('http://test', ''),
    headers: init.headers,
    payload: init.body,
  });
  return { status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, text: async () => res.body };
};

async function phoneFor(user: { id: string; email: string; name: string }, membership?: { id: string; householdId: string; role: string }) {
  let session: { accessToken: string; refreshToken: string } | null = {
    accessToken: await signAccessToken(user.id),
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
  store.dispatch(signedIn({ id: user.id, email: user.email, name: user.name }));
  if (membership) {
    store.dispatch(householdSet({ id: membership.householdId, name: 'Test home', role: membership.role, membershipId: membership.id }));
  }
  let googleSignOuts = 0;
  const actions = createHouseholdActions({
    api,
    // Like the real one: ends the PocketBudz session on the device.
    googleAuth: { signIn: async () => ({}), signOut: async () => { googleSignOuts++; await api.signOut(); } },
  });
  return {
    api,
    store,
    actions,
    signOuts: () => googleSignOuts,
    session: () => session,
    exportAccount: () => store.dispatch(actions.exportAccount()),
    deleteAccount: () => store.dispatch(actions.deleteAccount()),
  };
}

describe('app <-> server: account export', () => {
  it('a signed-in person with no household can download their account', async () => {
    const asha = await makeUser(prisma, 'asha');
    const phone = await phoneFor(asha);
    const data = await phone.exportAccount();
    expect(data.account).toMatchObject({ id: asha.id, email: 'asha@example.com', name: 'asha' });
    expect(data.households).toEqual([]);
  });

  it('includes their own spending in a household, in rupees', async () => {
    const owner = await makeUser(prisma, 'owner');
    const household = await makeHousehold(prisma, [{ userId: owner.id, role: 'OWNER' }]);
    const me = household.members[0];
    await prisma.transaction.create({
      data: { householdId: household.id, memberId: me.id, merchant: 'Cafe', category: 'Food', amount: 25050, date: new Date('2026-10-05') },
    });
    const phone = await phoneFor(owner, me);
    const data = await phone.exportAccount();
    expect(data.households).toHaveLength(1);
    expect(data.households[0].transactions).toEqual([
      { merchant: 'Cafe', category: 'Food', amount: 250.5, date: '2026-10-05', envelope: null },
    ]);
  });

  it('an export is JSON the phone can write to a file', async () => {
    const asha = await makeUser(prisma, 'asha');
    const data = await (await phoneFor(asha)).exportAccount();
    expect(JSON.parse(JSON.stringify(data, null, 2))).toEqual(data);
  });
});

describe('app <-> server: deleting the account', () => {
  it('erases the account, signs the phone out and shows solo mode', async () => {
    const asha = await makeUser(prisma, 'asha');
    const phone = await phoneFor(asha);
    await phone.deleteAccount();

    expect(await prisma.user.findUnique({ where: { id: asha.id } })).toBeNull();
    expect(phone.signOuts()).toBe(1);
    expect(phone.session()).toBeNull();
    expect(phone.store.getState().household).toMatchObject({ user: null, current: null });
  });

  it('the old login stops working straight away', async () => {
    const asha = await makeUser(prisma, 'asha');
    const phone = await phoneFor(asha);
    const staleToken = await signAccessToken(asha.id);
    await phone.deleteAccount();
    const res = await app.inject({ method: 'GET', url: '/me/export', headers: { authorization: `Bearer ${staleToken}` } });
    expect(res.statusCode).toBe(401);
  });

  it('removes their personal data, e.g. their AI usage', async () => {
    const asha = await makeUser(prisma, 'asha');
    await prisma.aiUsage.create({ data: { userId: asha.id, day: new Date('2026-10-05'), count: 7 } });
    await (await phoneFor(asha)).deleteAccount();
    expect(await prisma.aiUsage.count({ where: { userId: asha.id } })).toBe(0);
  });

  it('a member leaves their household; their spending stays only as an anonymous total', async () => {
    const owner = await makeUser(prisma, 'owner');
    const spender = await makeUser(prisma, 'spender');
    const household = await makeHousehold(prisma, [
      { userId: owner.id, role: 'OWNER' },
      { userId: spender.id, role: 'SPENDER' },
    ]);
    const spenderMember = household.members.find((m) => m.userId === spender.id)!;
    await prisma.transaction.create({
      data: { householdId: household.id, memberId: spenderMember.id, merchant: 'Secret shop', category: 'Misc', amount: 10000, date: new Date('2026-10-05') },
    });

    await (await phoneFor(spender, spenderMember)).deleteAccount();

    expect(await prisma.user.findUnique({ where: { id: spender.id } })).toBeNull();
    // The household and its owner are untouched.
    expect(await prisma.household.findUnique({ where: { id: household.id } })).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: owner.id } })).not.toBeNull();
    // The amount still counts, but nothing the spender typed or that identifies them remains.
    const left = await prisma.transaction.findMany({ where: { householdId: household.id } });
    expect(left.map((t) => [t.merchant, t.amount])).toEqual([['Former member', 10000]]);
    expect(JSON.stringify(left)).not.toContain(spender.id);
  });

  it('a household they are alone in is deleted with them', async () => {
    const owner = await makeUser(prisma, 'owner');
    const household = await makeHousehold(prisma, [{ userId: owner.id, role: 'OWNER' }]);
    await (await phoneFor(owner, household.members[0])).deleteAccount();
    expect(await prisma.household.findUnique({ where: { id: household.id } })).toBeNull();
  });

  it('a sole owner of a household with others is refused, with words the screen can show, and nothing changes', async () => {
    const owner = await makeUser(prisma, 'owner');
    const spender = await makeUser(prisma, 'spender');
    const household = await makeHousehold(prisma, [
      { userId: owner.id, role: 'OWNER' },
      { userId: spender.id, role: 'SPENDER' },
    ]);
    const phone = await phoneFor(owner, household.members.find((m) => m.userId === owner.id)!);

    const error = await phone.deleteAccount().catch((e: unknown) => e);

    expect(describeHouseholdError(error)).toBe('Transfer ownership of your household before deleting your account');
    expect(await prisma.user.findUnique({ where: { id: owner.id } })).not.toBeNull();
    expect(phone.signOuts()).toBe(0);
    expect(phone.session()).not.toBeNull();
    expect(phone.store.getState().household.user).not.toBeNull();
    expect(phone.store.getState().household.current).not.toBeNull();
  });

  it('once ownership is handed over they can delete', async () => {
    const owner = await makeUser(prisma, 'owner');
    const earner = await makeUser(prisma, 'earner');
    const household = await makeHousehold(prisma, [
      { userId: owner.id, role: 'OWNER' },
      { userId: earner.id, role: 'OWNER' },
    ]);
    await (await phoneFor(owner, household.members.find((m) => m.userId === owner.id)!)).deleteAccount();
    expect(await prisma.user.findUnique({ where: { id: owner.id } })).toBeNull();
    expect(await prisma.household.findUnique({ where: { id: household.id } })).not.toBeNull();
  });

  it('a second delete attempt after the account is gone is a clean "sign in again", not a crash', async () => {
    const asha = await makeUser(prisma, 'asha');
    const phone = await phoneFor(asha);
    await phone.deleteAccount();
    const again = await phoneFor(asha);
    const error = await again.deleteAccount().catch((e: unknown) => e);
    expect((error as { status: number }).status).toBeGreaterThanOrEqual(400);
    expect((error as { status: number }).status).toBeLessThan(500);
  });
});
