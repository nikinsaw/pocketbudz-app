const WARNING_THRESHOLD = 0.85;

// Matches a transaction to an envelope by category label — works for any
// category since both a transaction's category and an envelope's title
// ultimately come from the same profile.categories list. Shared between
// BudgetScreen (all envelopes) and HomeScreen's Budget Progress preview so
// both compute the exact same spent/remaining/progress for a given envelope.
export function computeEnvelopeDisplay(envelope, transactions) {
  const spent = transactions
    .filter((transaction) => transaction.category === envelope.title)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const progress = envelope.budgetLimit > 0 ? Math.min(spent / envelope.budgetLimit, 1) : 0;

  if (envelope.type === 'fixed') {
    return {
      ...envelope,
      subtitle: progress >= 1 ? 'Paid this cycle' : 'Fixed',
      amount: envelope.budgetLimit.toLocaleString('en-IN'),
      amountLabel: 'set aside',
      locked: true,
      progress,
    };
  }

  const remaining = Math.max(envelope.budgetLimit - spent, 0);
  const warning = progress >= WARNING_THRESHOLD;
  return {
    ...envelope,
    subtitle: warning ? 'Nearing limit' : 'On track',
    amount: remaining.toLocaleString('en-IN'),
    amountLabel: 'left',
    warning,
    progress,
  };
}
