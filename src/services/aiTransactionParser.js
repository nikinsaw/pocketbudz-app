import { callGemini, describeAIError } from './gemini';
import {
  transactionSchema,
  transactionResponseSchema,
  TRANSACTION_CATEGORIES,
} from '../schemas/transaction';

const REPHRASE_ERROR = "Couldn't understand that — try rephrasing, e.g. \"₹500 groceries yesterday\".";

// Takes free text like "add ₹500 groceries yesterday" and returns either
// { success: true, transaction } — validated, ready to dispatch via
// addTransaction — or { success: false, error }. Never dispatches itself;
// the caller decides what to do with a validated result.
export async function parseTransactionFromPrompt(promptText) {
  const today = new Date().toISOString().slice(0, 10);
  const systemInstruction = `Extract a single expense transaction from the user's message. Today's date is ${today} — resolve relative dates ("yesterday", "last Monday") against it. category must be exactly one of: ${TRANSACTION_CATEGORIES.join(', ')} — use "Other" if nothing clearly fits. amount must be a positive number in rupees with no currency symbol or commas.`;

  let raw;
  try {
    raw = await callGemini({
      prompt: promptText,
      systemInstruction,
      responseSchema: transactionResponseSchema,
    });
  } catch (error) {
    return { success: false, error: describeAIError(error) };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { success: false, error: REPHRASE_ERROR };
  }

  const result = transactionSchema.safeParse(parsed);
  if (!result.success) {
    return { success: false, error: REPHRASE_ERROR };
  }

  return { success: true, transaction: result.data };
}
