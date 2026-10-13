import { createSlice } from '@reduxjs/toolkit';
import { householdSet, signedOut } from './householdSlice';

// The household's budget data as the server sent it (amounts in paise), for the member
// who is signed in. In household mode the screens read this instead of the solo slices;
// utils/householdDataMapping.js converts it to the solo shapes. The solo data on the
// phone is never touched.
//
// Saved with the rest of the app state, so the last good data is still there offline.
// Like the household slice, adding it needs no PERSIST_VERSION bump.
const initialState = {
  // idle | loading (first load) | refreshing (have data, fetching again) | ready | error
  status: 'idle',
  error: '',
  loadedFor: null, // household id this data belongs to
  envelopes: [],
  transactions: [],
  income: null, // { total, sources: [{ id, label, amount, mine, earner }] } - earners only
  allowanceReceived: 0,
  cycleStartDay: null,
};

// Server order: newest date first, then newest created first.
const byNewest = (a, b) => b.date.localeCompare(a.date);

const upsert = (list, item) => {
  const index = list.findIndex((existing) => existing.id === item.id);
  if (index === -1) {
    list.push(item);
  } else {
    list[index] = item;
  }
};

const householdDataSlice = createSlice({
  name: 'householdData',
  initialState,
  reducers: {
    syncStarted: (state) => {
      state.status = state.loadedFor ? 'refreshing' : 'loading';
      state.error = '';
    },
    syncSucceeded: (state, action) => {
      Object.assign(state, action.payload, { status: 'ready', error: '' });
    },
    // Keeps whatever data we already have, so a failed refresh doesn't blank the screens.
    syncFailed: (state, action) => {
      state.status = 'error';
      state.error = action.payload;
    },

    // Applied straight from the server's reply to a write, so the screens update at once
    // without refetching everything.
    transactionSaved: (state, action) => {
      upsert(state.transactions, action.payload);
      state.transactions.sort(byNewest);
    },
    transactionsRemoved: (state, action) => {
      const ids = new Set(action.payload);
      state.transactions = state.transactions.filter((t) => !ids.has(t.id));
    },
    envelopeSaved: (state, action) => {
      upsert(state.envelopes, action.payload);
    },
    envelopeRemoved: (state, action) => {
      state.envelopes = state.envelopes.filter((e) => e.id !== action.payload);
      // The server detaches transactions from a deleted envelope but keeps them.
      state.transactions.forEach((t) => {
        if (t.envelopeId === action.payload) {
          t.envelopeId = null;
        }
      });
    },
    incomeChanged: (state, action) => {
      state.income = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signedOut, () => initialState)
      .addCase(householdSet, (state, action) => {
        // Leaving a household, or moving to a different one, must not leave the old
        // household's data on screen. Re-confirming the same household keeps the cache.
        if (!action.payload || action.payload.id !== state.loadedFor) {
          return state.loadedFor === null ? state : initialState;
        }
        return state;
      });
  },
});

export const {
  syncStarted,
  syncSucceeded,
  syncFailed,
  transactionSaved,
  transactionsRemoved,
  envelopeSaved,
  envelopeRemoved,
  incomeChanged,
} = householdDataSlice.actions;

export default householdDataSlice.reducer;
