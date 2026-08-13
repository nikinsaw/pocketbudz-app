import { createSlice } from '@reduxjs/toolkit';

// colorKey references a token in theme/palettes.js, resolved at render time
// so category colors stay theme-aware instead of being frozen into state.
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
      icon: '🛍️',
      title: 'Shopping',
      subtitle: 'Guilt-free zone',
      amount: '8,500',
      amountLabel: 'left',
    },
    {
      icon: '🍴',
      title: 'Dining Out',
      subtitle: 'Treat yourself',
      amount: '4,200',
      amountLabel: 'left',
    },
    {
      icon: '🚗',
      title: 'Transport',
      subtitle: 'Nearing limit',
      amount: '500',
      amountLabel: 'left',
      warning: true,
    },
    {
      icon: '🏠',
      title: 'Rent',
      subtitle: 'Fixed',
      amount: '32,000',
      amountLabel: 'set aside',
      locked: true,
      progress: 0.8,
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
  reducers: {},
});

export default budgetSlice.reducer;
