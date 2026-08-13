import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  savingsGrowth: {
    title: 'Great job!',
    message: 'You saved ₹2,100 more than last month!',
  },
  totalSaved: {
    label: 'Total Saved (6 mo)',
    amount: '42,500',
    changeLabel: '+12.4%',
    months: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
  categorySpend: {
    total: '18,200',
    categories: [
      { name: 'Housing', amount: '8,000', colorKey: 'housing' },
      { name: 'Groceries', amount: '5,000', colorKey: 'groceries' },
      { name: 'Dining Out', amount: '4,200', colorKey: 'dining', warning: true },
      { name: 'Transport', amount: '1,000', colorKey: 'travel' },
    ],
  },
  positivePatterns: [
    {
      icon: '☕',
      title: 'Lower coffee spend',
      description: 'You spent 20% less on cafes this week compared to your average.',
    },
    {
      icon: '🏆',
      title: 'Great weekend saving',
      description: 'Stayed within budget for entertainment for the 3rd weekend in a row.',
    },
  ],
};

const insightsSlice = createSlice({
  name: 'insights',
  initialState,
  reducers: {},
});

export default insightsSlice.reducer;
