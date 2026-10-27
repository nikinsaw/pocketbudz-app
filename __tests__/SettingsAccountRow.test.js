import SettingsScreen from '../src/Screens/SettingsScreen';
import { hasText, pressText, renderScreen } from '../jest/renderScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

const user = { id: 'u1', email: 'asha@example.com', name: 'Asha' };
const home = { id: 'h1', name: 'Sharma family', role: 'OWNER', membershipId: 'm1' };

beforeEach(() => jest.clearAllMocks());

describe('Settings: Account & data', () => {
  it('is hidden in solo mode - there is no account to manage', async () => {
    const { root } = await renderScreen(SettingsScreen);
    expect(hasText(root, 'Household mode')).toBe(true);
    expect(hasText(root, 'Account & data')).toBe(false);
  });

  it('appears once signed in, even before joining a household', async () => {
    const { root } = await renderScreen(SettingsScreen, { household: { user, current: null } });
    expect(hasText(root, 'Account & data')).toBe(true);
  });

  it('appears in a household and opens the Account screen', async () => {
    const { root } = await renderScreen(SettingsScreen, { household: { user, current: home } });
    await pressText(root, 'Account & data');
    expect(mockNavigate).toHaveBeenCalledWith('Account');
  });
});
