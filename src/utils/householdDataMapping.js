// Converts household data from the server (amounts in paise, server field names) into the
// shapes the existing screens already use for solo data (amounts in rupees), so Home,
// Budget, Insights etc. work unchanged against either source.

const FALLBACK_ICON = '🧾';
const FALLBACK_COLOR_KEY = 'householdSupplies';

export const toRupees = (paise) => paise / 100;
export const toPaise = (rupees) => Math.round(rupees * 100);

export function toAppEnvelope(envelope) {
  return {
    id: envelope.id,
    categoryKey: envelope.categoryKey,
    icon: envelope.icon,
    title: envelope.title,
    colorKey: envelope.colorKey,
    type: envelope.type,
    budgetLimit: toRupees(envelope.budgetLimit),
    // Household-only extras the solo screens ignore.
    scope: envelope.scope,
    shared: envelope.scope === 'SHARED',
    ownerId: envelope.ownerId ?? null,
  };
}

export function toAppTransaction(transaction, categories = []) {
  const match = categories.find((c) => c.label === transaction.category);
  return {
    id: transaction.id,
    merchant: transaction.merchant,
    category: transaction.category,
    amount: toRupees(transaction.amount),
    date: transaction.date,
    icon: match?.icon ?? FALLBACK_ICON,
    colorKey: match?.colorKey ?? FALLBACK_COLOR_KEY,
    // Household-only extras the solo screens ignore.
    envelopeId: transaction.envelopeId ?? null,
    mine: transaction.mine,
    memberName: transaction.member?.name ?? null,
  };
}

// The "monthly income" the solo-style cards (Saved this month, Guilt-free...) work from.
// Earners: what they earn. Spenders: the allowance set aside for them - that is their
// spending money. null when there is none, which those cards render as an empty state.
export function monthlyIncomeFor(role, data) {
  if (role === 'OWNER' || role === 'EARNER') {
    const mine = (data.income?.sources ?? []).filter((s) => s.mine);
    return mine.length > 0 ? toRupees(mine.reduce((sum, s) => sum + s.amount, 0)) : null;
  }
  return data.allowanceReceived > 0 ? toRupees(data.allowanceReceived) : null;
}

// Which envelope a transaction in `category` belongs to, by title (case-insensitive) - the
// same rule the solo app and the server's importer use. A member's own personal envelope
// wins over a shared one of the same name. null = not in any envelope (stays private).
export function envelopeIdForCategory(category, envelopes, myMembershipId) {
  const wanted = String(category ?? '').trim().toLowerCase();
  if (!wanted) {
    return null;
  }
  const matches = envelopes.filter((e) => e.title.trim().toLowerCase() === wanted);
  const own = matches.find((e) => e.scope === 'PERSONAL' && e.ownerId === myMembershipId);
  return (own ?? matches.find((e) => e.scope === 'SHARED'))?.id ?? null;
}
