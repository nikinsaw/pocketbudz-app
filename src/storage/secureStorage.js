import 'react-native-get-random-values';
import { createMMKV } from 'react-native-mmkv';
import * as Keychain from 'react-native-keychain';

// The MMKV file itself is encrypted, but that's only real security if the
// encryption key is unrecoverable from the app bundle/APK — so the key is
// generated once with a CSPRNG and held in the OS Keychain/Keystore, never
// hardcoded or derived from anything static.
const KEYCHAIN_SERVICE = 'pocketbudz-storage-key';
const MMKV_ID = 'pocketbudz-storage';
const ENCRYPTION_TYPE = 'AES-256';

let mmkvInstance = null;

// AES-256 keys are capped at 32 bytes as a *string* by react-native-mmkv, so
// 16 random bytes are hex-encoded to exactly 32 ASCII characters (128 bits
// of real entropy) rather than the 64 a naive hex-encode of 32 bytes would
// produce, which would exceed the cap.
function generateEncryptionKey() {
  const bytes = new Uint8Array(16);
  global.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function getOrCreateEncryptionKey() {
  const existing = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
  if (existing && existing.password) {
    return existing.password;
  }

  const key = generateEncryptionKey();
  await Keychain.setGenericPassword('pocketbudz', key, { service: KEYCHAIN_SERVICE });
  return key;
}

async function getMMKV() {
  if (mmkvInstance) {
    return mmkvInstance;
  }
  const encryptionKey = await getOrCreateEncryptionKey();
  mmkvInstance = createMMKV({ id: MMKV_ID, encryptionKey, encryptionType: ENCRYPTION_TYPE });
  return mmkvInstance;
}

// redux-persist's Storage interface: async setItem/getItem/removeItem.
const secureStorage = {
  async setItem(key, value) {
    const mmkv = await getMMKV();
    mmkv.set(key, value);
    return true;
  },
  async getItem(key) {
    const mmkv = await getMMKV();
    return mmkv.getString(key) ?? null;
  },
  async removeItem(key) {
    const mmkv = await getMMKV();
    mmkv.remove(key);
  },
};

export default secureStorage;
