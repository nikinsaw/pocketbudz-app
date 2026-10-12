import { GoogleSignInError, createGoogleAuth } from '../src/services/googleAuth';

const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
};
const isErrorWithCode = (e) => e instanceof Error && 'code' in e;
const codeError = (code) => Object.assign(new Error(code), { code });
const session = { accessToken: 'A', refreshToken: 'R', user: { id: 'u1', email: 'a@example.com', name: 'Asha' } };

function setup({ webClientId = 'web-client.apps.googleusercontent.com', signIn, play } = {}) {
  const google = {
    configure: jest.fn(),
    hasPlayServices: play ?? jest.fn(async () => true),
    signIn: signIn ?? jest.fn(async () => ({ type: 'success', data: { idToken: 'google-id-token' } })),
    signOut: jest.fn(async () => {}),
  };
  const api = {
    request: jest.fn(async () => session),
    startSession: jest.fn(async () => {}),
    signOut: jest.fn(async () => {}),
  };
  return { google, api, auth: createGoogleAuth({ google, statusCodes, isErrorWithCode, webClientId, api }) };
}

describe('signIn', () => {
  it('trades the Google ID token for a PocketBudz session and stores it', async () => {
    const { auth, google, api } = setup();
    await expect(auth.signIn()).resolves.toEqual(session.user);
    expect(google.configure).toHaveBeenCalledWith({ webClientId: 'web-client.apps.googleusercontent.com' });
    expect(api.request).toHaveBeenCalledWith('/auth/google', {
      method: 'POST',
      auth: false,
      body: { idToken: 'google-id-token' },
    });
    expect(api.startSession).toHaveBeenCalledWith(session);
  });

  it('configures Google once, not on every attempt', async () => {
    const { auth, google } = setup();
    await auth.signIn();
    await auth.signIn();
    expect(google.configure).toHaveBeenCalledTimes(1);
  });

  it('fails clearly when no web client ID is configured, without touching Google or the server', async () => {
    const { auth, google, api } = setup({ webClientId: '' });
    await expect(auth.signIn()).rejects.toMatchObject({ reason: 'not-configured' });
    expect(google.signIn).not.toHaveBeenCalled();
    expect(api.request).not.toHaveBeenCalled();
  });

  it('reports a cancelled sign-in (result object) as cancelled, without calling the server', async () => {
    const { auth, api } = setup({ signIn: jest.fn(async () => ({ type: 'cancelled', data: null })) });
    const error = await auth.signIn().catch((e) => e);
    expect(error).toBeInstanceOf(GoogleSignInError);
    expect(error.reason).toBe('cancelled');
    expect(api.request).not.toHaveBeenCalled();
    expect(api.startSession).not.toHaveBeenCalled();
  });

  it.each([
    ['SIGN_IN_CANCELLED', 'cancelled'],
    ['IN_PROGRESS', 'in-progress'],
    ['PLAY_SERVICES_NOT_AVAILABLE', 'play-services'],
  ])('maps the library error %s to reason "%s"', async (code, reason) => {
    const { auth } = setup({ signIn: jest.fn(async () => Promise.reject(codeError(code))) });
    await expect(auth.signIn()).rejects.toMatchObject({ name: 'GoogleSignInError', reason });
  });

  it('maps a Play services failure that happens before sign-in too', async () => {
    const { auth, google } = setup({ play: jest.fn(async () => Promise.reject(codeError('PLAY_SERVICES_NOT_AVAILABLE'))) });
    await expect(auth.signIn()).rejects.toMatchObject({ reason: 'play-services' });
    expect(google.signIn).not.toHaveBeenCalled();
  });

  it('rejects a success with a missing ID token instead of sending an empty one', async () => {
    const { auth, api } = setup({ signIn: jest.fn(async () => ({ type: 'success', data: { idToken: null } })) });
    await expect(auth.signIn()).rejects.toMatchObject({ reason: 'no-token' });
    expect(api.request).not.toHaveBeenCalled();
  });

  it('passes server rejections (ApiError) through unchanged and stores nothing', async () => {
    const { auth, api } = setup();
    const rejection = Object.assign(new Error('Invalid Google token'), { status: 401 });
    api.request.mockRejectedValueOnce(rejection);
    await expect(auth.signIn()).rejects.toBe(rejection);
    expect(api.startSession).not.toHaveBeenCalled();
  });

  it('lets unknown errors through untouched', async () => {
    const { auth } = setup({ signIn: jest.fn(async () => Promise.reject(new Error('boom'))) });
    await expect(auth.signIn()).rejects.toThrow('boom');
  });
});

describe('signOut', () => {
  it('ends the PocketBudz session and clears the cached Google account', async () => {
    const { auth, api, google } = setup();
    await auth.signOut();
    expect(api.signOut).toHaveBeenCalled();
    expect(google.signOut).toHaveBeenCalled();
  });

  it('still succeeds if Google has no cached account to clear', async () => {
    const { auth, google } = setup();
    google.signOut.mockRejectedValueOnce(new Error('no user'));
    await expect(auth.signOut()).resolves.toBeUndefined();
  });
});
