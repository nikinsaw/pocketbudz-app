import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  hasCompletedOnboarding: false,
  name: '',
  currencyFormat: 'indian',
  budgetCycleStartDay: 1,
  // null until the user sets it (Budget screen's SafeToSpendCard prompts
  // for it) — everything derived from income (SafeToSpendCard,
  // SavedThisMonthCard, GuiltFreeCard) shows an empty-state prompt instead
  // of a number until this is set. See src/utils/budgetSummary.js.
  monthlyIncome: null,
  // Resulting personalized category list from onboarding (BASE_CATEGORIES +
  // whichever CATEGORY_QUESTIONS answers produced a category).
  categories: [],
  // Raw answers keyed by question id, so "retake onboarding" can pre-fill
  // rather than starting blank.
  answers: {},
};

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    completeOnboarding: (state, action) => {
      const { name, currencyFormat, budgetCycleStartDay, categories, answers } = action.payload;
      state.hasCompletedOnboarding = true;
      state.name = name;
      state.currencyFormat = currencyFormat;
      state.budgetCycleStartDay = budgetCycleStartDay;
      state.categories = categories;
      state.answers = answers;
    },
    resetOnboarding: (state) => {
      state.hasCompletedOnboarding = false;
    },
    setMonthlyIncome: (state, action) => {
      state.monthlyIncome = action.payload;
    },
    addCategory: (state, action) => {
      const { key, label, icon, colorKey } = action.payload;
      // No-op if it already exists (e.g. double-submit) rather than a
      // visible duplicate in every category picker from here on.
      if (state.categories.some((category) => category.key === key)) {
        return;
      }
      state.categories.push({ key, label, icon, colorKey });
    },
  },
});

export const { completeOnboarding, resetOnboarding, addCategory, setMonthlyIncome } =
  profileSlice.actions;
export default profileSlice.reducer;
