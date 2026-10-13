import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { WriteError, createDataActions } from '../src/services/dataActions';
import budgetReducer from '../src/store/slices/budgetSlice';
import householdDataReducer, { syncSucceeded } from '../src/store/slices/householdDataSlice';
import householdReducer, { householdSet, signedIn } from '../src/store/slices/householdSlice';
import profileReducer from '../src/store/slices/profileSlice';
import transactionsReducer from '../src/store/slices/transactionsSlice';

const user = { id: 'u1', email: 'a@x.com', name: 'A' };
const apiError = (status, message = 'x') => Object.assign(new Error(message), { status });

const serverTx = (id, extra = {}) => ({
  id, merchant: 'Cafe', category: 'Food', amount: 12000, date: '2026-10-02', envelopeId: 'shared-food', mine: true, member: { membershipId: 'm1', name: 'A' }, ...extra,
});
const envelopes = [
  { id: 'shared-food', scope: 'SHARED', ownerId: null, title: 'Food', categoryKey: 'f', icon: 'x', colorKey: 'f', type: 'spending', budgetLimit: 100000 },
  { id: 'my-fun', scope: 'PERSONAL', ownerId: 'm1', title: 'Fun', categoryKey: 'g', icon: 'x', colorKey: 'g', type: 'spending', budgetLimit: 50000 },
];

function setup({ mode = 'household', role = 'OWNER', responses = {} } = {}) {
  const calls = [];
  const api = {
    request: jest.fn(async (path, options = {}) => {
      const key = `${options.method ?? 'GET'} ${path}`;
      calls.push({ key, body: options.body });
      const handler = responses[key];
      if (handler === undefined) throw new Error(`unexpected ${key}`);
      return typeof handler === 'function' ? handler(options.body) : handler;
    }),
  };
  const store = configureStore({
    reducer: combineReducers({
      household: householdReducer,
      householdData: householdDataReducer,
      budget: budgetReducer,
      transactions: transactionsReducer,
      profile: profileReducer,
    }),
    preloadedState: {
      budget: { envelopes: [{ id: 'solo-e', title: 'Solo', budgetLimit: 1 }] },
      transactions: { items: [{ id: 'solo-t', merchant: 'Phone', category: 'Food', amount: 9, date: '2026-10-01', icon: 'x', colorKey: 'y' }] },
    },
  });
  if (mode === 'household') {
    store.dispatch(signedIn(user));
    store.dispatch(householdSet({ id: 'h1', name: 'Home', role, membershipId: 'm1' }));
    store.dispatch(syncSucceeded({ loadedFor: 'h1', envelopes, transactions: [serverTx('t1')], income: null, allowanceReceived: 0, cycleStartDay: 1 }));
  }
  return { store, api, calls, actions: createDataActions({ api }), data: () => store.getState().householdData };
}

const solo = (store) => ({ budget: store.getState().budget, transactions: store.getState().transactions });
const base = 'POST /households/h1/transactions';

describe('solo mode: exactly as before, no server', () => {
  it('adds, edits and deletes transactions locally', async () => {
    const { store, api, actions } = setup({ mode: 'solo' });
    await store.dispatch(actions.addTransaction({ merchant: 'Chai', category: 'Food', amount: 20, date: '2026-10-05' }));
    const added = store.getState().transactions.items.find((t) => t.merchant === 'Chai');
    expect(added).toMatchObject({ amount: 20, category: 'Food' });

    await store.dispatch(actions.updateTransaction({ id: added.id, merchant: 'Tea', category: 'Food', amount: 25, date: '2026-10-05' }));
    expect(store.getState().transactions.items.find((t) => t.id === added.id)).toMatchObject({ merchant: 'Tea', amount: 25 });

    await store.dispatch(actions.deleteTransaction(added.id));
    expect(store.getState().transactions.items.map((t) => t.id)).toEqual(['solo-t']);
    expect(api.request).not.toHaveBeenCalled();
  });

  it('deletes several and merges locally', async () => {
    const { store, api, actions } = setup({ mode: 'solo' });
    await store.dispatch(actions.addTransaction({ merchant: 'A', category: 'Food', amount: 1, date: '2026-10-05' }));
    await store.dispatch(actions.addTransaction({ merchant: 'B', category: 'Food', amount: 2, date: '2026-10-05' }));
    const ids = store.getState().transactions.items.filter((t) => ['A', 'B'].includes(t.merchant)).map((t) => t.id);
    await store.dispatch(actions.mergeTransactions({ ids, merchant: 'AB', category: 'Food', amount: 3, date: '2026-10-05' }));
    expect(store.getState().transactions.items.map((t) => t.merchant)).toContain('AB');
    const mergedId = store.getState().transactions.items.find((t) => t.merchant === 'AB').id;
    await store.dispatch(actions.deleteTransactions([mergedId, 'solo-t']));
    expect(store.getState().transactions.items).toEqual([]);
    expect(api.request).not.toHaveBeenCalled();
  });

  it('adds, edits and deletes envelopes and sets income locally', async () => {
    const { store, api, actions } = setup({ mode: 'solo' });
    await store.dispatch(actions.addEnvelope({ categoryKey: 'k', icon: 'i', title: 'Rent', colorKey: 'c', type: 'fixed', budgetLimit: 15000 }));
    const rent = store.getState().budget.envelopes.find((e) => e.title === 'Rent');
    await store.dispatch(actions.updateEnvelope({ id: rent.id, categoryKey: 'k', icon: 'i', title: 'Rent', colorKey: 'c', type: 'fixed', budgetLimit: 16000 }));
    expect(store.getState().budget.envelopes.find((e) => e.id === rent.id).budgetLimit).toBe(16000);
    await store.dispatch(actions.deleteEnvelope(rent.id));
    expect(store.getState().budget.envelopes.map((e) => e.title)).toEqual(['Solo']);
    await store.dispatch(actions.setMonthlyIncome(60000));
    expect(store.getState().profile.monthlyIncome).toBe(60000);
    expect(api.request).not.toHaveBeenCalled();
  });
});

describe('household mode: transactions', () => {
  it('sends paise, links the shared envelope by category, and applies the reply', async () => {
    const { store, calls, actions, data } = setup({ responses: { [base]: (body) => serverTx('t2', { amount: body.amount, merchant: body.merchant }) } });
    const before = solo(store);
    await store.dispatch(actions.addTransaction({ merchant: 'Blinkit', category: 'food', amount: 199.99, date: '2026-10-05' }));
    expect(calls[0].body).toEqual({ envelopeId: 'shared-food', merchant: 'Blinkit', category: 'food', amount: 19999, date: '2026-10-05' });
    expect(data().transactions.map((t) => t.id)).toContain('t2');
    expect(solo(store)).toEqual(before); // the phone's own data is never touched
  });

  it('prefers my personal envelope of the same name, and leaves unmatched categories private', async () => {
    const { calls, store, actions } = setup({ responses: { [base]: serverTx('t2') } });
    await store.dispatch(actions.addTransaction({ merchant: 'Game', category: 'Fun', amount: 10, date: '2026-10-05' }));
    await store.dispatch(actions.addTransaction({ merchant: 'Gadget', category: 'Gadgets', amount: 10, date: '2026-10-05' }));
    expect(calls[0].body.envelopeId).toBe('my-fun');
    expect(calls[1].body.envelopeId).toBeNull();
  });

  it('trims and caps text, and fills blanks the server would refuse', async () => {
    const { calls, store, actions } = setup({ responses: { [base]: serverTx('t2') } });
    await store.dispatch(actions.addTransaction({ merchant: `  ${'M'.repeat(100)}  `, category: '   ', amount: 5, date: '2026-10-05' }));
    expect(calls[0].body.merchant).toHaveLength(60);
    expect(calls[0].body.category).toBe('Other');
  });

  it.each([0, -5, NaN, 'abc', 0.001, 30_000_000])('rejects the amount %p before calling the server', async (amount) => {
    const { store, api, actions } = setup();
    await expect(store.dispatch(actions.addTransaction({ merchant: 'x', category: 'Food', amount, date: '2026-10-05' }))).rejects.toBeInstanceOf(WriteError);
    expect(api.request).not.toHaveBeenCalled();
  });

  it('surfaces a server refusal and changes nothing', async () => {
    const { store, actions, data } = setup({ responses: { [base]: () => { throw apiError(0); } } });
    await expect(store.dispatch(actions.addTransaction({ merchant: 'x', category: 'Food', amount: 5, date: '2026-10-05' }))).rejects.toMatchObject({ status: 0 });
    expect(data().transactions.map((t) => t.id)).toEqual(['t1']);
  });

  it('edits through PATCH and replaces the stored transaction', async () => {
    const { store, calls, actions, data } = setup({ responses: { 'PATCH /households/h1/transactions/t1': (b) => serverTx('t1', { merchant: b.merchant, amount: b.amount }) } });
    await store.dispatch(actions.updateTransaction({ id: 't1', merchant: 'Renamed', category: 'Food', amount: 50, date: '2026-10-02' }));
    expect(calls[0].body.amount).toBe(5000);
    expect(data().transactions).toHaveLength(1);
    expect(data().transactions[0].merchant).toBe('Renamed');
  });

  it('deletes one', async () => {
    const { store, actions, data } = setup({ responses: { 'DELETE /households/h1/transactions/t1': null } });
    await store.dispatch(actions.deleteTransaction('t1'));
    expect(data().transactions).toEqual([]);
  });

  it('on a failed single delete says so and keeps the transaction', async () => {
    const { store, actions, data } = setup({ responses: { 'DELETE /households/h1/transactions/t1': () => { throw apiError(403); } } });
    await expect(store.dispatch(actions.deleteTransaction('t1'))).rejects.toThrow(/Couldn.t delete it\. You can only delete spending you added/);
    expect(data().transactions).toHaveLength(1);
  });

  it('with several deletes, removes the ones that worked and reports the rest', async () => {
    const { store, actions, data } = setup({
      responses: {
        'DELETE /households/h1/transactions/t1': null,
        'DELETE /households/h1/transactions/t9': () => { throw apiError(403); },
      },
    });
    store.dispatch(syncSucceeded({ ...store.getState().householdData, transactions: [serverTx('t1'), serverTx('t9', { mine: false })] }));
    await expect(store.dispatch(actions.deleteTransactions(['t1', 't9']))).rejects.toThrow('1 of 2 couldn’t be deleted. You can only delete spending you added.');
    expect(data().transactions.map((t) => t.id)).toEqual(['t9']);
  });
});

describe('household mode: merging', () => {
  const merged = { ids: ['t1', 't2'], merchant: 'Both', category: 'Food', amount: 30, date: '2026-10-02' };
  const mergeKey = 'POST /households/h1/transactions/merge';
  const seed = (store) =>
    store.dispatch(syncSucceeded({ ...store.getState().householdData, transactions: [serverTx('t1'), serverTx('t2'), serverTx('keep')] }));

  it('sends one atomic request and swaps the originals for the merged transaction', async () => {
    const { store, calls, actions, data } = setup({ responses: { [mergeKey]: serverTx('merged', { merchant: 'Both', amount: 3000 }) } });
    seed(store);
    await store.dispatch(actions.mergeTransactions(merged));
    expect(calls).toHaveLength(1); // a single request: nothing can be half done
    expect(calls[0].body).toEqual({ ids: ['t1', 't2'], envelopeId: 'shared-food', merchant: 'Both', category: 'Food', amount: 3000, date: '2026-10-02' });
    expect(data().transactions.map((t) => t.id).sort()).toEqual(['keep', 'merged']);
  });

  it('on a refusal changes nothing at all - the originals stay exactly as they were', async () => {
    const { store, actions, data } = setup({ responses: { [mergeKey]: () => { throw apiError(403, 'You can only merge spending you added'); } } });
    seed(store);
    await expect(store.dispatch(actions.mergeTransactions(merged))).rejects.toMatchObject({ status: 403 });
    expect(data().transactions.map((t) => t.id).sort()).toEqual(['keep', 't1', 't2']);
  });
});

describe('household mode: adding many at once', () => {
  const bulk = 'POST /households/h1/transactions/bulk';
  const rows = (n) => Array.from({ length: n }, (_, i) => ({ merchant: `Shop ${i}`, category: 'Food', amount: 10 + i, date: '2026-10-05' }));
  const echo = (body) => body.transactions.map((t, i) => serverTx(`n${t.merchant}${i}`, { merchant: t.merchant, amount: t.amount }));

  it('sends them in one request, in paise, and shows them all', async () => {
    const { store, calls, actions, data } = setup({ responses: { [bulk]: echo } });
    await store.dispatch(actions.addTransactions(rows(3)));
    expect(calls).toHaveLength(1);
    expect(calls[0].body.transactions.map((t) => t.amount)).toEqual([1000, 1100, 1200]);
    expect(data().transactions).toHaveLength(4); // 1 seeded + 3
  });

  it('splits more than the server accepts into several requests', async () => {
    const { store, calls, actions } = setup({ responses: { [bulk]: echo } });
    await store.dispatch(actions.addTransactions(rows(1200)));
    expect(calls.map((c) => c.body.transactions.length)).toEqual([500, 500, 200]);
  });

  it('validates every row before sending anything', async () => {
    const { store, api, actions } = setup({ responses: { [bulk]: echo } });
    await expect(store.dispatch(actions.addTransactions([...rows(2), { merchant: 'bad', category: 'Food', amount: 0, date: '2026-10-05' }]))).rejects.toBeInstanceOf(WriteError);
    expect(api.request).not.toHaveBeenCalled();
  });

  it('solo mode adds them locally with no server', async () => {
    const { store, api, actions } = setup({ mode: 'solo' });
    await store.dispatch(actions.addTransactions(rows(3)));
    expect(store.getState().transactions.items).toHaveLength(4);
    expect(api.request).not.toHaveBeenCalled();
  });
});

describe('household mode: envelopes', () => {
  const fields = { categoryKey: 'rent', icon: '🏠', title: 'Rent', colorKey: 'rent', type: 'fixed', budgetLimit: 15000.5 };

  it('creates a personal envelope by default, in paise', async () => {
    const { store, calls, actions, data } = setup({ responses: { 'POST /households/h1/envelopes': (b) => ({ id: 'e9', ownerId: 'm1', ...b }) } });
    await store.dispatch(actions.addEnvelope(fields));
    expect(calls[0].body).toMatchObject({ scope: 'PERSONAL', title: 'Rent', budgetLimit: 1500050 });
    expect(data().envelopes.map((e) => e.id)).toContain('e9');
  });

  it('creates a shared envelope when asked', async () => {
    const { store, calls, actions } = setup({ responses: { 'POST /households/h1/envelopes': (b) => ({ id: 'e9', ...b }) } });
    await store.dispatch(actions.addEnvelope({ ...fields, scope: 'SHARED' }));
    expect(calls[0].body.scope).toBe('SHARED');
  });

  it('edits (never changing the scope) and deletes', async () => {
    const { store, calls, actions, data } = setup({
      responses: {
        'PATCH /households/h1/envelopes/shared-food': (b) => ({ ...envelopes[0], ...b }),
        'DELETE /households/h1/envelopes/shared-food': null,
      },
    });
    await store.dispatch(actions.updateEnvelope({ id: 'shared-food', ...fields, scope: 'PERSONAL' }));
    expect(calls[0].body).not.toHaveProperty('scope');
    expect(data().envelopes.find((e) => e.id === 'shared-food').title).toBe('Rent');
    await store.dispatch(actions.deleteEnvelope('shared-food'));
    expect(data().envelopes.map((e) => e.id)).toEqual(['my-fun']);
    expect(data().transactions[0].envelopeId).toBeNull(); // kept, just detached
  });

  it('surfaces the server’s refusal (e.g. a spender making a shared envelope)', async () => {
    const { store, actions, data } = setup({ role: 'SPENDER', responses: { 'POST /households/h1/envelopes': () => { throw apiError(403, 'Your role does not allow this'); } } });
    await expect(store.dispatch(actions.addEnvelope({ ...fields, scope: 'SHARED' }))).rejects.toMatchObject({ status: 403 });
    expect(data().envelopes).toHaveLength(2);
  });
});

describe('household mode: income', () => {
  const income = (sources) => ({ total: sources.reduce((s, x) => s + x.amount, 0), sources });
  const list = 'GET /households/h1/income';

  it('creates the earner’s first income source', async () => {
    let current = income([]);
    const { store, calls, actions, data } = setup({
      responses: {
        [list]: () => current,
        'POST /households/h1/income': (b) => { current = income([{ id: 'i1', ...b, mine: true }]); return {}; },
      },
    });
    await store.dispatch(actions.setMonthlyIncome(60000.5));
    expect(calls.find((c) => c.key === 'POST /households/h1/income').body).toEqual({ label: 'Monthly income', amount: 6000050 });
    expect(data().income.total).toBe(6000050);
  });

  it('updates their single existing source', async () => {
    let current = income([{ id: 'i1', amount: 100, mine: true }]);
    const { store, calls, actions, data } = setup({
      responses: {
        [list]: () => current,
        'PATCH /households/h1/income/i1': (b) => { current = income([{ id: 'i1', amount: b.amount, mine: true }]); return {}; },
      },
    });
    await store.dispatch(actions.setMonthlyIncome(500));
    expect(calls.find((c) => c.key.startsWith('PATCH')).body).toEqual({ amount: 50000 });
    expect(data().income.total).toBe(50000);
  });

  it('refuses to flatten several income sources into one number', async () => {
    const { store, calls, actions } = setup({ responses: { [list]: income([{ id: 'a', amount: 1, mine: true }, { id: 'b', amount: 2, mine: true }]) } });
    await expect(store.dispatch(actions.setMonthlyIncome(500))).rejects.toThrow(/more than one income source/);
    expect(calls.every((c) => c.key === list)).toBe(true);
  });

  it('does not touch someone else’s income source', async () => {
    let current = income([{ id: 'theirs', amount: 900, mine: false }]);
    const { store, calls, actions } = setup({
      responses: { [list]: () => current, 'POST /households/h1/income': () => { current = income([...current.sources, { id: 'mine', amount: 1, mine: true }]); return {}; } },
    });
    await store.dispatch(actions.setMonthlyIncome(10));
    expect(calls.some((c) => c.key.startsWith('PATCH'))).toBe(false);
  });

  it('a spender cannot set income, and no request is made', async () => {
    const { store, api, actions } = setup({ role: 'SPENDER' });
    await expect(store.dispatch(actions.setMonthlyIncome(500))).rejects.toThrow(/allowance/);
    expect(api.request).not.toHaveBeenCalled();
  });

  it('rejects an invalid income amount before calling the server', async () => {
    const { store, api, actions } = setup();
    await expect(store.dispatch(actions.setMonthlyIncome(0))).rejects.toBeInstanceOf(WriteError);
    expect(api.request).not.toHaveBeenCalled();
  });
});
