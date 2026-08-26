import { formatRelativeDate } from './formatDate';

// Maps a stored Transaction (merchant/category/amount/date/icon/colorKey) to
// the display shape ActivityItem renders (name/subtitle/amount/icon/iconBackground).
// Shared between HomeScreen's "Recent Activity" preview and the full
// AllTransactionsScreen list so both stay in sync automatically. colorKey
// resolves to a `${colorKey}Tint` theme token (theme/palettes.js) — the same
// colorKey a transaction's category/envelope uses for its solid color.
export function getActivityDisplay(transaction, colors) {
  return {
    id: transaction.id,
    name: transaction.merchant,
    subtitle: formatRelativeDate(transaction.date),
    amount: transaction.amount.toLocaleString('en-IN'),
    icon: transaction.icon,
    iconBackground: colors[`${transaction.colorKey}Tint`] || colors.pillBg,
  };
}
