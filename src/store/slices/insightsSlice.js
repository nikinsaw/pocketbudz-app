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
    series: [
      { label: 'Jul', value: 18000 },
      { label: 'Aug', value: 22000 },
      { label: 'Sep', value: 25000 },
      { label: 'Oct', value: 30500 },
      { label: 'Nov', value: 36000 },
      { label: 'Dec', value: 42500 },
    ],
  },
  categorySpend: {
    // Sourced from the user's own expense log (Copy of Sheet2, personal
    // budget workbook), categorized by hand — real spend, not mock data.
    period: 'August 2026',
    total: '18,300',
    categories: [
      { name: 'Groceries', amount: '6,561', value: 6561.28, colorKey: 'groceries' },
      { name: 'Utilities', amount: '3,802', value: 3801.82, colorKey: 'utilities' },
      { name: 'Household Help', amount: '3,500', value: 3500, colorKey: 'householdHelp' },
      { name: 'Family Support', amount: '2,000', value: 2000, colorKey: 'familySupport' },
      { name: 'Dining & Snacks', amount: '1,024', value: 1024, colorKey: 'dining' },
      { name: 'Gifts & Jewelry', amount: '630', value: 630, colorKey: 'giftsJewelry' },
      { name: 'Transport', amount: '368', value: 368, colorKey: 'travel' },
      { name: 'Health & Medical', amount: '200', value: 200, colorKey: 'healthMedical' },
      { name: 'Personal Care', amount: '115', value: 115, colorKey: 'personalCare' },
      { name: 'Household Supplies', amount: '100', value: 100, colorKey: 'householdSupplies' },
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
