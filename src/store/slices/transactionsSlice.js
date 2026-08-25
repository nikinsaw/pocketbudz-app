import { createSlice } from '@reduxjs/toolkit';
import { TRANSACTION_CATEGORIES } from '../../schemas/transaction';

export { TRANSACTION_CATEGORIES };

// icon: emoji shown in the Recent Activity list.
// tint: theme token key (pillBg/successTint/warningTint — resolved at
// render time, same pattern as budgetSlice.categories' colorKey).
const CATEGORY_ICON = {
  Shopping: '🛍️',
  'Dining Out': '🍴',
  Transport: '🚗',
  Rent: '🏠',
  Other: '🧾',
};

const CATEGORY_TINT = {
  Shopping: 'success',
  'Dining Out': 'warning',
  Transport: 'teal',
  Rent: 'teal',
  Other: 'teal',
};

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
      tint: 'teal',
    },
    {
      id: 'txn_seed_2',
      merchant: 'Blinkit',
      category: 'Shopping',
      amount: 820,
      date: '2026-08-23',
      icon: '🛍️',
      tint: 'success',
    },
    {
      id: 'txn_seed_3',
      merchant: 'Netflix',
      category: 'Other',
      amount: 649,
      date: '2026-08-12',
      icon: '📺',
      tint: 'warning',
    },
  ],
};

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    addTransaction: {
      reducer(state, action) {
        state.items.unshift(action.payload);
      },
      // Callers (including the AI quick-add flow) only supply the fields a
      // human or the model would know — id/icon/tint are always assigned
      // here so every transaction stays visually consistent.
      prepare({ merchant, category, amount, date }) {
        return {
          payload: {
            id: generateId(),
            merchant,
            category,
            amount,
            date,
            icon: CATEGORY_ICON[category] || CATEGORY_ICON.Other,
            tint: CATEGORY_TINT[category] || CATEGORY_TINT.Other,
          },
        };
      },
    },
  },
});

export const { addTransaction } = transactionsSlice.actions;
export default transactionsSlice.reducer;
