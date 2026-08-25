import { callGemini, describeAIError } from './gemini';

// Parses a display string like "8,500" into a plain number. Envelope
// amounts are stored pre-formatted for the UI (src/store/slices/budgetSlice.js).
function parseDisplayAmount(value) {
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

// Aggregates raw transactions into per-category totals, and reduces each
// envelope to just its category + remaining/set-aside amount — this is the
// "category, amount, date" level of detail the insight prompt actually
// needs, not the full transaction list (merchant names, ids, icons, tints
// are irrelevant to a spending question and would only inflate the payload).
export function summarizeSpending(transactions, envelopes) {
  const categoryTotals = {};
  transactions.forEach((transaction) => {
    categoryTotals[transaction.category] =
      (categoryTotals[transaction.category] || 0) + transaction.amount;
  });

  const categorySpend = Object.entries(categoryTotals).map(([category, total]) => ({
    category,
    total,
  }));

  const envelopeSummary = envelopes.map((envelope) => ({
    category: envelope.title,
    amount: parseDisplayAmount(envelope.amount),
    amountMeaning: envelope.amountLabel, // "left" (remaining budget) or "set aside" (fixed/sinking fund)
  }));

  return { categorySpend, envelopes: envelopeSummary };
}

export async function getSpendingInsight(question, transactions, envelopes) {
  const summary = summarizeSpending(transactions, envelopes);

  const prompt = `You are a budgeting assistant inside a personal finance app. Given the JSON spending summary below, answer the user's question in 2-3 short, conversational sentences. No markdown, no bullet points — plain text only.

Spending summary (categorySpend = total logged this cycle per category; envelopes = the budget set for each category, where amountMeaning "left" means remaining budget and "set aside" means a fixed amount already allocated):
${JSON.stringify(summary)}

User's question: ${question}`;

  try {
    const text = await callGemini({ prompt });
    return { success: true, text: text.trim() };
  } catch (error) {
    return { success: false, error: describeAIError(error) };
  }
}
