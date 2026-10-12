import * as Keychain from 'react-native-keychain';

// Household-mode login tokens live in the OS Keychain/Keystore, never in
// redux-persist or MMKV: the refresh token is a long-lived credential, so it
// gets the same hardware-backed storage as the MMKV encryption key.
const SERVICE = 'pocketbudz-session';

export async function loadSession() {
  const stored = await Keychain.getGenericPassword({ service: SERVICE });
  if (!stored || !stored.password) {
    return null;
  }
  try {
    const { accessToken, refreshToken } = JSON.parse(stored.password);
    return accessToken && refreshToken ? { accessToken, refreshToken } : null;
  } catch {
    return null;
  }
}

export async function saveSession({ accessToken, refreshToken }) {
  await Keychain.setGenericPassword('session', JSON.stringify({ accessToken, refreshToken }), {
    service: SERVICE,
  });
}

export async function clearSession() {
  await Keychain.resetGenericPassword({ service: SERVICE });
}

export const sessionStore = { load: loadSession, save: saveSession, clear: clearSession };
