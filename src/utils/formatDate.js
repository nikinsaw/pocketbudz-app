// Formats an ISO date (YYYY-MM-DD) as "Today" / "Yesterday" / "24 Aug" for
// display, mirroring the relative-date style the app already used before
// transactions carried real dates.
export function formatRelativeDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday - startOfDate) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Today (or the given date) as YYYY-MM-DD in the phone's own time zone - not UTC, which
// would call it tomorrow/yesterday for a few hours either side of midnight in India.
export function toLocalISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// "YYYY-MM" — sortable/comparable grouping key for a transaction's month,
// independent of its display label below.
export function getMonthKey(isoDate) {
  return isoDate.slice(0, 7);
}

// "September 2026" — the section header label for a transaction's month.
export function formatMonthYear(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
