import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  budgetAlerts: true,
  streakReminders: true,
  weeklySummary: false,
  // Off by default — enabling requires an async Keychain/biometric setup
  // step (see src/storage/appLock.js), so it's set via setAppLockEnabled
  // after that succeeds, not toggled synchronously like the others.
  appLockEnabled: false,
  // Hides the Home card inviting solo users to try Household Mode. Missing from
  // older saved state, which reads as "not dismissed".
  householdPromoDismissed: false,
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
    dismissHouseholdPromo: (state) => {
      state.householdPromoDismissed = true;
    },
  },
});

export const {
  toggleBudgetAlerts,
  toggleStreakReminders,
  toggleWeeklySummary,
  setAppLockEnabled,
  dismissHouseholdPromo,
} = settingsSlice.actions;
export default settingsSlice.reducer;
