// Derives the Insights screen — savings growth, total saved trend, category
// spend breakdown, positive patterns — from real transactions, envelopes,
// and profile.monthlyIncome. Nothing here is stored; it's recomputed at
// render time, same pattern as budgetSummary.js/envelopeDisplay.js.

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const SAVED_MONTHS = 6;
const POSITIVE_PATTERN_LIMIT = 2;
// An envelope needs to be comfortably under budget (not just "not over")
// before it's surfaced as a win — otherwise a brand-new envelope with zero
// spend would show up as a fake positive pattern.
const POSITIVE_PATTERN_MAX_PROGRESS = 0.6;

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Same cycle-window logic as budgetSummary.js, but callable against any
// reference date so the 6-month trend can walk backwards through past
// cycles too.
function getCycleWindow(cycleStartDay, referenceDate) {
  const day = referenceDate.getDate();
  const start =
    day >= cycleStartDay
      ? new Date(referenceDate.getFullYear(), referenceDate.getMonth(), cycleStartDay)
      : new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, cycleStartDay);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, cycleStartDay);
  return { start, end };
}

function spentInRange(transactions, startISO, endISO) {
  return transactions
    .filter((transaction) => transaction.date >= startISO && transaction.date < endISO)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function computeInsights({
  envelopes,
  transactions,
  monthlyIncome,
  budgetCycleStartDay,
  today = new Date(),
}) {
  const currentCycle = getCycleWindow(budgetCycleStartDay, today);
  const currentStartISO = toISODate(currentCycle.start);
  const currentEndISO = toISODate(currentCycle.end);

  const cycleTransactions = transactions.filter(
    (transaction) => transaction.date >= currentStartISO && transaction.date < currentEndISO,
  );

  const spentByCategory = new Map();
  const colorKeyByCategory = new Map();
  cycleTransactions.forEach((transaction) => {
    spentByCategory.set(
      transaction.category,
      (spentByCategory.get(transaction.category) || 0) + transaction.amount,
    );
    if (!colorKeyByCategory.has(transaction.category)) {
      colorKeyByCategory.set(transaction.category, transaction.colorKey);
    }
  });
  const budgetLimitByCategory = new Map(
    envelopes.map((envelope) => [envelope.title, envelope.budgetLimit]),
  );

  // Category Spend doesn't depend on income — just needs at least one
  // transaction this cycle to be worth showing.
  let categorySpend = null;
  if (cycleTransactions.length > 0) {
    const totalSpentThisCycle = cycleTransactions.reduce(
      (sum, transaction) => sum + transaction.amount,
      0,
    );
    const categories = Array.from(spentByCategory.entries())
      .map(([name, value]) => {
        const limit = budgetLimitByCategory.get(name);
        return {
          name,
          value,
          amount: Math.round(value).toLocaleString('en-IN'),
          colorKey: colorKeyByCategory.get(name),
          warning: limit != null && value > limit,
        };
      })
      .sort((a, b) => b.value - a.value);

    categorySpend = {
      period: `${MONTH_LABELS[currentCycle.start.getMonth()]} ${currentCycle.start.getFullYear()}`,
      total: Math.round(totalSpentThisCycle).toLocaleString('en-IN'),
      categories,
    };
  }

  // Saved-per-cycle for the trailing months, mirroring budgetSummary.js's
  // "saved this month" = income not yet spent. Uses today's income for
  // every past cycle too, since past income isn't tracked historically.
  let savingsGrowth = null;
  let totalSaved = null;

  if (monthlyIncome) {
    const series = [];
    for (let i = SAVED_MONTHS - 1; i >= 0; i -= 1) {
      const reference = new Date(today.getFullYear(), today.getMonth() - i, today.getDate());
      const cycle = getCycleWindow(budgetCycleStartDay, reference);
      const spent = spentInRange(transactions, toISODate(cycle.start), toISODate(cycle.end));
      const saved = Math.max(monthlyIncome - spent, 0);
      series.push({ label: MONTH_LABELS[cycle.start.getMonth()], value: Math.round(saved) });
    }

    const latest = series[series.length - 1].value;
    const previous = series.length > 1 ? series[series.length - 2].value : null;
    const changePercent =
      previous ? Math.round(((latest - previous) / previous) * 100) : null;

    totalSaved = {
      label: 'Saved This Cycle',
      amount: latest.toLocaleString('en-IN'),
      changeLabel: changePercent == null ? '—' : `${changePercent >= 0 ? '+' : ''}${changePercent}%`,
      series,
    };

    if (previous == null) {
      savingsGrowth = {
        title: 'Getting started',
        message: "Keep logging transactions and we'll track how your savings grow over time.",
      };
    } else if (latest >= previous) {
      savingsGrowth = {
        title: 'Great job!',
        message: `You saved ₹${(latest - previous).toLocaleString('en-IN')} more than last cycle!`,
      };
    } else {
      savingsGrowth = {
        title: 'Keep an eye on spending',
        message: `You saved ₹${(previous - latest).toLocaleString('en-IN')} less than last cycle.`,
      };
    }
  }

  // Positive patterns — envelopes comfortably under budget this cycle are a
  // genuine, derivable win. Zero spend isn't credited (nothing to praise
  // yet), and everything is capped to a couple of the strongest results.
  const positivePatterns = envelopes
    .map((envelope) => {
      const spent = spentByCategory.get(envelope.title) || 0;
      const progress = envelope.budgetLimit > 0 ? spent / envelope.budgetLimit : 0;
      return { envelope, spent, progress };
    })
    .filter(({ spent, progress }) => spent > 0 && progress <= POSITIVE_PATTERN_MAX_PROGRESS)
    .sort((a, b) => a.progress - b.progress)
    .slice(0, POSITIVE_PATTERN_LIMIT)
    .map(({ envelope, progress }) => ({
      icon: envelope.icon,
      title: `On track with ${envelope.title}`,
      description: `You've used only ${Math.round(progress * 100)}% of your ₹${envelope.budgetLimit.toLocaleString('en-IN')} budget this cycle.`,
    }));

  return { categorySpend, savingsGrowth, totalSaved, positivePatterns };
}
