import { createSlice } from '@reduxjs/toolkit';

function generateId() {
  return `env_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// colorKey references a token in theme/palettes.js, resolved at render time
// so category colors stay theme-aware instead of being frozen into state.
//
// Envelopes carry a real budgetLimit now (rather than a hand-authored
// "remaining" string) — BudgetScreen computes spent/remaining/progress from
// real transactions at render time, matching transaction.category against
// envelope.title. That match is label-based and only works for the five
// categories the AI's transactionSchema knows about (Shopping, Dining Out,
// Transport, Rent, Other) — a custom envelope category (e.g. "School Fees")
// won't accumulate spend until the AI schema is made category-list-aware,
// a separate follow-up.
const initialState = {
  savedThisMonth: {
    amount: '12,400',
    streakDays: 12,
    progress: 0.68,
  },
  guiltFreeToSpend: {
    amount: '8,600',
  },
  safeToSpend: {
    amount: '45,200',
    total: '60,000',
    daysLeft: 12,
    status: 'On Track',
  },
  envelopes: [
    {
      id: 'env_seed_1',
      categoryKey: 'shopping',
      icon: '🛍️',
      title: 'Shopping',
      colorKey: 'giftsJewelry',
      type: 'spending',
      budgetLimit: 10000,
    },
    {
      id: 'env_seed_2',
      categoryKey: 'diningOut',
      icon: '🍴',
      title: 'Dining Out',
      colorKey: 'dining',
      type: 'spending',
      budgetLimit: 5000,
    },
    {
      id: 'env_seed_3',
      categoryKey: 'transport',
      icon: '🚗',
      title: 'Transport',
      colorKey: 'travel',
      type: 'spending',
      budgetLimit: 1000,
    },
    {
      id: 'env_seed_4',
      categoryKey: 'rent',
      icon: '🏠',
      title: 'Rent',
      colorKey: 'householdSupplies',
      type: 'fixed',
      budgetLimit: 32000,
    },
  ],
  categories: [
    { name: 'Dining', icon: '🍴', remaining: '2,400', progress: 0.6, colorKey: 'dining' },
    { name: 'Groceries', icon: '🛒', remaining: '4,100', progress: 0.3, colorKey: 'groceries' },
    { name: 'Travel', icon: '🚗', remaining: '900', progress: 0.85, colorKey: 'travel' },
  ],
};

const budgetSlice = createSlice({
  name: 'budget',
  initialState,
  reducers: {
    addEnvelope: {
      reducer(state, action) {
        state.envelopes.push(action.payload);
      },
      prepare({ categoryKey, icon, title, colorKey, type, budgetLimit }) {
        return {
          payload: {
            id: generateId(),
            categoryKey,
            icon,
            title,
            colorKey,
            type,
            budgetLimit,
          },
        };
      },
    },
    updateEnvelope: (state, action) => {
      const { id, categoryKey, icon, title, colorKey, type, budgetLimit } = action.payload;
      const envelope = state.envelopes.find((item) => item.id === id);
      if (!envelope) {
        return;
      }
      envelope.categoryKey = categoryKey;
      envelope.icon = icon;
      envelope.title = title;
      envelope.colorKey = colorKey;
      envelope.type = type;
      envelope.budgetLimit = budgetLimit;
    },
  },
});

export const { addEnvelope, updateEnvelope } = budgetSlice.actions;
export default budgetSlice.reducer;
