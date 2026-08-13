import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  budgetAlerts: true,
  streakReminders: true,
  weeklySummary: false,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    toggleBudgetAlerts: (state) => {
      state.budgetAlerts = !state.budgetAlerts;
    },
    toggleStreakReminders: (state) => {
      state.streakReminders = !state.streakReminders;
    },
    toggleWeeklySummary: (state) => {
      state.weeklySummary = !state.weeklySummary;
    },
  },
});

export const { toggleBudgetAlerts, toggleStreakReminders, toggleWeeklySummary } =
  settingsSlice.actions;
export default settingsSlice.reducer;
