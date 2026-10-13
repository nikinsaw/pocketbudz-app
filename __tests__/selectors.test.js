import { combineReducers, configureStore } from '@reduxjs/toolkit';
import budgetReducer from '../src/store/slices/budgetSlice';
import householdDataReducer, { syncFailed, syncSucceeded } from '../src/store/slices/householdDataSlice';
import householdReducer, { householdSet, signedIn } from '../src/store/slices/householdSlice';
import profileReducer from '../src/store/slices/profileSlice';
import transactionsReducer from '../src/store/slices/transactionsSlice';
import {
  selectBudgetCycleStartDay,
  selectEnvelopes,
  selectIsHousehold,
  selectMonthlyIncome,
  selectSync,
  selectTransactions,
} from '../src/store/selectors';

const phoneEnvelope = { id: 'solo-e', title: 'Phone Food', budgetLimit: 5000 };
const phoneTx = { id: 'solo-t', merchant: 'Phone Cafe', category: 'Food', amount: 50, date: '2026-10-01' };

function makeStore() {
  return configureStore({
    reducer: combineReducers({
      household: householdReducer,
      householdData: householdDataReducer,
      budget: budgetReducer,
      transactions: transactionsReducer,
      profile: profileReducer,
    }),
    preloadedState: {
      budget: { envelopes: [phoneEnvelope] },
      transactions: { items: [phoneTx] },
      profile: { ...profileReducer(undefined, { type: '@@init' }), monthlyIncome: 50000, budgetCycleStartDay: 5, categories: [{ label: 'Food', icon: '🍕', colorKey: 'food' }] },
    },
  });
}

const user = { id: 'u1', email: 'a@x.com', name: 'A' };
const serverData = {
  loadedFor: 'h1',
  envelopes: [{ id: 'e1', scope: 'SHARED', ownerId: null, categoryKey: 'food', icon: '🍕', title: 'Food', colorKey: 'food', type: 'spending', budgetLimit: 800000 }],
  transactions: [{ id: 't1', merchant: 'Server Cafe', category: 'Food', amount: 12050, date: '2026-10-02', envelopeId: 'e1', mine: true, member: { membershipId: 'm1', name: 'Asha' } }],
  income: { total: 9000000, sources: [{ id: 'i1', amount: 8000000, mine: true }, { id: 'i2', amount: 1000000, mine: false }] },
  allowanceReceived: 250000,
  cycleStartDay: 15,
};

function inHousehold(role = 'OWNER') {
  const store = makeStore();
  store.dispatch(signedIn(user));
  store.dispatch(householdSet({ id: 'h1', name: 'Home', role, membershipId: 'm1' }));
  store.dispatch(syncSucceeded(serverData));
  return store;
}

describe('solo mode reads the phone, exactly as before', () => {
  it('returns the very same objects the solo slices hold', () => {
    const state = makeStore().getState();
    expect(selectIsHousehold(state)).toBe(false);
    expect(selectEnvelopes(state)).toBe(state.budget.envelopes);
    expect(selectTransactions(state)).toBe(state.transactions.items);
    expect(selectMonthlyIncome(state)).toBe(50000);
    expect(selectBudgetCycleStartDay(state)).toBe(5);
    expect(selectSync(state)).toEqual({ status: 'ready', error: '' });
  });

  it('stays solo when signed in but not in a household yet', () => {
    const store = makeStore();
    store.dispatch(signedIn(user));
    expect(selectIsHousehold(store.getState())).toBe(false);
    expect(selectTransactions(store.getState())).toBe(store.getState().transactions.items);
  });

  it('ignores any leftover server data while solo', () => {
    const store = makeStore();
    store.dispatch(syncSucceeded(serverData));
    expect(selectTransactions(store.getState()).map((t) => t.merchant)).toEqual(['Phone Cafe']);
  });
});

describe('household mode reads the server, in the solo shapes', () => {
  it('maps envelopes and transactions to rupees', () => {
    const state = inHousehold().getState();
    expect(selectIsHousehold(state)).toBe(true);
    expect(selectEnvelopes(state)).toMatchObject([{ id: 'e1', title: 'Food', budgetLimit: 8000, shared: true }]);
    expect(selectTransactions(state)).toMatchObject([{ id: 't1', merchant: 'Server Cafe', amount: 120.5, icon: '🍕', mine: true }]);
  });

  it('never mixes in the phone’s solo data', () => {
    const state = inHousehold().getState();
    expect(JSON.stringify([selectEnvelopes(state), selectTransactions(state)])).not.toMatch(/Phone/);
  });

  it('an earner’s income is their own, a spender’s is their allowance', () => {
    expect(selectMonthlyIncome(inHousehold('OWNER').getState())).toBe(80000);
    expect(selectMonthlyIncome(inHousehold('SPENDER').getState())).toBe(2500);
  });

  it('follows the household’s budget cycle, not the personal setting', () => {
    expect(selectBudgetCycleStartDay(inHousehold().getState())).toBe(15);
  });

  it('falls back to the personal cycle setting until the household’s is known', () => {
    const store = makeStore();
    store.dispatch(signedIn(user));
    store.dispatch(householdSet({ id: 'h1', name: 'Home', role: 'OWNER', membershipId: 'm1' }));
    expect(selectBudgetCycleStartDay(store.getState())).toBe(5);
  });

  it('is empty (not the phone’s data) before the first load', () => {
    const store = makeStore();
    store.dispatch(signedIn(user));
    store.dispatch(householdSet({ id: 'h1', name: 'Home', role: 'OWNER', membershipId: 'm1' }));
    expect(selectTransactions(store.getState())).toEqual([]);
    expect(selectEnvelopes(store.getState())).toEqual([]);
    expect(selectMonthlyIncome(store.getState())).toBeNull();
  });

  it('reports the sync state and keeps data when a refresh fails', () => {
    const store = inHousehold();
    store.dispatch(syncFailed('Can’t reach the server.'));
    expect(selectSync(store.getState())).toEqual({ status: 'error', error: 'Can’t reach the server.' });
    expect(selectTransactions(store.getState())).toHaveLength(1);
  });
});

describe('memoisation', () => {
  it('returns the same array while the data has not changed, so screens do not re-render needlessly', () => {
    const state = inHousehold().getState();
    expect(selectEnvelopes(state)).toBe(selectEnvelopes(state));
    expect(selectTransactions(state)).toBe(selectTransactions(state));
  });

  it('selectSync returns the same object until something it reports changes', () => {
    const solo = makeStore();
    expect(selectSync(solo.getState())).toBe(selectSync(solo.getState()));
    solo.dispatch(signedIn(user)); // unrelated change
    expect(selectSync(solo.getState())).toBe(selectSync(solo.getState()));

    const store = inHousehold();
    const before = selectSync(store.getState());
    expect(selectSync(store.getState())).toBe(before);
    store.dispatch(syncFailed('boom'));
    expect(selectSync(store.getState())).not.toBe(before);
    expect(selectSync(store.getState())).toEqual({ status: 'error', error: 'boom' });
  });

  it('recomputes when the server data changes', () => {
    const store = inHousehold();
    const before = selectTransactions(store.getState());
    store.dispatch(syncSucceeded({ ...serverData, transactions: [] }));
    expect(selectTransactions(store.getState())).not.toBe(before);
    expect(selectTransactions(store.getState())).toEqual([]);
  });
});

describe('switching mode', () => {
  it('goes back to the phone’s untouched data after leaving the household', () => {
    const store = inHousehold();
    store.dispatch(householdSet(null));
    const state = store.getState();
    expect(selectIsHousehold(state)).toBe(false);
    expect(selectTransactions(state)).toBe(state.transactions.items);
    expect(selectTransactions(state)[0].merchant).toBe('Phone Cafe');
  });
});
