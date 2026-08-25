import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  budgetAlerts: true,
  streakReminders: true,
  weeklySummary: false,
  // Off by default — enabling requires an async Keychain/biometric setup
  // step (see src/storage/appLock.js), so it's set via setAppLockEnabled
  // after that succeeds, not toggled synchronously like the others.
  appLockEnabled: false,
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
    setAppLockEnabled: (state, action) => {
      state.appLockEnabled = action.payload;
    },
  },
});

export const {
  toggleBudgetAlerts,
  toggleStreakReminders,
  toggleWeeklySummary,
  setAppLockEnabled,
} = settingsSlice.actions;
export default settingsSlice.reducer;
