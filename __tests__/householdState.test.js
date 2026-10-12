import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { persistReducer, persistStore } from 'redux-persist';
import householdReducer, {
  dataImported,
  householdSet,
  selectHouseholdMode,
  signedIn,
  signedOut,
} from '../src/store/slices/householdSlice';
import { createHouseholdActions } from '../src/services/householdActions';

const user = { id: 'u1', email: 'asha@example.com', name: 'Asha' };
const home = { id: 'h1', name: 'Sharma family', role: 'OWNER', membershipId: 'm1' };
const apiError = (status) => Object.assign(new Error(`status ${status}`), { status });

const makeStore = () => configureStore({ reducer: { household: householdReducer } });

describe('householdSlice', () => {
  it('starts in solo mode, so existing users are untouched', () => {
    const store = makeStore();
    expect(store.getState().household).toEqual({ user: null, current: null, importedFor: null });
    expect(selectHouseholdMode(store.getState())).toBe('solo');
  });

  it('moves solo -> signed-in -> household and back', () => {
    const store = makeStore();
    store.dispatch(signedIn({ ...user, extra: 'ignored' }));
    expect(store.getState().household.user).toEqual(user);
    expect(selectHouseholdMode(store.getState())).toBe('signed-in');

    store.dispatch(householdSet(home));
    expect(selectHouseholdMode(store.getState())).toBe('household');

    store.dispatch(householdSet(null));
    expect(selectHouseholdMode(store.getState())).toBe('signed-in');

    store.dispatch(signedOut());
    expect(selectHouseholdMode(store.getState())).toBe('solo');
  });

  it('signing out clears the household too', () => {
    const store = makeStore();
    store.dispatch(signedIn(user));
    store.dispatch(householdSet(home));
    store.dispatch(signedOut());
    expect(store.getState().household).toEqual({ user: null, current: null, importedFor: null });
  });

  // Existing v1.0.0 users have saved state from before this slice existed. Run it
  // through the real redux-persist rehydration (same version + migrate rule as
  // store.js) to prove their data survives with no PERSIST_VERSION bump.
  it('rehydrates old saved state: existing data intact, household starts solo', async () => {
    const saved = {
      profile: JSON.stringify({ name: 'Existing User', monthlyIncome: 50000 }),
      transactions: JSON.stringify({ items: [{ id: 't1', merchant: 'Cafe', amount: 120 }] }),
      _persist: JSON.stringify({ version: 7, rehydrated: true }),
    };
    const memory = { 'persist:pocketbudz-root': JSON.stringify(saved) };
    const storage = {
      getItem: async (key) => memory[key] ?? null,
      setItem: async (key, value) => {
        memory[key] = value;
      },
      removeItem: async (key) => {
        delete memory[key];
      },
    };
    const passthrough = (initial) => (state = initial) => state;
    const rootReducer = combineReducers({
      profile: passthrough({ name: '', monthlyIncome: null }),
      transactions: passthrough({ items: [] }),
      household: householdReducer,
    });
    const reducer = persistReducer(
      {
        key: 'pocketbudz-root',
        version: 7,
        storage,
        migrate: (state) =>
          Promise.resolve(state?._persist?.version === 7 ? state : undefined),
      },
      rootReducer,
    );
    const store = configureStore({
      reducer,
      middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    await new Promise((resolve) => {
      persistStore(store, null, resolve);
    });

    const state = store.getState();
    expect(state.profile).toEqual({ name: 'Existing User', monthlyIncome: 50000 });
    expect(state.transactions.items).toHaveLength(1);
    expect(state.household).toEqual({ user: null, current: null, importedFor: null });
    expect(selectHouseholdMode(state)).toBe('solo');
  });
});

function setup({ responses = {}, session = { accessToken: 'a', refreshToken: 'r' }, signIn } = {}) {
  const calls = [];
  const api = {
    request: jest.fn(async (path, options = {}) => {
      calls.push([options.method ?? 'GET', path, options.body]);
      const handler = responses[`${options.method ?? 'GET'} ${path}`];
      if (!handler) {
        throw new Error(`unexpected ${options.method ?? 'GET'} ${path}`);
      }
      return typeof handler === 'function' ? handler() : handler;
    }),
    getSession: jest.fn(async () => session),
  };
  const googleAuth = {
    signIn: signIn ?? jest.fn(async () => user),
    signOut: jest.fn(async () => {}),
  };
  const store = makeStore();
  return { store, calls, api, googleAuth, actions: createHouseholdActions({ api, googleAuth }) };
}

const serverHome = { id: 'h1', name: 'Sharma family', role: 'OWNER', membershipId: 'm1' };

describe('household actions', () => {
  it('signIn stores the user and picks up an existing household', async () => {
    const { store, actions } = setup({ responses: { 'GET /households': [serverHome] } });
    await store.dispatch(actions.signIn());
    expect(store.getState().household).toEqual({ user, current: home, importedFor: null });
    expect(selectHouseholdMode(store.getState())).toBe('household');
  });

  it('signIn for a new account lands in signed-in mode', async () => {
    const { store, actions } = setup({ responses: { 'GET /households': [] } });
    await store.dispatch(actions.signIn());
    expect(selectHouseholdMode(store.getState())).toBe('signed-in');
  });

  it('signIn still succeeds when only the household lookup fails (server blip)', async () => {
    const { store, actions } = setup({
      responses: {
        'GET /households': () => {
          throw apiError(0);
        },
      },
    });
    await store.dispatch(actions.signIn());
    expect(store.getState().household.user).toEqual(user);
    expect(store.getState().household.current).toBeNull();
  });

  it('signIn failure (cancelled, rejected) leaves the app in solo mode', async () => {
    const cancelled = Object.assign(new Error('cancelled'), { reason: 'cancelled' });
    const { store, actions } = setup({ signIn: jest.fn(async () => Promise.reject(cancelled)) });
    await expect(store.dispatch(actions.signIn())).rejects.toBe(cancelled);
    expect(selectHouseholdMode(store.getState())).toBe('solo');
  });

  it('createHousehold sends the accepted agreement version, then loads the household', async () => {
    const { store, calls, actions } = setup({
      responses: { 'POST /households': { id: 'h1' }, 'GET /households': [serverHome] },
    });
    store.dispatch(signedIn(user));
    await store.dispatch(actions.createHousehold({ name: 'Sharma family', consentVersion: 'v1' }));
    expect(calls[0]).toEqual(['POST', '/households', { name: 'Sharma family', consentVersion: 'v1' }]);
    expect(selectHouseholdMode(store.getState())).toBe('household');
  });

  it('createHousehold surfaces server refusals and does not change state', async () => {
    const { store, actions } = setup({
      responses: {
        'POST /households': () => {
          throw apiError(409);
        },
      },
    });
    store.dispatch(signedIn(user));
    await expect(
      store.dispatch(actions.createHousehold({ name: 'X', consentVersion: 'v1' })),
    ).rejects.toMatchObject({ status: 409 });
    expect(selectHouseholdMode(store.getState())).toBe('signed-in');
  });

  it('joinHousehold trims the invite code', async () => {
    const { store, calls, actions } = setup({
      responses: { 'POST /invites/join': { householdId: 'h1' }, 'GET /households': [{ ...serverHome, role: 'SPENDER' }] },
    });
    store.dispatch(signedIn(user));
    await store.dispatch(actions.joinHousehold({ code: '  abc123  ', consentVersion: 'v1' }));
    expect(calls[0][2]).toEqual({ code: 'abc123', consentVersion: 'v1' });
    expect(store.getState().household.current.role).toBe('SPENDER');
  });

  it('fetchMembers lists the current household’s members', async () => {
    const members = [{ membershipId: 'm1', role: 'OWNER', name: 'Asha', joinedAt: '2026-10-01' }];
    const { store, actions } = setup({ responses: { 'GET /households/h1/members': members } });
    store.dispatch(signedIn(user));
    store.dispatch(householdSet(home));
    await expect(store.dispatch(actions.fetchMembers())).resolves.toEqual(members);
  });

  it('fetchMembers without a household returns nothing and calls nothing', async () => {
    const { store, api, actions } = setup();
    await expect(store.dispatch(actions.fetchMembers())).resolves.toEqual([]);
    expect(api.request).not.toHaveBeenCalled();
  });

  it('fetchDashboard asks for the current cycle using the given local date', async () => {
    const dashboard = { period: { from: '2026-10-01' }, headline: {} };
    const { store, calls, actions } = setup({ responses: { 'GET /households/h1/dashboard?today=2026-10-12': dashboard } });
    store.dispatch(signedIn(user));
    store.dispatch(householdSet(home));
    await expect(store.dispatch(actions.fetchDashboard({ today: '2026-10-12' }))).resolves.toEqual(dashboard);
    expect(calls[0][1]).toBe('/households/h1/dashboard?today=2026-10-12');
  });

  it('fetchDashboard defaults to the phone’s own date, not UTC', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 12, 0, 30)); // 00:30 local on 12 Oct
    try {
      const { store, calls, actions } = setup({ responses: { 'GET /households/h1/dashboard?today=2026-10-12': {} } });
      store.dispatch(signedIn(user));
      store.dispatch(householdSet(home));
      await store.dispatch(actions.fetchDashboard());
      expect(calls[0][1]).toBe('/households/h1/dashboard?today=2026-10-12');
    } finally {
      jest.useRealTimers();
    }
  });

  it('fetchDashboard without a household returns null and calls nothing', async () => {
    const { store, api, actions } = setup();
    await expect(store.dispatch(actions.fetchDashboard())).resolves.toBeNull();
    expect(api.request).not.toHaveBeenCalled();
  });

  it('createInvite asks the server for an invite with the chosen role', async () => {
    const invite = { code: 'abc123XY', role: 'SPENDER', expiresAt: '2026-10-20T00:00:00.000Z' };
    const { store, calls, actions } = setup({ responses: { 'POST /households/h1/invites': invite } });
    store.dispatch(signedIn(user));
    store.dispatch(householdSet(home));
    await expect(store.dispatch(actions.createInvite({ role: 'SPENDER' }))).resolves.toEqual(invite);
    expect(calls[0]).toEqual(['POST', '/households/h1/invites', { role: 'SPENDER' }]);
  });

  it('createInvite surfaces a refusal when the caller is not the owner', async () => {
    const { store, actions } = setup({
      responses: {
        'POST /households/h1/invites': () => {
          throw apiError(403);
        },
      },
    });
    store.dispatch(signedIn(user));
    store.dispatch(householdSet({ ...home, role: 'SPENDER' }));
    await expect(store.dispatch(actions.createInvite({ role: 'EARNER' }))).rejects.toMatchObject({ status: 403 });
  });

  it('leaveHousehold calls the server for the current household and clears it', async () => {
    const { store, calls, actions } = setup({ responses: { 'POST /households/h1/leave': { householdDeleted: false } } });
    store.dispatch(signedIn(user));
    store.dispatch(householdSet(home));
    await store.dispatch(actions.leaveHousehold());
    expect(calls[0][1]).toBe('/households/h1/leave');
    expect(selectHouseholdMode(store.getState())).toBe('signed-in');
  });

  it('leaveHousehold keeps the household if the server refuses (e.g. sole owner)', async () => {
    const { store, actions } = setup({
      responses: {
        'POST /households/h1/leave': () => {
          throw apiError(409);
        },
      },
    });
    store.dispatch(signedIn(user));
    store.dispatch(householdSet(home));
    await expect(store.dispatch(actions.leaveHousehold())).rejects.toMatchObject({ status: 409 });
    expect(selectHouseholdMode(store.getState())).toBe('household');
  });

  it('leaveHousehold does nothing without a household', async () => {
    const { store, api, actions } = setup();
    await store.dispatch(actions.leaveHousehold());
    expect(api.request).not.toHaveBeenCalled();
  });

  it('signOut clears Google and the whole household state', async () => {
    const { store, googleAuth, actions } = setup();
    store.dispatch(signedIn(user));
    store.dispatch(householdSet(home));
    await store.dispatch(actions.signOut());
    expect(googleAuth.signOut).toHaveBeenCalled();
    expect(selectHouseholdMode(store.getState())).toBe('solo');
  });

  it('fetchConsentVersion reads the public agreement version without auth', async () => {
    const { api, actions } = setup({ responses: { 'GET /consent': { version: '2026-10-v1' } } });
    await expect(actions.fetchConsentVersion()).resolves.toBe('2026-10-v1');
    expect(api.request).toHaveBeenCalledWith('/consent', { auth: false });
  });
});

describe('importSoloData', () => {
  const phone = {
    budget: { envelopes: [{ id: 'e1', categoryKey: 'food', icon: '🍕', title: 'Food', colorKey: 'food', type: 'spending', budgetLimit: 5000 }] },
    transactions: {
      items: [
        { id: 't1', merchant: 'Cafe', category: 'Food', amount: 120.5, date: '2026-10-02' },
        { id: 't2', merchant: 'Broken', category: 'Food', amount: 10, date: '2026-02-31' },
      ],
    },
    profile: { monthlyIncome: 40000 },
  };
  const passthrough = (initial) => (state = initial) => state;

  function setupImport(responses) {
    const base = setup({ responses });
    const store = configureStore({
      reducer: {
        household: householdReducer,
        budget: passthrough(phone.budget),
        transactions: passthrough(phone.transactions),
        profile: passthrough(phone.profile),
      },
    });
    store.dispatch(signedIn(user));
    store.dispatch(householdSet(home));
    return { ...base, store };
  }

  it('uploads what is on the phone, remembers it for this membership and reports skipped rows', async () => {
    const { store, calls, actions } = setupImport({
      'POST /households/h1/import': { envelopes: 1, transactions: 1, incomeImported: true },
    });
    const result = await store.dispatch(actions.importSoloData({ scope: 'SHARED' }));

    expect(result).toEqual({
      envelopes: 1,
      transactions: 1,
      incomeImported: true,
      skipped: { envelopes: 0, transactions: 1 },
    });
    const [method, path, body] = calls[0];
    expect([method, path]).toEqual(['POST', '/households/h1/import']);
    expect(body.envelopeScope).toBe('SHARED');
    expect(body.monthlyIncome).toBe(40000);
    expect(body.transactions).toEqual([{ merchant: 'Cafe', category: 'Food', amount: 120.5, date: '2026-10-02' }]);
    expect(store.getState().household.importedFor).toBe('m1');
  });

  it('treats "already imported" (409) as done, so the offer goes away instead of failing forever', async () => {
    const { store, actions } = setupImport({
      'POST /households/h1/import': () => {
        throw apiError(409);
      },
    });
    await expect(store.dispatch(actions.importSoloData({ scope: 'PERSONAL' }))).rejects.toMatchObject({ status: 409 });
    expect(store.getState().household.importedFor).toBe('m1');
  });

  it.each([0, 400, 403, 429, 500])('does NOT mark it imported when the upload fails with %i, so they can retry', async (status) => {
    const { store, actions } = setupImport({
      'POST /households/h1/import': () => {
        throw apiError(status);
      },
    });
    await expect(store.dispatch(actions.importSoloData({ scope: 'PERSONAL' }))).rejects.toMatchObject({ status });
    expect(store.getState().household.importedFor).toBeNull();
  });

  it('leaves the phone’s own data untouched', async () => {
    const { store, actions } = setupImport({ 'POST /households/h1/import': { envelopes: 1, transactions: 1, incomeImported: true } });
    const before = JSON.stringify([store.getState().budget, store.getState().transactions, store.getState().profile]);
    await store.dispatch(actions.importSoloData({ scope: 'PERSONAL' }));
    const after = JSON.stringify([store.getState().budget, store.getState().transactions, store.getState().profile]);
    expect(after).toBe(before);
  });
});

describe('importedFor', () => {
  it('belongs to one membership: a new membership (rejoining) is offered the upload again', () => {
    const store = makeStore();
    store.dispatch(signedIn(user));
    store.dispatch(householdSet(home));
    store.dispatch(dataImported('m1'));
    expect(store.getState().household.importedFor).toBe('m1');
    store.dispatch(householdSet({ ...home, membershipId: 'm2' }));
    expect(store.getState().household.importedFor === store.getState().household.current.membershipId).toBe(false);
  });

  it('is cleared on sign out', () => {
    const store = makeStore();
    store.dispatch(signedIn(user));
    store.dispatch(dataImported('m1'));
    store.dispatch(signedOut());
    expect(store.getState().household.importedFor).toBeNull();
  });
});

describe('restore (app start / opening the Household screen)', () => {
  it('goes solo if the saved session is gone', async () => {
    const { store, actions } = setup({ session: null });
    store.dispatch(signedIn(user));
    store.dispatch(householdSet(home));
    await store.dispatch(actions.restore());
    expect(selectHouseholdMode(store.getState())).toBe('solo');
  });

  it('refreshes the household from the server when signed in', async () => {
    const { store, actions } = setup({ responses: { 'GET /households': [{ ...serverHome, name: 'Renamed' }] } });
    store.dispatch(signedIn(user));
    store.dispatch(householdSet(home));
    await store.dispatch(actions.restore());
    expect(store.getState().household.current.name).toBe('Renamed');
  });

  it('notices you were removed from the household elsewhere', async () => {
    const { store, actions } = setup({ responses: { 'GET /households': [] } });
    store.dispatch(signedIn(user));
    store.dispatch(householdSet(home));
    await store.dispatch(actions.restore());
    expect(selectHouseholdMode(store.getState())).toBe('signed-in');
  });

  it('keeps the cached household when offline', async () => {
    const { store, actions } = setup({
      responses: {
        'GET /households': () => {
          throw apiError(0);
        },
      },
    });
    store.dispatch(signedIn(user));
    store.dispatch(householdSet(home));
    await expect(store.dispatch(actions.restore())).resolves.toBeUndefined();
    expect(selectHouseholdMode(store.getState())).toBe('household');
  });

  it('surfaces real server errors', async () => {
    const { store, actions } = setup({
      responses: {
        'GET /households': () => {
          throw apiError(500);
        },
      },
    });
    store.dispatch(signedIn(user));
    await expect(store.dispatch(actions.restore())).rejects.toMatchObject({ status: 500 });
  });
});
