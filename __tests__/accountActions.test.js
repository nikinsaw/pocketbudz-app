import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { createHouseholdActions } from '../src/services/householdActions';
import householdDataReducer from '../src/store/slices/householdDataSlice';
import householdReducer, { householdSet, signedIn } from '../src/store/slices/householdSlice';

const user = { id: 'u1', email: 'a@x.com', name: 'A' };
const apiError = (status, message) => Object.assign(new Error(message ?? `status ${status}`), { status });

function setup({ request } = {}) {
  const api = { request: jest.fn(request ?? (async () => null)) };
  const googleAuth = { signIn: jest.fn(), signOut: jest.fn(async () => {}) };
  const store = configureStore({
    reducer: combineReducers({ household: householdReducer, householdData: householdDataReducer }),
  });
  store.dispatch(signedIn(user));
  store.dispatch(householdSet({ id: 'h1', name: 'Home', role: 'OWNER', membershipId: 'm1' }));
  return { api, googleAuth, store, actions: createHouseholdActions({ api, googleAuth }) };
}

describe('exportAccount', () => {
  it('returns what the server sends from /me/export', async () => {
    const payload = { account: { email: 'a@x.com' }, households: [] };
    const { actions, store, api } = setup({ request: async () => payload });
    expect(await store.dispatch(actions.exportAccount())).toBe(payload);
    expect(api.request).toHaveBeenCalledWith('/me/export');
  });

  it('lets a failure reach the screen, and keeps them signed in', async () => {
    const { actions, store } = setup({ request: async () => { throw apiError(500); } });
    await expect(store.dispatch(actions.exportAccount())).rejects.toMatchObject({ status: 500 });
    expect(store.getState().household.user).toEqual(user);
  });
});

describe('deleteAccount', () => {
  it('asks the server with the confirmation word, then signs this phone out and clears household state', async () => {
    const { actions, store, api, googleAuth } = setup();
    await store.dispatch(actions.deleteAccount());
    expect(api.request).toHaveBeenCalledWith('/me', { method: 'DELETE', body: { confirm: 'DELETE' } });
    expect(googleAuth.signOut).toHaveBeenCalledTimes(1);
    expect(store.getState().household).toMatchObject({ user: null, current: null });
  });

  it('only signs out after the server has agreed', async () => {
    const order = [];
    const { actions, store, googleAuth } = setup({
      request: async () => { order.push('server'); return null; },
    });
    googleAuth.signOut.mockImplementation(async () => { order.push('signOut'); });
    await store.dispatch(actions.deleteAccount());
    expect(order).toEqual(['server', 'signOut']);
  });

  it('when the server refuses (sole owner), nothing local changes', async () => {
    const { actions, store, googleAuth } = setup({
      request: async () => { throw apiError(409, 'Transfer ownership of your household before deleting your account'); },
    });
    await expect(store.dispatch(actions.deleteAccount())).rejects.toMatchObject({ status: 409 });
    expect(googleAuth.signOut).not.toHaveBeenCalled();
    expect(store.getState().household.user).toEqual(user);
    expect(store.getState().household.current).not.toBeNull();
  });

  it('when the server cannot be reached, they stay signed in and can retry', async () => {
    const { actions, store, googleAuth } = setup({ request: async () => { throw apiError(0); } });
    await expect(store.dispatch(actions.deleteAccount())).rejects.toMatchObject({ status: 0 });
    expect(googleAuth.signOut).not.toHaveBeenCalled();
    expect(store.getState().household.user).toEqual(user);
  });

  it('still shows solo mode if clearing the local session fails after the account is gone', async () => {
    const { actions, store, googleAuth } = setup();
    googleAuth.signOut.mockRejectedValue(new Error('keychain error'));
    await expect(store.dispatch(actions.deleteAccount())).rejects.toThrow('keychain error');
    expect(store.getState().household.user).toBeNull();
  });
});
