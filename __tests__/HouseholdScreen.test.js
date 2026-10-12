import HouseholdScreen from '../src/Screens/HouseholdScreen';
import { householdActions } from '../src/services/householdApp';
import { AGREEMENT_VERSION } from '../src/data/householdAgreement';
import { signedIn, signedOut } from '../src/store/slices/householdSlice';
import { allText, hasText, pressText, renderScreen, typeInto } from '../jest/renderScreen';

jest.mock('../src/services/householdApp', () => ({
  householdActions: {
    signIn: jest.fn(),
    restore: jest.fn(),
    signOut: jest.fn(),
    createHousehold: jest.fn(),
    joinHousehold: jest.fn(),
    fetchConsentVersion: jest.fn(),
  },
}));

const user = { id: 'u1', email: 'asha@example.com', name: 'Asha' };
const noop = () => () => Promise.resolve();

beforeEach(() => {
  jest.clearAllMocks();
  householdActions.signIn.mockImplementation(noop);
  householdActions.restore.mockImplementation(noop);
  householdActions.signOut.mockImplementation(noop);
  householdActions.createHousehold.mockImplementation(noop);
  householdActions.joinHousehold.mockImplementation(noop);
  householdActions.fetchConsentVersion.mockImplementation(() => Promise.resolve(AGREEMENT_VERSION));
});

describe('HouseholdScreen in solo mode', () => {
  it('explains Household Mode and offers Google sign-in', async () => {
    const { root } = await renderScreen(HouseholdScreen);
    expect(hasText(root, 'Household mode')).toBe(true);
    expect(hasText(root, 'Budget together')).toBe(true);
    expect(hasText(root, 'Continue with Google')).toBe(true);
    expect(hasText(root, 'Nothing from this phone is uploaded')).toBe(true);
  });

  it('makes no network call just by opening (solo users stay fully offline)', async () => {
    await renderScreen(HouseholdScreen);
    expect(householdActions.restore).not.toHaveBeenCalled();
    expect(householdActions.signIn).not.toHaveBeenCalled();
  });

  it('starts sign-in when the button is pressed', async () => {
    const { root } = await renderScreen(HouseholdScreen);
    await pressText(root, 'Continue with Google');
    expect(householdActions.signIn).toHaveBeenCalledTimes(1);
  });

  it('shows a friendly error when sign-in fails', async () => {
    householdActions.signIn.mockImplementation(
      () => () => Promise.reject(Object.assign(new Error('x'), { status: 0 })),
    );
    const { root } = await renderScreen(HouseholdScreen);
    await pressText(root, 'Continue with Google');
    expect(hasText(root, 'Can’t reach the server')).toBe(true);
    // ...and the button is usable again.
    expect(hasText(root, 'Continue with Google')).toBe(true);
  });

  it('says nothing when the person simply cancels the Google chooser', async () => {
    householdActions.signIn.mockImplementation(
      () => () => Promise.reject(Object.assign(new Error('cancelled'), { reason: 'cancelled' })),
    );
    const { root } = await renderScreen(HouseholdScreen);
    await pressText(root, 'Continue with Google');
    expect(allText(root).join(' ')).not.toMatch(/Something went wrong|Can.t reach/);
    expect(hasText(root, 'Continue with Google')).toBe(true);
  });

  it('moves on from the intro once sign-in succeeds', async () => {
    householdActions.signIn.mockImplementation(() => (dispatch) => {
      dispatch(signedIn(user));
      return Promise.resolve(user);
    });
    const { root } = await renderScreen(HouseholdScreen);
    await pressText(root, 'Continue with Google');
    expect(hasText(root, 'Budget together')).toBe(false);
  });
});

describe('HouseholdScreen setup step (signed in, no household)', () => {
  const account = { household: { user, current: null } };

  it('creates a household with the accepted agreement version', async () => {
    const { root } = await renderScreen(HouseholdScreen, account);
    await typeInto(root, 'e.g. Sharma family', 'Sharma family');
    await pressText(root, 'read and agree');
    await pressText(root, 'Create household');
    expect(householdActions.createHousehold).toHaveBeenCalledWith({
      name: 'Sharma family',
      consentVersion: AGREEMENT_VERSION,
    });
  });

  it('joins a household with an invite code', async () => {
    const { root } = await renderScreen(HouseholdScreen, account);
    await pressText(root, 'Join with code');
    await typeInto(root, 'Paste the code you were sent', 'abc123');
    await pressText(root, 'read and agree');
    await pressText(root, 'Join household');
    expect(householdActions.joinHousehold).toHaveBeenCalledWith({
      code: 'abc123',
      consentVersion: AGREEMENT_VERSION,
    });
  });

  it('shows the server’s refusal in plain words and lets them try again', async () => {
    householdActions.joinHousehold.mockImplementation(
      () => () => Promise.reject(Object.assign(new Error('Invalid or expired invite'), { status: 400 })),
    );
    const { root } = await renderScreen(HouseholdScreen, account);
    await pressText(root, 'Join with code');
    await typeInto(root, 'Paste the code you were sent', 'stale');
    await pressText(root, 'read and agree');
    await pressText(root, 'Join household');
    expect(hasText(root, 'Invalid or expired invite')).toBe(true);
    expect(hasText(root, 'Join household')).toBe(true); // not stuck on a spinner
  });

  it('shows the offline message when creating fails without a connection', async () => {
    householdActions.createHousehold.mockImplementation(
      () => () => Promise.reject(Object.assign(new Error('x'), { status: 0 })),
    );
    const { root } = await renderScreen(HouseholdScreen, account);
    await typeInto(root, 'e.g. Sharma family', 'Home');
    await pressText(root, 'read and agree');
    await pressText(root, 'Create household');
    expect(hasText(root, 'internet connection')).toBe(true);
  });

  it('signs out from this step and returns to the intro', async () => {
    householdActions.signOut.mockImplementation(() => (dispatch) => {
      dispatch(signedOut());
      return Promise.resolve();
    });
    const { root } = await renderScreen(HouseholdScreen, account);
    await pressText(root, 'Not you? Sign out');
    expect(householdActions.signOut).toHaveBeenCalled();
    expect(hasText(root, 'Continue with Google')).toBe(true);
  });
});

describe('HouseholdScreen with an account', () => {
  it('refreshes the household when opened', async () => {
    await renderScreen(HouseholdScreen, { household: { user, current: null } });
    expect(householdActions.restore).toHaveBeenCalledTimes(1);
  });

  it('shows a refresh failure instead of failing silently', async () => {
    householdActions.restore.mockImplementation(
      () => () => Promise.reject(Object.assign(new Error('boom'), { status: 500 })),
    );
    const { root } = await renderScreen(HouseholdScreen, { household: { user, current: null } });
    expect(hasText(root, 'server had a problem')).toBe(true);
  });
});
