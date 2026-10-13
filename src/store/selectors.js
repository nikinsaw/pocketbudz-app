import { createSelector } from '@reduxjs/toolkit';
import { selectHouseholdMode } from './slices/householdSlice';
import {
  monthlyIncomeFor,
  toAppEnvelope,
  toAppTransaction,
} from '../utils/householdDataMapping';

// The one place that decides where the screens' data comes from. Solo mode (the default,
// and everyone who never opts in) reads the phone's own slices exactly as before.
// Household mode reads the server data, converted to the same shapes, so Home, Budget,
// Insights etc. need no other change.

export const selectIsHousehold = (state) => selectHouseholdMode(state) === 'household';

const selectHouseholdEnvelopes = createSelector(
  [(state) => state.householdData.envelopes],
  (envelopes) => envelopes.map(toAppEnvelope),
);

const selectHouseholdTransactions = createSelector(
  [(state) => state.householdData.transactions, (state) => state.profile.categories],
  (transactions, categories) => transactions.map((t) => toAppTransaction(t, categories)),
);

export const selectEnvelopes = (state) =>
  selectIsHousehold(state) ? selectHouseholdEnvelopes(state) : state.budget.envelopes;

export const selectTransactions = (state) =>
  selectIsHousehold(state) ? selectHouseholdTransactions(state) : state.transactions.items;

// Household: an earner's own income, or a spender's allowance (null when there is none).
export const selectMonthlyIncome = (state) =>
  selectIsHousehold(state)
    ? monthlyIncomeFor(state.household.current.role, state.householdData)
    : state.profile.monthlyIncome;

// In a household every member follows the household's cycle, not their own setting.
export const selectBudgetCycleStartDay = (state) =>
  (selectIsHousehold(state) && state.householdData.cycleStartDay) || state.profile.budgetCycleStartDay;

// 'idle' | 'loading' | 'refreshing' | 'ready' | 'error', with the error text. Solo is
// always 'ready': there is nothing to wait for.
export const selectSync = (state) =>
  selectIsHousehold(state)
    ? { status: state.householdData.status, error: state.householdData.error }
    : { status: 'ready', error: '' };

export const selectMyHouseholdRole = (state) => state.household.current?.role ?? null;
