import { formatRelativeDate } from './formatDate';

// tint references a theme token (pillBg/successTint/warningTint), resolved
// here at render time so icon backgrounds stay theme-aware — same pattern
// budgetSlice's colorKey uses for category dot colors.
const TINT_TOKENS = {
  teal: (colors) => colors.pillBg,
  success: (colors) => colors.successTint,
  warning: (colors) => colors.warningTint,
};

// Maps a stored Transaction (merchant/category/amount/date/icon/tint) to the
// display shape ActivityItem renders (name/subtitle/amount/icon/iconBackground).
// Shared between HomeScreen's "Recent Activity" preview and the full
// AllTransactionsScreen list so both stay in sync automatically.
export function getActivityDisplay(transaction, colors) {
  return {
    id: transaction.id,
    name: transaction.merchant,
    subtitle: formatRelativeDate(transaction.date),
    amount: transaction.amount.toLocaleString('en-IN'),
    icon: transaction.icon,
    iconBackground: TINT_TOKENS[transaction.tint](colors),
  };
}
