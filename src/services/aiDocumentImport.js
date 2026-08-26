import ReactNativeBlobUtil from 'react-native-blob-util';
import { callGemini, AIUnavailableError, describeAIError } from './gemini';
import {
  buildCategoryLabels,
  buildTransactionsArraySchema,
  buildTransactionsArrayResponseSchema,
} from '../schemas/transaction';

// text/* files are embedded directly as prompt text (simpler and more
// reliable than round-tripping them through inline_data); everything else
// (images, PDFs) goes through Gemini's multimodal inline_data input, which
// does its own document/OCR understanding server-side — no local PDF-parsing
// or OCR library needed.
const TEXT_MIME_TYPES = ['text/csv', 'text/plain', 'application/json'];
const MAX_TEXT_BYTES = 300 * 1024; // 300KB — generous for any personal statement export
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB — comfortably inside Gemini's inline-data limits

function isTextMimeType(mimeType) {
  return TEXT_MIME_TYPES.includes(mimeType) || (mimeType || '').startsWith('text/');
}

// react-native-blob-util needs a bare filesystem path, not a file:// URI —
// document-picker's copyTo option guarantees a file:// path (not a
// content:// provider URI), so this is the only stripping ever needed.
function toFsPath(uri) {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}

export async function parseTransactionsFromFile({ uri, name, type, size, categories }) {
  if (typeof size === 'number' && size > MAX_FILE_BYTES) {
    return { success: false, error: 'That file is too large (max 15MB) — try a smaller export.' };
  }

  const categoryLabels = buildCategoryLabels(categories);
  const responseSchema = buildTransactionsArrayResponseSchema(categoryLabels);
  const path = toFsPath(uri);
  const today = new Date().toISOString().slice(0, 10);
  const systemInstruction = `Extract every expense transaction you can find in the attached document/image/text. Today's date is ${today} — resolve relative or partial dates against it. Each transaction's category must be exactly one of: ${categoryLabels.join(', ')} — use "Other" if nothing clearly fits. amount must be a positive number in rupees with no currency symbol or commas. Ignore anything that isn't a real expense (headers, totals, balances).`;

  let raw;
  try {
    if (isTextMimeType(type)) {
      const text = await ReactNativeBlobUtil.fs.readFile(path, 'utf8');
      if (text.length > MAX_TEXT_BYTES) {
        return {
          success: false,
          error: 'That file is too large (max ~300KB of text) — try a smaller export.',
        };
      }
      raw = await callGemini({
        prompt: `File name: ${name}\n\nContents:\n${text}`,
        systemInstruction,
        responseSchema,
      });
    } else {
      const base64 = await ReactNativeBlobUtil.fs.readFile(path, 'base64');
      raw = await callGemini({
        prompt: `File name: ${name}. Extract the transactions from the attached file.`,
        systemInstruction,
        responseSchema,
        file: { mimeType: type, base64 },
      });
    }
  } catch (error) {
    if (error instanceof AIUnavailableError) {
      return { success: false, error: describeAIError(error) };
    }
    // readFile failures (bad path, permission, unreadable file) land here.
    return { success: false, error: "Couldn't read that file — try picking it again." };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { success: false, error: "Couldn't find any transactions in that file." };
  }

  const result = buildTransactionsArraySchema(categoryLabels).safeParse(parsed);
  if (!result.success) {
    return { success: false, error: "Couldn't find any transactions in that file." };
  }

  return { success: true, transactions: result.data };
}
