import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { createHouseholdActions } from '../src/services/householdActions';
import budgetReducer from '../src/store/slices/budgetSlice';
import householdDataReducer from '../src/store/slices/householdDataSlice';
import householdReducer, { householdSet, signedIn } from '../src/store/slices/householdSlice';
import profileReducer from '../src/store/slices/profileSlice';
import transactionsReducer from '../src/store/slices/transactionsSlice';

const user = { id: 'u1', email: 'a@x.com', name: 'A' };
const home = (role = 'OWNER') => ({ id: 'h1', name: 'Home', role, membershipId: 'm1' });
const apiError = (status) => Object.assign(new Error(`status ${status}`), { status });

const serverEnvelopes = [{ id: 'e1', scope: 'SHARED', ownerId: null, categoryKey: 'f', icon: 'x', title: 'Food', colorKey: 'f', type: 'spending', budgetLimit: 100000 }];
const serverTransactions = [{ id: 't1', merchant: 'Cafe', category: 'Food', amount: 5000, date: '2026-10-02', envelopeId: 'e1', mine: true, member: { membershipId: 'm1', name: 'A' } }];
const serverIncome = { total: 8000000, sources: [{ id: 'i1', label: 'Salary', amount: 8000000, mine: true, earner: 'A' }] };

function setup({ role = 'OWNER', overrides = {} } = {}) {
  const calls = [];
  const responses = {
    'GET /households/h1': { id: 'h1', name: 'Home', currencyFormat: 'indian', budgetCycleStartDay: 15 },
    'GET /households/h1/envelopes': serverEnvelopes,
    'GET /households/h1/transactions?limit=500': serverTransactions,
    'GET /households/h1/income': serverIncome,
    'GET /households/h1/allowances': { total: 250000, allowances: [] },
    ...overrides,
  };
  const api = {
    request: jest.fn(async (path, options = {}) => {
      const key = `${options.method ?? 'GET'} ${path}`;
      calls.push(key);
      const handler = responses[key];
      if (handler === undefined) throw new Error(`unexpected ${key}`);
      if (typeof handler === 'function') return handler();
      return handler;
    }),
    getSession: jest.fn(async () => ({ accessToken: 'a', refreshToken: 'r' })),
  };
  const store = configureStore({
    reducer: combineReducers({
      household: householdReducer,
      householdData: householdDataReducer,
      budget: budgetReducer,
      transactions: transactionsReducer,
      profile: profileReducer,
    }),
  });
  store.dispatch(signedIn(user));
  store.dispatch(householdSet(home(role)));
  const actions = createHouseholdActions({ api, googleAuth: { signIn: jest.fn(), signOut: jest.fn() } });
  return { store, api, calls, actions, data: () => store.getState().householdData };
}

describe('syncData', () => {
  it('loads settings, envelopes, transactions and income for an earner', async () => {
    const { store, actions, calls, data } = setup();
    await expect(store.dispatch(actions.syncData())).resolves.toBe(true);
    expect(data()).toMatchObject({
      status: 'ready', loadedFor: 'h1', cycleStartDay: 15, allowanceReceived: 0, envelopes: serverEnvelopes, transactions: serverTransactions, income: serverIncome,
    });
    expect(calls.sort()).toEqual([
      'GET /households/h1', 'GET /households/h1/envelopes', 'GET /households/h1/income', 'GET /households/h1/transactions?limit=500',
    ]);
  });

  it('asks a spender for their allowance instead of income, which they must not request', async () => {
    const { store, actions, calls, data } = setup({ role: 'SPENDER' });
    await store.dispatch(actions.syncData());
    expect(calls).toContain('GET /households/h1/allowances');
    expect(calls).not.toContain('GET /households/h1/income');
    expect(data()).toMatchObject({ allowanceReceived: 250000, income: null });
  });

  it('does nothing without a household', async () => {
    const { store, api, actions } = setup();
    store.dispatch(householdSet(null));
    await expect(store.dispatch(actions.syncData())).resolves.toBe(false);
    expect(api.request).not.toHaveBeenCalled();
  });

  it('shares one load between simultaneous callers', async () => {
    const { store, actions, calls } = setup();
    const results = await Promise.all([
      store.dispatch(actions.syncData()),
      store.dispatch(actions.syncData()),
      store.dispatch(actions.syncData()),
    ]);
    expect(results).toEqual([true, true, true]);
    expect(calls.filter((c) => c === 'GET /households/h1')).toHaveLength(1);
  });

  it('can load again after the previous load finished', async () => {
    const { store, actions, calls } = setup();
    await store.dispatch(actions.syncData());
    await store.dispatch(actions.syncData());
    expect(calls.filter((c) => c === 'GET /households/h1')).toHaveLength(2);
  });

  it('never throws: a failure is recorded in state in plain words', async () => {
    const { store, actions, data } = setup({
      overrides: {
        'GET /households/h1/envelopes': () => {
          throw apiError(0);
        },
      },
    });
    await expect(store.dispatch(actions.syncData())).resolves.toBe(false);
    expect(data().status).toBe('error');
    expect(data().error).toMatch(/internet connection/);
  });

  it('keeps the last good data when a later refresh fails, and recovers after', async () => {
    let fail = false;
    const { store, actions, data } = setup({
      overrides: {
        'GET /households/h1/transactions?limit=500': () => {
          if (fail) throw apiError(500);
          return serverTransactions;
        },
      },
    });
    await store.dispatch(actions.syncData());
    fail = true;
    await store.dispatch(actions.syncData());
    expect(data().status).toBe('error');
    expect(data().transactions).toEqual(serverTransactions);
    fail = false;
    await expect(store.dispatch(actions.syncData())).resolves.toBe(true);
    expect(data().status).toBe('ready');
  });

  it('drops the result if the person left the household while it was loading', async () => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const { store, actions, data } = setup({
      overrides: {
        'GET /households/h1/envelopes': async () => {
          await gate;
          return serverEnvelopes;
        },
      },
    });
    const pending = store.dispatch(actions.syncData());
    store.dispatch(householdSet(null));
    release();
    await expect(pending).resolves.toBe(false);
    expect(data().transactions).toEqual([]);
    expect(data().loadedFor).toBeNull();
  });
});

describe('when the household becomes known', () => {
  it('restore() loads the data at app start', async () => {
    const { store, actions, data } = setup({ overrides: { 'GET /households': [{ id: 'h1', name: 'Home', role: 'OWNER', membershipId: 'm1' }] } });
    await store.dispatch(actions.restore());
    expect(data().status).toBe('ready');
    expect(data().transactions).toHaveLength(1);
  });

  it('restore() while offline keeps the cached data and does not error', async () => {
    const { store, actions, data } = setup({
      overrides: {
        'GET /households': () => {
          throw apiError(0);
        },
      },
    });
    store.dispatch({ type: 'householdData/syncSucceeded', payload: { loadedFor: 'h1', envelopes: [], transactions: serverTransactions, income: null, allowanceReceived: 0, cycleStartDay: 1 } });
    await expect(store.dispatch(actions.restore())).resolves.toBeUndefined();
    expect(data().transactions).toEqual(serverTransactions);
  });

  it('restore() skips the data load for someone with no household', async () => {
    const { store, actions, calls } = setup({ overrides: { 'GET /households': [] } });
    await store.dispatch(actions.restore());
    expect(calls).toEqual(['GET /households']);
  });

  it('creating a household loads its data', async () => {
    const { store, actions, data } = setup({
      overrides: { 'POST /households': { id: 'h1' }, 'GET /households': [{ id: 'h1', name: 'Home', role: 'OWNER', membershipId: 'm1' }] },
    });
    await store.dispatch(actions.createHousehold({ name: 'Home', consentVersion: 'v' }));
    expect(data().status).toBe('ready');
  });

  it('joining a household loads its data', async () => {
    const { store, actions, data } = setup({
      role: 'SPENDER',
      overrides: { 'POST /invites/join': { householdId: 'h1' }, 'GET /households': [{ id: 'h1', name: 'Home', role: 'SPENDER', membershipId: 'm1' }] },
    });
    await store.dispatch(actions.joinHousehold({ code: 'abc', consentVersion: 'v' }));
    expect(data().allowanceReceived).toBe(250000);
  });

  it('the solo-data upload refreshes the household data so it shows up on the screens', async () => {
    const { store, actions, calls } = setup({
      overrides: { 'POST /households/h1/import': { envelopes: 0, transactions: 0, incomeImported: false } },
    });
    await store.dispatch(actions.importSoloData({ scope: 'PERSONAL' }));
    expect(calls.indexOf('POST /households/h1/import')).toBeLessThan(calls.indexOf('GET /households/h1/transactions?limit=500'));
  });
});
