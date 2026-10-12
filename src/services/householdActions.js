import { toLocalISODate } from '../utils/formatDate';
import { buildSoloData } from '../utils/soloData';
import { dataImported, householdSet, signedIn, signedOut } from '../store/slices/householdSlice';

// Redux thunks that keep the household slice in step with the backend. Built from
// injected `api`/`googleAuth` so they are testable without a phone; the app's real
// instances are wired in services/householdApp.js.
export function createHouseholdActions({ api, googleAuth }) {
  // Pull "which household am I in" from the server. v1: at most one.
  const syncHousehold = () => async (dispatch) => {
    const list = await api.request('/households');
    const mine = list[0]
      ? { id: list[0].id, name: list[0].name, role: list[0].role, membershipId: list[0].membershipId }
      : null;
    dispatch(householdSet(mine));
    return mine;
  };

  return {
    syncHousehold,

    // The agreement version the server expects to be accepted.
    fetchConsentVersion: async () => {
      const { version } = await api.request('/consent', { auth: false });
      return version;
    },

    signIn: () => async (dispatch) => {
      const user = await googleAuth.signIn();
      dispatch(signedIn(user));
      try {
        await dispatch(syncHousehold());
      } catch {
        // Signed in but couldn't reach the server for the household; the Household
        // screen retries via restore() when it opens.
      }
      return user;
    },

    // Called when the Household screen opens, and at app start: if there is a saved
    // session, confirm it and refresh the household. Offline keeps the cached state.
    restore: () => async (dispatch) => {
      const session = await api.getSession();
      if (!session) {
        dispatch(signedOut());
        return;
      }
      try {
        await dispatch(syncHousehold());
      } catch (error) {
        if (error.status !== 0) {
          throw error;
        }
      }
    },

    signOut: () => async (dispatch) => {
      await googleAuth.signOut();
      dispatch(signedOut());
    },

    createHousehold:
      ({ name, consentVersion }) =>
      async (dispatch) => {
        await api.request('/households', { method: 'POST', body: { name, consentVersion } });
        return dispatch(syncHousehold());
      },

    joinHousehold:
      ({ code, consentVersion }) =>
      async (dispatch) => {
        await api.request('/invites/join', {
          method: 'POST',
          body: { code: code.trim(), consentVersion },
        });
        return dispatch(syncHousehold());
      },

    // The dashboard for the current budget cycle, already filtered by what I may see.
    // Sends my local date so the server puts "today" in the right cycle.
    fetchDashboard:
      ({ today = toLocalISODate() } = {}) =>
      async (dispatch, getState) => {
        const current = getState().household.current;
        if (!current) {
          return null;
        }
        return api.request(`/households/${current.id}/dashboard?today=${today}`);
      },

    // Members of my household: [{ membershipId, role, name, joinedAt }].
    fetchMembers: () => async (dispatch, getState) => {
      const current = getState().household.current;
      if (!current) {
        return [];
      }
      return api.request(`/households/${current.id}/members`);
    },

    // Owner only (the server enforces it). role: 'EARNER' | 'SPENDER'.
    // Resolves { code, role, expiresAt }.
    createInvite:
      ({ role }) =>
      async (dispatch, getState) => {
        const current = getState().household.current;
        return api.request(`/households/${current.id}/invites`, { method: 'POST', body: { role } });
      },

    // One-time upload of this phone's envelopes, transactions and income into the household.
    // scope: 'PERSONAL' (only mine, shared by my sharing choices) or 'SHARED' (everyone sees
    // the envelopes and the spending in them; owners and earners only).
    // Resolves { envelopes, transactions, incomeImported, skipped }. The phone's own data is
    // left untouched.
    importSoloData:
      ({ scope }) =>
      async (dispatch, getState) => {
        const state = getState();
        const current = state.household.current;
        const { payload, skipped } = buildSoloData(
          {
            envelopes: state.budget.envelopes,
            transactions: state.transactions.items,
            monthlyIncome: state.profile.monthlyIncome,
          },
          scope,
        );
        try {
          const result = await api.request(`/households/${current.id}/import`, {
            method: 'POST',
            body: payload,
          });
          dispatch(dataImported(current.membershipId));
          return { ...result, skipped };
        } catch (error) {
          // 409 = this membership already uploaded (e.g. an earlier attempt whose reply
          // was lost). Remember that so the offer disappears instead of failing forever.
          if (error.status === 409) {
            dispatch(dataImported(current.membershipId));
          }
          throw error;
        }
      },

    leaveHousehold: () => async (dispatch, getState) => {
      const current = getState().household.current;
      if (!current) {
        return;
      }
      await api.request(`/households/${current.id}/leave`, { method: 'POST' });
      dispatch(householdSet(null));
    },
  };
}
