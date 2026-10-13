import AiSignInCard from '../src/Components/Household/AiSignInCard';
import AIAssistantScreen from '../src/Screens/AIAssistantScreen';
import AskSpendingScreen from '../src/Screens/AskSpendingScreen';
import { householdActions } from '../src/services/householdApp';
import { signedIn } from '../src/store/slices/householdSlice';
import { act, allText, hasText, pressText, renderScreen } from '../jest/renderScreen';
import { launchCamera } from 'react-native-image-picker';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));
jest.mock('../src/services/householdApp', () => ({
  householdActions: { signIn: jest.fn(), syncData: jest.fn(() => () => Promise.resolve(true)) },
  dataActions: {},
}));

const user = { id: 'u1', email: 'asha@example.com', name: 'Asha' };

beforeEach(() => {
  jest.clearAllMocks();
  householdActions.signIn.mockImplementation(() => (dispatch) => {
    dispatch(signedIn(user));
    return Promise.resolve(user);
  });
  launchCamera.mockResolvedValue({ didCancel: true });
});

describe('AiSignInCard', () => {
  it('asks people who are not signed in to sign in, and says honestly what happens to what they send', async () => {
    const { root } = await renderScreen(AiSignInCard);
    expect(hasText(root, 'Sign in to use AI')).toBe(true);
    expect(hasText(root, 'sent through our server to Google')).toBe(true);
    expect(hasText(root, 'we don’t store it')).toBe(true);
    expect(hasText(root, 'you don’t have to join a household')).toBe(true);
  });

  it('is not shown to someone already signed in', async () => {
    const { root } = await renderScreen(AiSignInCard, { household: { user, current: null } });
    expect(allText(root)).toEqual([]);
  });

  it('signs in, then goes away', async () => {
    const { root, store } = await renderScreen(AiSignInCard);
    await pressText(root, 'Continue with Google');
    expect(householdActions.signIn).toHaveBeenCalledTimes(1);
    expect(store.getState().household.user).toEqual(user);
    expect(allText(root)).toEqual([]);
  });

  it('does not start a household: signing in leaves them with no household', async () => {
    const { store, root } = await renderScreen(AiSignInCard);
    await pressText(root, 'Continue with Google');
    expect(store.getState().household.current).toBeNull();
  });

  it('says nothing when the person just closes the Google chooser', async () => {
    householdActions.signIn.mockImplementation(() => () => Promise.reject(Object.assign(new Error('c'), { reason: 'cancelled' })));
    const { root } = await renderScreen(AiSignInCard);
    await pressText(root, 'Continue with Google');
    expect(hasText(root, 'Continue with Google')).toBe(true);
    expect(allText(root).join(' ')).not.toMatch(/went wrong|reach the server/);
  });

  it('explains a failure in plain words and lets them retry', async () => {
    householdActions.signIn.mockImplementationOnce(() => () => Promise.reject(Object.assign(new Error('x'), { status: 0 })));
    const { root } = await renderScreen(AiSignInCard);
    await pressText(root, 'Continue with Google');
    expect(hasText(root, 'internet connection')).toBe(true);
    await pressText(root, 'Continue with Google');
    expect(allText(root)).toEqual([]);
  });

  it('ignores a second tap while signing in', async () => {
    let finish;
    householdActions.signIn.mockImplementation(() => () => new Promise((resolve) => { finish = resolve; }));
    const { root } = await renderScreen(AiSignInCard);
    await pressText(root, 'Continue with Google');
    // While signing in the label is a spinner, so there is nothing left to tap.
    await expect(pressText(root, 'Continue with Google')).rejects.toThrow(/No text containing/);
    expect(householdActions.signIn).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });
});

describe('where it appears', () => {
  it('on Quick Add and Ask Spending for people who are not signed in', async () => {
    const quick = await renderScreen(AIAssistantScreen);
    expect(hasText(quick.root, 'Sign in to use AI')).toBe(true);
    const ask = await renderScreen(AskSpendingScreen);
    expect(hasText(ask.root, 'Sign in to use AI')).toBe(true);
  });

  it('and not for signed-in people', async () => {
    const withAccount = { household: { user, current: null } };
    const quick = await renderScreen(AIAssistantScreen, withAccount);
    expect(hasText(quick.root, 'Sign in to use AI')).toBe(false);
    const ask = await renderScreen(AskSpendingScreen, withAccount);
    expect(hasText(ask.root, 'Sign in to use AI')).toBe(false);
  });
});
