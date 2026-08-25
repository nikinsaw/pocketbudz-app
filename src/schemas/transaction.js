import { z } from 'zod';

// Matches the four budget envelopes (src/store/slices/budgetSlice.js titles)
// plus a catch-all, so a parsed transaction's category always joins cleanly
// against envelope/spend data for insight queries.
export const TRANSACTION_CATEGORIES = ['Shopping', 'Dining Out', 'Transport', 'Rent', 'Other'];

// The real Transaction shape (src/store/slices/transactionsSlice.js) has
// extra presentational fields (id, icon, tint) assigned by the slice itself,
// not by the AI — this is only the subset an LLM should be producing.
export const transactionSchema = z.object({
  merchant: z.string().trim().min(1).max(60),
  category: z.enum(TRANSACTION_CATEGORIES),
  amount: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date, YYYY-MM-DD'),
});

// Gemini's responseSchema uses the same shape but as an uppercase-typed
// OpenAPI-ish Schema object (per the Gemini REST API's Schema type enum:
// STRING/NUMBER/OBJECT/ARRAY/BOOLEAN/INTEGER — verified against the live
// API docs, not assumed).
export const transactionResponseSchema = {
  type: 'OBJECT',
  properties: {
    merchant: { type: 'STRING', description: 'Who the money was paid to' },
    category: { type: 'STRING', enum: TRANSACTION_CATEGORIES },
    amount: { type: 'NUMBER', description: 'Positive amount in rupees, no currency symbol' },
    date: { type: 'STRING', description: 'ISO 8601 date, YYYY-MM-DD' },
  },
  required: ['merchant', 'category', 'amount', 'date'],
};

// Document/photo import can surface many transactions at once, capped at a
// sane upper bound — no real personal statement has more than this in one
// file, and it keeps a malformed response from producing an unbounded array.
export const transactionsArraySchema = z.array(transactionSchema).min(1).max(200);

export const transactionsArrayResponseSchema = {
  type: 'ARRAY',
  items: transactionResponseSchema,
};
