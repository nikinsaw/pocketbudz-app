import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  pick,
  keepLocalCopy,
  types as DocumentType,
  isErrorWithCode,
  errorCodes,
} from '@react-native-documents/picker';
import { buildCategoryLabels } from '../schemas/transaction';

const IMPORT_FILE_TYPES = [DocumentType.csv, DocumentType.plainText].flat();
const MAX_TEXT_BYTES = 2 * 1024 * 1024; // 2MB — generous for years of exported history

// document-picker's copyTo option guarantees a file:// path (not a
// content:// provider URI) — same helper as aiDocumentImport.js.
function toFsPath(uri) {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}

// Minimal RFC 4180 field splitter — handles quoted fields containing commas
// or escaped ("") quotes, which is all our own export (and any sane CSV
// export) produces. No library needed for four plain columns.
function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

// Parses the same Date/Merchant/Category/Amount shape this app exports
// (column order doesn't matter, matched by header name). Rows that don't
// parse cleanly are skipped rather than failing the whole import — one bad
// line in a long history shouldn't block the rest. A category not in the
// user's current list falls back to "Other" instead of being rejected.
export function parseTransactionsCsv(csvText, categories) {
  const categoryLabels = buildCategoryLabels(categories);
  const lines = csvText.split(/\r\n|\r|\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return { transactions: [], skipped: 0 };
  }

  const header = parseCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase());
  const dateIndex = header.indexOf('date');
  const merchantIndex = header.indexOf('merchant');
  const categoryIndex = header.indexOf('category');
  const amountIndex = header.indexOf('amount');

  if (dateIndex === -1 || merchantIndex === -1 || amountIndex === -1) {
    return {
      transactions: [],
      skipped: 0,
      error: "That file doesn't look like a transactions export — expected Date, Merchant, and Amount columns.",
    };
  }

  const transactions = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const date = values[dateIndex]?.trim();
    const merchant = values[merchantIndex]?.trim();
    const amount = Number(values[amountIndex]?.trim().replace(/,/g, ''));
    const rawCategory = categoryIndex !== -1 ? values[categoryIndex]?.trim() : '';

    const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(date || '');
    if (!isValidDate || !merchant || !Number.isFinite(amount) || amount <= 0) {
      skipped += 1;
      continue;
    }

    transactions.push({
      date,
      merchant,
      amount,
      category: categoryLabels.includes(rawCategory) ? rawCategory : 'Other',
    });
  }

  return { transactions, skipped };
}

export async function importTransactionsFromFile(categories) {
  let picked;
  try {
    const [result] = await pick({ type: IMPORT_FILE_TYPES });
    picked = result;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
      return { success: false, cancelled: true };
    }
    return { success: false, error: "Couldn't open that file — try again." };
  }

  if (typeof picked.size === 'number' && picked.size > MAX_TEXT_BYTES) {
    return { success: false, error: 'That file is too large (max 2MB) — try a smaller export.' };
  }

  const [copy] = await keepLocalCopy({
    files: [{ uri: picked.uri, fileName: picked.name || 'import.csv' }],
    destination: 'cachesDirectory',
  });
  if (copy.status !== 'success') {
    return { success: false, error: "Couldn't read that file — try again." };
  }

  let text;
  try {
    text = await ReactNativeBlobUtil.fs.readFile(toFsPath(copy.localUri), 'utf8');
  } catch (error) {
    return { success: false, error: "Couldn't read that file — try again." };
  }

  const { transactions, skipped, error: parseError } = parseTransactionsCsv(text, categories);
  if (parseError) {
    return { success: false, error: parseError };
  }
  if (transactions.length === 0) {
    return { success: false, error: 'No valid transactions were found in that file.' };
  }

  return { success: true, transactions, skipped };
}
