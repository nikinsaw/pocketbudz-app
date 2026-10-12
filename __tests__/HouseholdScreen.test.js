import { Alert } from 'react-native';
import HouseholdScreen from '../src/Screens/HouseholdScreen';
import { householdActions } from '../src/services/householdApp';
import { AGREEMENT_VERSION } from '../src/data/householdAgreement';
import { householdSet, signedIn, signedOut } from '../src/store/slices/householdSlice';
import { act, allText, hasText, pressText, renderScreen, typeInto } from '../jest/renderScreen';

jest.mock('../src/services/householdApp', () => ({
  householdActions: {
    signIn: jest.fn(),
    restore: jest.fn(),
    signOut: jest.fn(),
    createHousehold: jest.fn(),
    joinHousehold: jest.fn(),
    fetchConsentVersion: jest.fn(),
    fetchMembers: jest.fn(),
    createInvite: jest.fn(),
    leaveHousehold: jest.fn(),
  },
}));

const user = { id: 'u1', email: 'asha@example.com', name: 'Asha' };
const home = { id: 'h1', name: 'Sharma family', role: 'OWNER', membershipId: 'm1' };
const members = [{ membershipId: 'm1', role: 'OWNER', name: 'Asha', joinedAt: '2026-10-01' }];
const noop = () => () => Promise.resolve();

beforeEach(() => {
  jest.clearAllMocks();
  householdActions.signIn.mockImplementation(noop);
  householdActions.restore.mockImplementation(noop);
  householdActions.signOut.mockImplementation(noop);
  householdActions.createHousehold.mockImplementation(noop);
  householdActions.joinHousehold.mockImplementation(noop);
  householdActions.fetchConsentVersion.mockImplementation(() => Promise.resolve(AGREEMENT_VERSION));
  householdActions.fetchMembers.mockImplementation(() => () => Promise.resolve(members));
  householdActions.leaveHousehold.mockImplementation(noop);
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

describe('HouseholdScreen household step (in a household)', () => {
  const inHousehold = { household: { user, current: home } };

  // Taps a button of the confirmation dialog the screen opened.
  const tapDialog = async (label) => {
    const buttons = Alert.alert.mock.calls[0][2];
    const button = buttons.find((b) => b.text === label);
    await act(async () => {
      await button.onPress();
    });
  };

  beforeEach(() => jest.spyOn(Alert, 'alert').mockImplementation(() => {}));
  afterEach(() => Alert.alert.mockRestore());

  it('shows the household and its members, loading them once', async () => {
    const { root } = await renderScreen(HouseholdScreen, inHousehold);
    expect(hasText(root, 'Sharma family')).toBe(true);
    expect(hasText(root, 'Asha (you)')).toBe(true);
    expect(householdActions.fetchMembers).toHaveBeenCalledTimes(1);
  });

  it('asks before leaving and says what happens to their data', async () => {
    const { root } = await renderScreen(HouseholdScreen, inHousehold);
    await pressText(root, 'Leave household');
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = Alert.alert.mock.calls[0];
    expect(title).toBe('Leave household?');
    expect(message).toMatch(/anonymous totals/);
    expect(message).toMatch(/personal envelopes, income entries and sharing choices are deleted/);
    expect(buttons.find((b) => b.text === 'Leave').style).toBe('destructive');
    expect(householdActions.leaveHousehold).not.toHaveBeenCalled();
  });

  it('does nothing when they cancel the dialog', async () => {
    const { root } = await renderScreen(HouseholdScreen, inHousehold);
    await pressText(root, 'Leave household');
    expect(Alert.alert.mock.calls[0][2].find((b) => b.text === 'Cancel').onPress).toBeUndefined();
    expect(householdActions.leaveHousehold).not.toHaveBeenCalled();
  });

  it('leaves once confirmed and returns to the create/join step', async () => {
    householdActions.leaveHousehold.mockImplementation(() => (dispatch) => {
      dispatch(householdSet(null));
      return Promise.resolve();
    });
    const { root } = await renderScreen(HouseholdScreen, inHousehold);
    await pressText(root, 'Leave household');
    await tapDialog('Leave');
    expect(householdActions.leaveHousehold).toHaveBeenCalledTimes(1);
    expect(hasText(root, 'Set up your household')).toBe(true);
  });

  it('shows why leaving was refused and stays in the household', async () => {
    householdActions.leaveHousehold.mockImplementation(
      () => () => Promise.reject(Object.assign(new Error('Transfer ownership before leaving'), { status: 409 })),
    );
    const { root } = await renderScreen(HouseholdScreen, inHousehold);
    await pressText(root, 'Leave household');
    await tapDialog('Leave');
    expect(hasText(root, 'Transfer ownership before leaving')).toBe(true);
    expect(hasText(root, 'Sharma family')).toBe(true);
  });

  it('signs out from the household step', async () => {
    householdActions.signOut.mockImplementation(() => (dispatch) => {
      dispatch(signedOut());
      return Promise.resolve();
    });
    const { root } = await renderScreen(HouseholdScreen, inHousehold);
    await pressText(root, 'Sign out');
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
