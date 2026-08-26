import { createSlice } from '@reduxjs/toolkit';

// Used when a transaction's category doesn't match anything in
// profile.categories (shouldn't happen in practice — the AI and any manual
// picker both draw from that same list — but keeps a transaction
// renderable instead of crashing on a missing icon/tint lookup).
const FALLBACK_ICON = '🧾';
const FALLBACK_COLOR_KEY = 'householdSupplies';

function generateId() {
  return `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const initialState = {
  items: [
    {
      id: 'txn_seed_1',
      merchant: 'Blue Tokai',
      category: 'Dining Out',
      amount: 350,
      date: '2026-08-24',
      icon: '☕',
      colorKey: 'dining',
    },
    {
      id: 'txn_seed_2',
      merchant: 'Blinkit',
      category: 'Shopping',
      amount: 820,
      date: '2026-08-23',
      icon: '🛍️',
      colorKey: 'giftsJewelry',
    },
    {
      id: 'txn_seed_3',
      merchant: 'Netflix',
      category: 'Other',
      amount: 649,
      date: '2026-08-12',
      icon: '📺',
      colorKey: FALLBACK_COLOR_KEY,
    },
  ],
};

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    // icon/colorKey are resolved by the addTransaction thunk below (it has
    // access to profile.categories); this internal action just stores
    // whatever it's given, with an id assigned.
    transactionAdded: {
      reducer(state, action) {
        state.items.unshift(action.payload);
      },
      prepare({ merchant, category, amount, date, icon, colorKey }) {
        return {
          payload: { id: generateId(), merchant, category, amount, date, icon, colorKey },
        };
      },
    },
  },
});

export const { transactionAdded } = transactionsSlice.actions;

// Callers (AI quick-add, document import, future manual entry) only supply
// the fields a human or the model would know — icon/colorKey always come
// from the user's real category list so a transaction's look matches its
// envelope/category everywhere else in the app.
export function addTransaction({ merchant, category, amount, date }) {
  return (dispatch, getState) => {
    const categories = getState().profile.categories;
    const match = categories.find((item) => item.label === category);
    dispatch(
      transactionAdded({
        merchant,
        category,
        amount,
        date,
        icon: match?.icon || FALLBACK_ICON,
        colorKey: match?.colorKey || FALLBACK_COLOR_KEY,
      }),
    );
  };
}

export default transactionsSlice.reducer;
