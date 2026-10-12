import * as Keychain from 'react-native-keychain';
import { clearSession, loadSession, saveSession } from '../src/storage/sessionStore';

const tokens = { accessToken: 'access-1', refreshToken: 'refresh-1' };

afterEach(() => jest.clearAllMocks());

describe('sessionStore', () => {
  it('saves both tokens under its own Keychain service', async () => {
    await saveSession(tokens);
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith('session', JSON.stringify(tokens), {
      service: 'pocketbudz-session',
    });
  });

  it('loads what was saved', async () => {
    Keychain.getGenericPassword.mockResolvedValueOnce({ username: 'session', password: JSON.stringify(tokens) });
    await expect(loadSession()).resolves.toEqual(tokens);
    expect(Keychain.getGenericPassword).toHaveBeenCalledWith({ service: 'pocketbudz-session' });
  });

  it('reads as signed out when nothing is stored', async () => {
    Keychain.getGenericPassword.mockResolvedValueOnce(false);
    await expect(loadSession()).resolves.toBeNull();
  });

  it.each([
    ['not JSON', 'garbage{'],
    ['missing refresh token', JSON.stringify({ accessToken: 'a' })],
    ['missing access token', JSON.stringify({ refreshToken: 'r' })],
    ['empty', ''],
  ])('treats corrupted data (%s) as signed out instead of crashing', async (_name, password) => {
    Keychain.getGenericPassword.mockResolvedValueOnce({ username: 'session', password });
    await expect(loadSession()).resolves.toBeNull();
  });

  it('clears only its own Keychain entry', async () => {
    await clearSession();
    expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({ service: 'pocketbudz-session' });
  });
});
