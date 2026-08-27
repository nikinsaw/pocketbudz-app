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

// No seed transactions — a fresh install starts genuinely empty rather
// than showing fake demo purchases (Blue Tokai, Blinkit, Netflix)
// presented as if they were the user's own history. RecentActivitySection
// and AllTransactionsScreen both render an empty state instead.
const initialState = {
  items: [],
};

function resolveCategoryDisplay(categories, category) {
  const match = categories.find((item) => item.label === category);
  return { icon: match?.icon || FALLBACK_ICON, colorKey: match?.colorKey || FALLBACK_COLOR_KEY };
}

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    // icon/colorKey are resolved by the addTransaction/updateTransaction
    // thunks below (they have access to profile.categories); these internal
    // actions just store whatever they're given.
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
    transactionUpdated: (state, action) => {
      const { id, merchant, category, amount, date, icon, colorKey } = action.payload;
      const transaction = state.items.find((item) => item.id === id);
      if (!transaction) {
        return;
      }
      transaction.merchant = merchant;
      transaction.category = category;
      transaction.amount = amount;
      transaction.date = date;
      transaction.icon = icon;
      transaction.colorKey = colorKey;
    },
    deleteTransaction: (state, action) => {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
  },
});

export const { transactionAdded, transactionUpdated, deleteTransaction } =
  transactionsSlice.actions;

// Callers (AI quick-add, document import, manual entry) only supply the
// fields a human or the model would know — icon/colorKey always come from
// the user's real category list so a transaction's look matches its
// envelope/category everywhere else in the app.
export function addTransaction({ merchant, category, amount, date }) {
  return (dispatch, getState) => {
    const categories = getState().profile.categories;
    dispatch(
      transactionAdded({
        merchant,
        category,
        amount,
        date,
        ...resolveCategoryDisplay(categories, category),
      }),
    );
  };
}

export function updateTransaction({ id, merchant, category, amount, date }) {
  return (dispatch, getState) => {
    const categories = getState().profile.categories;
    dispatch(
      transactionUpdated({
        id,
        merchant,
        category,
        amount,
        date,
        ...resolveCategoryDisplay(categories, category),
      }),
    );
  };
}

export default transactionsSlice.reducer;
