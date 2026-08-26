import { callGemini, describeAIError } from './gemini';
import {
  buildCategoryLabels,
  buildTransactionSchema,
  buildTransactionResponseSchema,
} from '../schemas/transaction';

const REPHRASE_ERROR = "Couldn't understand that — try rephrasing, e.g. \"₹500 groceries yesterday\".";

// Takes free text like "add ₹500 groceries yesterday" and returns either
// { success: true, transaction } — validated, ready to dispatch via
// addTransaction — or { success: false, error }. Never dispatches itself;
// the caller decides what to do with a validated result. `categories` is
// the user's real envelope categories (state.profile.categories) so the
// model can only pick a category the user actually has.
export async function parseTransactionFromPrompt(promptText, categories) {
  const categoryLabels = buildCategoryLabels(categories);
  const today = new Date().toISOString().slice(0, 10);
  const systemInstruction = `Extract a single expense transaction from the user's message. Today's date is ${today} — resolve relative dates ("yesterday", "last Monday") against it. category must be exactly one of: ${categoryLabels.join(', ')} — use "Other" if nothing clearly fits. amount must be a positive number in rupees with no currency symbol or commas.`;

  let raw;
  try {
    raw = await callGemini({
      prompt: promptText,
      systemInstruction,
      responseSchema: buildTransactionResponseSchema(categoryLabels),
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

  const result = buildTransactionSchema(categoryLabels).safeParse(parsed);
  if (!result.success) {
    return { success: false, error: REPHRASE_ERROR };
  }

  return { success: true, transaction: result.data };
}
