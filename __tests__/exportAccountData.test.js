import ReactNativeBlobUtil from 'react-native-blob-util';
import { saveDocuments, isErrorWithCode } from '@react-native-documents/picker';
import { saveAccountData } from '../src/services/exportAccountData';

const data = { account: { email: 'a@x.com' }, households: [] };
const PATH = '/mock-cache/pocketbudz-account-data.json';

beforeEach(() => {
  jest.clearAllMocks();
  ReactNativeBlobUtil.fs.writeFile.mockResolvedValue();
  ReactNativeBlobUtil.fs.unlink.mockResolvedValue();
  saveDocuments.mockResolvedValue([]);
  isErrorWithCode.mockReturnValue(false);
});

describe('saveAccountData', () => {
  it('writes readable JSON to the cache and offers it to the Save dialog', async () => {
    expect(await saveAccountData(data)).toEqual({ success: true });
    expect(ReactNativeBlobUtil.fs.writeFile).toHaveBeenCalledWith(PATH, JSON.stringify(data, null, 2), 'utf8');
    expect(saveDocuments).toHaveBeenCalledWith({
      sourceUris: [`file://${PATH}`],
      mimeType: 'application/json',
      fileName: 'pocketbudz-account-data.json',
    });
  });

  it('removes the cached copy afterwards, since it holds personal data', async () => {
    await saveAccountData(data);
    expect(ReactNativeBlobUtil.fs.unlink).toHaveBeenCalledWith(PATH);
  });

  it('removes it even when saving fails', async () => {
    saveDocuments.mockRejectedValue(new Error('boom'));
    await saveAccountData(data);
    expect(ReactNativeBlobUtil.fs.unlink).toHaveBeenCalledWith(PATH);
  });

  it('reports a cancelled Save dialog as cancelled, not as an error', async () => {
    saveDocuments.mockRejectedValue({ code: 'OPERATION_CANCELED' });
    isErrorWithCode.mockReturnValue(true);
    expect(await saveAccountData(data)).toEqual({ success: false, cancelled: true });
  });

  it('reports a failed save with a message', async () => {
    saveDocuments.mockRejectedValue(new Error('boom'));
    const result = await saveAccountData(data);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/save the file/);
  });

  it('reports a file that could not be written, and never opens the dialog', async () => {
    ReactNativeBlobUtil.fs.writeFile.mockRejectedValue(new Error('disk full'));
    const result = await saveAccountData(data);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/prepare the file/);
    expect(saveDocuments).not.toHaveBeenCalled();
  });

  it('survives a failed cleanup', async () => {
    ReactNativeBlobUtil.fs.unlink.mockRejectedValue(new Error('gone'));
    expect(await saveAccountData(data)).toEqual({ success: true });
  });
});
