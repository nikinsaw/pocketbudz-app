import { combineReducers, configureStore } from '@reduxjs/toolkit';
import householdReducer, { householdSet, signedIn, signedOut } from '../src/store/slices/householdSlice';
import dataReducer, {
  envelopeRemoved,
  envelopeSaved,
  incomeChanged,
  syncFailed,
  syncStarted,
  syncSucceeded,
  transactionSaved,
  transactionsRemoved,
} from '../src/store/slices/householdDataSlice';

const makeStore = () =>
  configureStore({ reducer: combineReducers({ household: householdReducer, householdData: dataReducer }) });

const tx = (id, date, extra = {}) => ({ id, merchant: 'Shop', category: 'Food', amount: 100, date, envelopeId: null, ...extra });
const loaded = {
  loadedFor: 'h1',
  envelopes: [{ id: 'e1', title: 'Food' }],
  transactions: [tx('t1', '2026-10-05'), tx('t2', '2026-10-03', { envelopeId: 'e1' })],
  income: { total: 5000, sources: [] },
  allowanceReceived: 0,
  cycleStartDay: 1,
};
const home = { id: 'h1', name: 'Home', role: 'OWNER', membershipId: 'm1' };
const data = (store) => store.getState().householdData;

describe('sync lifecycle', () => {
  it('starts empty and idle', () => {
    expect(data(makeStore())).toMatchObject({ status: 'idle', transactions: [], envelopes: [], income: null });
  });

  it('first load is "loading", later loads are "refreshing" so cached data stays on screen', () => {
    const store = makeStore();
    store.dispatch(syncStarted());
    expect(data(store).status).toBe('loading');
    store.dispatch(syncSucceeded(loaded));
    expect(data(store)).toMatchObject({ status: 'ready', error: '', loadedFor: 'h1' });
    store.dispatch(syncStarted());
    expect(data(store).status).toBe('refreshing');
    expect(data(store).transactions).toHaveLength(2); // still there while refreshing
  });

  it('a failed refresh keeps the last good data and records why', () => {
    const store = makeStore();
    store.dispatch(syncSucceeded(loaded));
    store.dispatch(syncFailed('Can’t reach the server.'));
    expect(data(store)).toMatchObject({ status: 'error', error: 'Can’t reach the server.' });
    expect(data(store).transactions).toHaveLength(2);
  });

  it('a successful sync clears an earlier error', () => {
    const store = makeStore();
    store.dispatch(syncFailed('boom'));
    store.dispatch(syncSucceeded(loaded));
    expect(data(store)).toMatchObject({ status: 'ready', error: '' });
  });
});

describe('applying the server’s reply to a write', () => {
  const seeded = () => {
    const store = makeStore();
    store.dispatch(syncSucceeded(loaded));
    return store;
  };

  it('adds a new transaction and keeps the list newest-first', () => {
    const store = seeded();
    store.dispatch(transactionSaved(tx('t3', '2026-10-09')));
    store.dispatch(transactionSaved(tx('t4', '2026-10-01')));
    expect(data(store).transactions.map((t) => t.id)).toEqual(['t3', 't1', 't2', 't4']);
  });

  it('replaces an edited transaction instead of duplicating it, and re-sorts if the date changed', () => {
    const store = seeded();
    store.dispatch(transactionSaved(tx('t2', '2026-10-20', { merchant: 'Edited' })));
    expect(data(store).transactions).toHaveLength(2);
    expect(data(store).transactions[0]).toMatchObject({ id: 't2', merchant: 'Edited' });
  });

  it('removes transactions by id, one or many', () => {
    const store = seeded();
    store.dispatch(transactionsRemoved(['t1']));
    expect(data(store).transactions.map((t) => t.id)).toEqual(['t2']);
    store.dispatch(transactionsRemoved(['t2', 'nope']));
    expect(data(store).transactions).toEqual([]);
  });

  it('adds, edits and removes envelopes; removing one detaches its transactions but keeps them', () => {
    const store = seeded();
    store.dispatch(envelopeSaved({ id: 'e2', title: 'Rent' }));
    store.dispatch(envelopeSaved({ id: 'e1', title: 'Groceries' }));
    expect(data(store).envelopes.map((e) => e.title)).toEqual(['Groceries', 'Rent']);

    store.dispatch(envelopeRemoved('e1'));
    expect(data(store).envelopes.map((e) => e.id)).toEqual(['e2']);
    expect(data(store).transactions).toHaveLength(2);
    expect(data(store).transactions.every((t) => t.envelopeId === null)).toBe(true);
  });

  it('replaces the income snapshot', () => {
    const store = seeded();
    store.dispatch(incomeChanged({ total: 9000, sources: [{ id: 'i1', amount: 9000, mine: true }] }));
    expect(data(store).income.total).toBe(9000);
  });
});

describe('clearing the cache', () => {
  const seeded = () => {
    const store = makeStore();
    store.dispatch(signedIn({ id: 'u1', email: 'a@x.com', name: 'A' }));
    store.dispatch(householdSet(home));
    store.dispatch(syncSucceeded(loaded));
    return store;
  };

  it('signing out wipes it', () => {
    const store = seeded();
    store.dispatch(signedOut());
    expect(data(store)).toMatchObject({ status: 'idle', transactions: [], loadedFor: null });
  });

  it('leaving the household wipes it', () => {
    const store = seeded();
    store.dispatch(householdSet(null));
    expect(data(store)).toMatchObject({ status: 'idle', transactions: [], envelopes: [], loadedFor: null });
  });

  it('moving to a different household wipes the old one’s data', () => {
    const store = seeded();
    store.dispatch(householdSet({ ...home, id: 'h2' }));
    expect(data(store).transactions).toEqual([]);
  });

  it('re-confirming the same household keeps the cache (app start, screen open)', () => {
    const store = seeded();
    store.dispatch(householdSet({ ...home, name: 'Renamed' }));
    expect(data(store).transactions).toHaveLength(2);
    expect(data(store).loadedFor).toBe('h1');
  });

  it('setting a household before anything has loaded is harmless', () => {
    const store = makeStore();
    store.dispatch(householdSet(home));
    expect(data(store).status).toBe('idle');
  });
});
