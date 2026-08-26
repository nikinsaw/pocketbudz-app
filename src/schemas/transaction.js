import { z } from 'zod';

// The real Transaction shape (src/store/slices/transactionsSlice.js) has
// extra presentational fields (id, icon, colorKey) assigned by the slice
// itself, not by the AI — this is only the subset an LLM should be
// producing. category is validated against whatever the user's actual
// envelope categories are (profile.categories), not a fixed list, so every
// build* function below takes the caller's current category labels.

// 'Other' is always a valid fallback even if the user's own categories
// (unusually) don't include one.
export function buildCategoryLabels(categories) {
  const labels = categories.map((category) => category.label);
  return labels.includes('Other') ? labels : [...labels, 'Other'];
}

export function buildTransactionSchema(categoryLabels) {
  return z.object({
    merchant: z.string().trim().min(1).max(60),
    category: z.enum(categoryLabels),
    amount: z.number().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date, YYYY-MM-DD'),
  });
}

// Gemini's responseSchema uses the same shape but as an uppercase-typed
// OpenAPI-ish Schema object (per the Gemini REST API's Schema type enum:
// STRING/NUMBER/OBJECT/ARRAY/BOOLEAN/INTEGER — verified against the live
// API docs, not assumed).
export function buildTransactionResponseSchema(categoryLabels) {
  return {
    type: 'OBJECT',
    properties: {
      merchant: { type: 'STRING', description: 'Who the money was paid to' },
      category: { type: 'STRING', enum: categoryLabels },
      amount: { type: 'NUMBER', description: 'Positive amount in rupees, no currency symbol' },
      date: { type: 'STRING', description: 'ISO 8601 date, YYYY-MM-DD' },
    },
    required: ['merchant', 'category', 'amount', 'date'],
  };
}

// Document/photo import can surface many transactions at once, capped at a
// sane upper bound — no real personal statement has more than this in one
// file, and it keeps a malformed response from producing an unbounded array.
export function buildTransactionsArraySchema(categoryLabels) {
  return z.array(buildTransactionSchema(categoryLabels)).min(1).max(200);
}

export function buildTransactionsArrayResponseSchema(categoryLabels) {
  return {
    type: 'ARRAY',
    items: buildTransactionResponseSchema(categoryLabels),
  };
}
