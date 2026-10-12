// Builds the payload for POST /households/:id/import from what is on the phone.
//
// The server is all-or-nothing (one invalid row rejects the whole upload), and old
// on-device data can hold rows that could never be valid. So rows that the server would
// reject are dropped here and counted, so the person can be told instead of failing.
// Limits mirror backend/src/importer/routes.ts.
export const MAX_TRANSACTIONS = 10000;
export const MAX_ENVELOPES = 200;
const MAX_RUPEES = 100000000;

function isRealDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const isRupees = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_RUPEES;

// Whole paise must be at least 1, or the server rejects it as "too small".
const isUsableAmount = (value) => isRupees(value) && Math.round(value * 100) >= 1;

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

export function buildSoloData({ envelopes, transactions, monthlyIncome }, envelopeScope) {
  const validEnvelopes = envelopes.filter(
    (e) => hasText(e.title) && isRupees(e.budgetLimit),
  );
  const validTransactions = transactions.filter(
    (t) => isRealDate(t.date) && isUsableAmount(t.amount),
  );

  // Newest first, so if there are more than the server accepts the most recent survive.
  const newestFirst = [...validTransactions].sort((a, b) => b.date.localeCompare(a.date));
  const keptTransactions = newestFirst.slice(0, MAX_TRANSACTIONS);
  const keptEnvelopes = validEnvelopes.slice(0, MAX_ENVELOPES);

  return {
    payload: {
      envelopeScope,
      monthlyIncome: isRupees(monthlyIncome) && monthlyIncome > 0 ? monthlyIncome : null,
      envelopes: keptEnvelopes.map((e) => ({
        categoryKey: e.categoryKey ?? 'other',
        icon: e.icon ?? '🧾',
        title: e.title,
        colorKey: e.colorKey ?? 'other',
        type: e.type ?? 'spending',
        budgetLimit: e.budgetLimit,
      })),
      transactions: keptTransactions.map((t) => ({
        merchant: hasText(t.merchant) ? t.merchant : 'Unknown',
        category: hasText(t.category) ? t.category : 'Other',
        amount: t.amount,
        date: t.date,
      })),
    },
    counts: { envelopes: keptEnvelopes.length, transactions: keptTransactions.length },
    skipped: {
      envelopes: envelopes.length - keptEnvelopes.length,
      transactions: transactions.length - keptTransactions.length,
    },
  };
}
