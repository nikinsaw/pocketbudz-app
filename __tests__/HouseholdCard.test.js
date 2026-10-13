import HouseholdCard from '../src/Components/Household/HouseholdCard';
import { allText, hasText, pressText, renderScreen } from '../jest/renderScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

const user = { id: 'u1', email: 'asha@example.com', name: 'Asha' };
const home = { id: 'h1', name: 'Sharma family', role: 'EARNER', membershipId: 'm1' };

beforeEach(() => mockNavigate.mockClear());

describe('HouseholdCard', () => {
  it('invites solo users to try household mode', async () => {
    const { root } = await renderScreen(HouseholdCard);
    expect(hasText(root, 'Budget together with family')).toBe(true);
    expect(hasText(root, 'stays on this phone')).toBe(true);
  });

  it('opens the Household screen when tapped', async () => {
    const { root } = await renderScreen(HouseholdCard);
    await pressText(root, 'Budget together with family');
    expect(mockNavigate).toHaveBeenCalledWith('Household');
  });

  it('can be dismissed without opening the screen, and stays dismissed', async () => {
    const { root, store } = await renderScreen(HouseholdCard);
    const dismiss = root.findAll((n) => n.props.accessibilityLabel === 'Dismiss' && n.props.onPress)[0];
    await require('react-test-renderer').act(async () => dismiss.props.onPress());
    expect(store.getState().settings.householdPromoDismissed).toBe(true);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(allText(root)).toEqual([]);
  });

  it('stays hidden for solo users who dismissed it earlier', async () => {
    const { root } = await renderScreen(HouseholdCard, { settings: { householdPromoDismissed: true } });
    expect(allText(root)).toEqual([]);
  });

  it('offers signed-in users without a household the same optional invitation, which they can dismiss', async () => {
    const { root, store } = await renderScreen(HouseholdCard, { household: { user, current: null } });
    expect(hasText(root, 'Create a household or join one with an invite code. Optional.')).toBe(true);
    expect(hasText(root, '✕')).toBe(true);
    const dismiss = root.findAll((n) => n.props.accessibilityLabel === 'Dismiss' && n.props.onPress)[0];
    await require('react-test-renderer').act(async () => dismiss.props.onPress());
    expect(store.getState().settings.householdPromoDismissed).toBe(true);
    expect(allText(root)).toEqual([]);
  });

  it('stays hidden for a signed-in person who dismissed it (e.g. they signed in only for AI)', async () => {
    const { root } = await renderScreen(HouseholdCard, {
      household: { user, current: null },
      settings: { householdPromoDismissed: true },
    });
    expect(allText(root)).toEqual([]);
  });

  it('never hides the card once they are in a household, even if an old dismissal exists', async () => {
    const { root } = await renderScreen(HouseholdCard, {
      household: { user, current: home },
      settings: { householdPromoDismissed: true },
    });
    expect(hasText(root, 'Sharma family')).toBe(true);
    expect(hasText(root, '✕')).toBe(false);
  });

  it('shows the household and the member’s role once in one, and opens its dashboard', async () => {
    const { root } = await renderScreen(HouseholdCard, { household: { user, current: home } });
    expect(hasText(root, 'Sharma family')).toBe(true);
    expect(hasText(root, 'Earner')).toBe(true);
    expect(hasText(root, 'budget')).toBe(true);
    await pressText(root, 'Sharma family');
    expect(mockNavigate).toHaveBeenCalledWith('HouseholdDashboard');
    expect(mockNavigate).not.toHaveBeenCalledWith('Household');
  });

  it('sends people who have not finished setup to the Household screen, not an empty dashboard', async () => {
    const { root } = await renderScreen(HouseholdCard, { household: { user, current: null } });
    await pressText(root, 'Budget together with family');
    expect(mockNavigate).toHaveBeenCalledWith('Household');
  });
});
