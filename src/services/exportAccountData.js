import ReactNativeBlobUtil from 'react-native-blob-util';
import { saveDocuments, isErrorWithCode, errorCodes } from '@react-native-documents/picker';

const EXPORT_FILE_NAME = 'pocketbudz-account-data.json';

// Saves the account export as a JSON file, the same way transactions are exported: written
// to the app's cache (no storage permission), then the system "Save As" dialog lets the
// person choose where it goes.
export async function saveAccountData(data) {
  const tempPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${EXPORT_FILE_NAME}`;

  try {
    await ReactNativeBlobUtil.fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    return { success: false, error: "Couldn't prepare the file — try again." };
  }

  try {
    await saveDocuments({
      sourceUris: [`file://${tempPath}`],
      mimeType: 'application/json',
      fileName: EXPORT_FILE_NAME,
    });
    return { success: true };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
      return { success: false, cancelled: true };
    }
    return { success: false, error: "Couldn't save the file — try again." };
  } finally {
    // The copy in the cache holds personal data; don't leave it lying around.
    ReactNativeBlobUtil.fs.unlink(tempPath).catch(() => {});
  }
}
