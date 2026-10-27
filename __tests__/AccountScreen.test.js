import { Alert } from 'react-native';
import AccountScreen from '../src/Screens/AccountScreen';
import { householdActions } from '../src/services/householdApp';
import { saveAccountData } from '../src/services/exportAccountData';
import { signedOut } from '../src/store/slices/householdSlice';
import {
  act,
  allText,
  buttonWithText,
  hasText,
  isDisabled,
  pressText,
  renderScreen,
  typeInto,
} from '../jest/renderScreen';

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack }),
}));

jest.mock('../src/services/householdApp', () => ({
  householdActions: { exportAccount: jest.fn(), deleteAccount: jest.fn() },
}));

jest.mock('../src/services/exportAccountData', () => ({ saveAccountData: jest.fn() }));

const user = { id: 'u1', email: 'asha@example.com', name: 'Asha' };
const signedInState = { household: { user, current: null } };
const PLACEHOLDER = 'Type DELETE';

const exportData = { account: { email: 'asha@example.com' }, households: [] };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  householdActions.exportAccount.mockImplementation(() => () => Promise.resolve(exportData));
  householdActions.deleteAccount.mockImplementation(() => (dispatch) => {
    dispatch(signedOut());
    return Promise.resolve();
  });
  saveAccountData.mockResolvedValue({ success: true });
});
afterEach(() => Alert.alert.mockRestore());

// Taps a button of the confirmation dialog the screen opened.
const tapDialog = async (label) => {
  const button = Alert.alert.mock.calls.at(-1)[2].find((b) => b.text === label);
  await act(async () => {
    await button.onPress();
  });
};

describe('AccountScreen', () => {
  it('shows who is signed in and both options', async () => {
    const { root } = await renderScreen(AccountScreen, signedInState);
    expect(hasText(root, 'Asha')).toBe(true);
    expect(hasText(root, 'asha@example.com')).toBe(true);
    expect(hasText(root, 'Download my data')).toBe(true);
    expect(hasText(root, 'Delete my account')).toBe(true);
  });

  it('says so when nobody is signed in, and offers nothing destructive', async () => {
    const { root } = await renderScreen(AccountScreen);
    expect(hasText(root, 'not signed in')).toBe(true);
    expect(hasText(root, 'Delete my account')).toBe(false);
  });

  it('makes no network call just by opening', async () => {
    await renderScreen(AccountScreen, signedInState);
    expect(householdActions.exportAccount).not.toHaveBeenCalled();
    expect(householdActions.deleteAccount).not.toHaveBeenCalled();
  });
});

describe('downloading your data', () => {
  it('fetches the export and saves it as a file', async () => {
    const { root } = await renderScreen(AccountScreen, signedInState);
    await pressText(root, 'Download my data');
    expect(householdActions.exportAccount).toHaveBeenCalledTimes(1);
    expect(saveAccountData).toHaveBeenCalledWith(exportData);
    expect(hasText(root, 'Saved.')).toBe(true);
  });

  it('stays quiet when the person cancels the Save dialog', async () => {
    saveAccountData.mockResolvedValue({ success: false, cancelled: true });
    const { root } = await renderScreen(AccountScreen, signedInState);
    await pressText(root, 'Download my data');
    expect(hasText(root, 'Saved.')).toBe(false);
    expect(hasText(root, 'Couldn')).toBe(false);
  });

  it('shows a file problem', async () => {
    saveAccountData.mockResolvedValue({ success: false, error: 'Couldn’t save the file — try again.' });
    const { root } = await renderScreen(AccountScreen, signedInState);
    await pressText(root, 'Download my data');
    expect(hasText(root, 'Couldn’t save the file')).toBe(true);
  });

  it('shows a server problem and does not try to save anything', async () => {
    householdActions.exportAccount.mockImplementation(
      () => () => Promise.reject(Object.assign(new Error('x'), { status: 0 })),
    );
    const { root } = await renderScreen(AccountScreen, signedInState);
    await pressText(root, 'Download my data');
    expect(hasText(root, 'Can’t reach the server')).toBe(true);
    expect(saveAccountData).not.toHaveBeenCalled();
  });
});

describe('deleting your account', () => {
  it('keeps the delete button disabled until DELETE is typed exactly', async () => {
    const { root } = await renderScreen(AccountScreen, signedInState);
    expect(isDisabled(buttonWithText(root, 'Delete my account'))).toBe(true);
    for (const wrong of ['delet', 'Delete me', 'DELETED', '']) {
      await typeInto(root, PLACEHOLDER, wrong);
      expect(isDisabled(buttonWithText(root, 'Delete my account'))).toBe(true);
    }
    await typeInto(root, PLACEHOLDER, 'DELETE');
    expect(isDisabled(buttonWithText(root, 'Delete my account'))).toBe(false);
  });

  it('does nothing when the disabled button is pressed', async () => {
    const { root } = await renderScreen(AccountScreen, signedInState);
    await pressText(root, 'Delete my account');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(householdActions.deleteAccount).not.toHaveBeenCalled();
  });

  it('asks one more time, and deletes nothing if the person backs out', async () => {
    const { root } = await renderScreen(AccountScreen, signedInState);
    await typeInto(root, PLACEHOLDER, 'DELETE');
    await pressText(root, 'Delete my account');
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [title, , buttons] = Alert.alert.mock.calls[0];
    expect(title).toBe('Delete your account?');
    expect(buttons.find((b) => b.text === 'Delete account').style).toBe('destructive');
    expect(buttons.find((b) => b.text === 'Cancel').onPress).toBeUndefined();
    expect(householdActions.deleteAccount).not.toHaveBeenCalled();
  });

  it('deletes once confirmed, tells them, and leaves the screen', async () => {
    const { root, store } = await renderScreen(AccountScreen, signedInState);
    await typeInto(root, PLACEHOLDER, 'DELETE');
    await pressText(root, 'Delete my account');
    await tapDialog('Delete account');
    expect(householdActions.deleteAccount).toHaveBeenCalledTimes(1);
    expect(store.getState().household.user).toBeNull();
    expect(Alert.alert.mock.calls.at(-1)[0]).toBe('Account deleted');
    expect(Alert.alert.mock.calls.at(-1)[1]).toContain('budget on this phone is still here');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('shows why it was refused and stays signed in', async () => {
    householdActions.deleteAccount.mockImplementation(
      () => () =>
        Promise.reject(
          Object.assign(new Error('Transfer ownership of your household before deleting your account'), {
            status: 409,
          }),
        ),
    );
    const { root, store } = await renderScreen(AccountScreen, signedInState);
    await typeInto(root, PLACEHOLDER, 'DELETE');
    await pressText(root, 'Delete my account');
    await tapDialog('Delete account');
    expect(hasText(root, 'Transfer ownership of your household')).toBe(true);
    expect(store.getState().household.user).toEqual(user);
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(1); // only the confirmation, no "deleted" message
    // And they can try again.
    expect(isDisabled(buttonWithText(root, 'Delete my account'))).toBe(false);
  });

  it('explains what happens to a household, in plain words', async () => {
    const { root } = await renderScreen(AccountScreen, signedInState);
    const text = allText(root).join(' ');
    expect(text).toContain('anonymous totals');
    expect(text).toContain('hand over ownership first');
    expect(text).toContain('budget saved on this phone isn’t touched');
  });
});
