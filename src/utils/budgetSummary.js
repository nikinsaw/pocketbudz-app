// Derives Budget/Home's income-based cards (SafeToSpend, SavedThisMonth,
// GuiltFreeToSpend) from real data — envelopes, transactions, the user's
// monthlyIncome, and their chosen cycle-start day. Nothing here is stored;
// it's recomputed at render time, same pattern as envelopeDisplay.js.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// The current budget cycle's [start, end) window as real Dates, anchored to
// budgetCycleStartDay (1/5/15/25 — see data/onboardingQuestions.js). If
// today is before this month's start day, the cycle began last month.
function getCycleWindow(cycleStartDay, today) {
  const day = today.getDate();
  const start =
    day >= cycleStartDay
      ? new Date(today.getFullYear(), today.getMonth(), cycleStartDay)
      : new Date(today.getFullYear(), today.getMonth() - 1, cycleStartDay);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, cycleStartDay);

  const daysTotal = Math.round((end - start) / MS_PER_DAY);
  const daysElapsed = Math.min(Math.round((today - start) / MS_PER_DAY) + 1, daysTotal);

  return { start, end, daysTotal, daysElapsed, daysLeft: daysTotal - daysElapsed };
}

function spentInRange(transactions, startISO, endISO) {
  return transactions
    .filter((transaction) => transaction.date >= startISO && transaction.date < endISO)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

// monthlyIncome is null until the user sets it (see profileSlice) — callers
// render an empty-state prompt instead of a card when hasIncome is false.
export function computeBudgetSummary({
  envelopes,
  transactions,
  monthlyIncome,
  budgetCycleStartDay,
  today = new Date(),
}) {
  if (!monthlyIncome) {
    return { hasIncome: false, safeToSpend: null, guiltFreeToSpend: null, savedThisMonth: null };
  }

  const cycle = getCycleWindow(budgetCycleStartDay, today);
  const startISO = toISODate(cycle.start);
  const endISO = toISODate(cycle.end);

  const totalSpentThisCycle = spentInRange(transactions, startISO, endISO);

  const fixedEnvelopeTitles = new Set(
    envelopes.filter((envelope) => envelope.type === 'fixed').map((envelope) => envelope.title),
  );
  const totalFixedBudget = envelopes
    .filter((envelope) => envelope.type === 'fixed')
    .reduce((sum, envelope) => sum + envelope.budgetLimit, 0);

  // Discretionary spend so far this cycle — everything that isn't going
  // toward a fixed/recurring envelope like Rent.
  const spentOnSpendingEnvelopes = transactions
    .filter(
      (transaction) =>
        transaction.date >= startISO &&
        transaction.date < endISO &&
        !fixedEnvelopeTitles.has(transaction.category),
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  // "Safe to spend": income not yet spent, out of income overall.
  const safeToSpendAmount = Math.max(monthlyIncome - totalSpentThisCycle, 0);

  // On track if spend-so-far hasn't outpaced an even daily burn of income
  // across the cycle; otherwise flagged as overspending for the days left.
  const expectedSpendByNow = monthlyIncome * (cycle.daysElapsed / cycle.daysTotal);
  const status = totalSpentThisCycle <= expectedSpendByNow ? 'On Track' : 'Overspending';

  // "Guilt-free to spend": discretionary money left once fixed obligations
  // are set aside and today's discretionary spend is accounted for.
  const guiltFreeAmount = Math.max(monthlyIncome - totalFixedBudget - spentOnSpendingEnvelopes, 0);

  // "Saved this month" mirrors safe-to-spend (unspent income is, by
  // definition, still saved) — progress shows what fraction of income is
  // still unspent, so the bar fills as spending stays low.
  const savedProgress = Math.min(Math.max(safeToSpendAmount / monthlyIncome, 0), 1);

  return {
    hasIncome: true,
    safeToSpend: {
      amount: safeToSpendAmount.toLocaleString('en-IN'),
      total: monthlyIncome.toLocaleString('en-IN'),
      daysLeft: cycle.daysLeft,
      status,
    },
    guiltFreeToSpend: {
      amount: guiltFreeAmount.toLocaleString('en-IN'),
    },
    savedThisMonth: {
      amount: safeToSpendAmount.toLocaleString('en-IN'),
      progress: savedProgress,
    },
  };
}
