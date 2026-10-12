import { createSlice } from '@reduxjs/toolkit';

// Household mode is opt-in: a fresh install, and every existing user, is in solo
// mode (user === null) and everything stays on the device. Only non-secret
// identity lives here; login tokens are in the Keychain (storage/sessionStore.js).
//
// Adding this slice needs no PERSIST_VERSION bump: redux-persist leaves a slice that
// is missing from older saved state at its initial value, so no one's data is lost.
const initialState = {
  // { id, email, name } once signed in with Google.
  user: null,
  // { id, name, role, membershipId } - v1 allows one household per account.
  current: null,
};

const householdSlice = createSlice({
  name: 'household',
  initialState,
  reducers: {
    signedIn: (state, action) => {
      const { id, email, name } = action.payload;
      state.user = { id, email, name };
    },
    householdSet: (state, action) => {
      state.current = action.payload;
    },
    signedOut: () => initialState,
  },
});

export const { signedIn, householdSet, signedOut } = householdSlice.actions;

// 'solo' (on this device only) | 'signed-in' (has an account, no household yet) |
// 'household' (sharing a budget).
export const selectHouseholdMode = (state) => {
  if (!state.household.user) {
    return 'solo';
  }
  return state.household.current ? 'household' : 'signed-in';
};

export default householdSlice.reducer;
