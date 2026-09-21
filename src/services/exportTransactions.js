import ReactNativeBlobUtil from 'react-native-blob-util';
import { saveDocuments, isErrorWithCode, errorCodes } from '@react-native-documents/picker';

const EXPORT_FILE_NAME = 'pocketbudz-transactions.csv';
const CSV_HEADER = ['Date', 'Merchant', 'Category', 'Amount'];

// Quote a field only when it actually needs it (contains a comma, quote, or
// newline) — keeps the common case readable while staying valid CSV.
function escapeCsvField(value) {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function buildTransactionsCsv(transactions) {
  const rows = transactions.map((transaction) => [
    transaction.date,
    transaction.merchant,
    transaction.category,
    transaction.amount,
  ]);
  return [CSV_HEADER, ...rows].map((row) => row.map(escapeCsvField).join(',')).join('\n');
}

// Writes the CSV to the app's own cache (no storage permission needed),
// then hands it to the system "Save As" dialog so the user picks where it
// actually ends up (Downloads, Drive, etc.) — the same saveDocuments API
// used elsewhere for writing rather than reading.
export async function exportTransactionsToCsv(transactions) {
  if (transactions.length === 0) {
    return { success: false, error: 'There are no transactions to export yet.' };
  }

  const csv = buildTransactionsCsv(transactions);
  const tempPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${EXPORT_FILE_NAME}`;

  try {
    await ReactNativeBlobUtil.fs.writeFile(tempPath, csv, 'utf8');
  } catch (error) {
    return { success: false, error: "Couldn't prepare the export file — try again." };
  }

  try {
    await saveDocuments({
      sourceUris: [`file://${tempPath}`],
      mimeType: 'text/csv',
      fileName: EXPORT_FILE_NAME,
    });
    return { success: true };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
      return { success: false, cancelled: true };
    }
    return { success: false, error: "Couldn't save the file — try again." };
  }
}
