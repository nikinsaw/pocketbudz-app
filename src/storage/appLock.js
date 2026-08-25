import * as Keychain from 'react-native-keychain';

// Separate Keychain service from secureStorage.js's encryption key — this
// entry holds no real secret, it exists purely so retrieving it can be
// gated behind Face ID/Touch ID/fingerprint via ACCESS_CONTROL.
const APP_LOCK_SERVICE = 'pocketbudz-app-lock';

export async function isBiometricAvailable() {
  const biometryType = await Keychain.getSupportedBiometryType();
  return biometryType !== null;
}

export async function enableAppLock() {
  await Keychain.setGenericPassword('pocketbudz-app-lock', 'unlock-token', {
    service: APP_LOCK_SERVICE,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
  });
}

export async function disableAppLock() {
  await Keychain.resetGenericPassword({ service: APP_LOCK_SERVICE });
}

export async function verifyAppLock() {
  try {
    const result = await Keychain.getGenericPassword({
      service: APP_LOCK_SERVICE,
      authenticationPrompt: {
        title: 'Unlock PocketBudz',
        subtitle: 'Confirm your identity to continue',
        cancel: 'Cancel',
      },
    });
    return Boolean(result);
  } catch (error) {
    return false;
  }
}
