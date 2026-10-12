// Google sign-in for household mode: get a Google ID token on the device, then
// trade it for PocketBudz tokens at POST /auth/google. The backend verifies the
// token against the same web client ID configured here.

export class GoogleSignInError extends Error {
  constructor(reason, message) {
    super(message);
    this.name = 'GoogleSignInError';
    // 'cancelled' | 'in-progress' | 'play-services' | 'no-token' | 'not-configured'
    this.reason = reason;
  }
}

export function createGoogleAuth({ google, statusCodes, isErrorWithCode, webClientId, api }) {
  let configured = false;

  function ensureConfigured() {
    if (!webClientId) {
      throw new GoogleSignInError('not-configured', 'Google sign-in is not set up in this build.');
    }
    if (!configured) {
      google.configure({ webClientId });
      configured = true;
    }
  }

  function translate(error) {
    if (error instanceof GoogleSignInError) {
      return error;
    }
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return new GoogleSignInError('cancelled', 'Sign-in was cancelled.');
      }
      if (error.code === statusCodes.IN_PROGRESS) {
        return new GoogleSignInError('in-progress', 'Sign-in is already in progress.');
      }
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return new GoogleSignInError(
          'play-services',
          'Google Play services are missing or out of date on this device.',
        );
      }
    }
    return error;
  }

  return {
    // Resolves with the PocketBudz user; throws GoogleSignInError (cancel, no
    // Play services, ...) or ApiError (server rejected the token / unreachable).
    async signIn() {
      try {
        ensureConfigured();
        await google.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const response = await google.signIn();
        if (response.type !== 'success') {
          throw new GoogleSignInError('cancelled', 'Sign-in was cancelled.');
        }
        const idToken = response.data.idToken;
        if (!idToken) {
          throw new GoogleSignInError('no-token', 'Google did not return an ID token. Try again.');
        }
        const session = await api.request('/auth/google', {
          method: 'POST',
          auth: false,
          body: { idToken },
        });
        await api.startSession(session);
        return session.user;
      } catch (error) {
        throw translate(error);
      }
    },

    // Ends the PocketBudz session on the server and device, and Google's cached
    // account so the next sign-in shows the account chooser.
    async signOut() {
      await api.signOut();
      try {
        await google.signOut();
      } catch {
        // Nothing cached, or Google's SDK failed - the PocketBudz session is already gone.
      }
    },
  };
}
