import HomeScreen from '../src/Screens/HomeScreen';
import { syncSucceeded } from '../src/store/slices/householdDataSlice';
import { act, allText, hasText, renderScreen } from '../jest/renderScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));
jest.mock('../src/services/householdApp', () => ({
  householdActions: { syncData: jest.fn(() => () => Promise.resolve(true)) },
}));

const user = { id: 'u1', email: 'asha@example.com', name: 'Asha' };
const home = { id: 'h1', name: 'Sharma family', role: 'OWNER', membershipId: 'm1' };
const today = new Date();
const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

const phone = {
  envelopes: [{ id: 'pe', categoryKey: 'food', icon: '🍕', title: 'Phone Food', colorKey: 'food', type: 'spending', budgetLimit: 5000 }],
  transactions: [{ id: 'pt', merchant: 'Phone Cafe', category: 'Phone Food', amount: 120, date: isoToday, icon: '🍕', colorKey: 'food' }],
  monthlyIncome: 50000,
};

const serverData = {
  loadedFor: 'h1',
  envelopes: [{ id: 'e1', scope: 'SHARED', ownerId: null, categoryKey: 'g', icon: '🛒', title: 'Household Groceries', colorKey: 'groceries', type: 'spending', budgetLimit: 1000000 }],
  transactions: [{ id: 't1', merchant: 'Server Mart', category: 'Household Groceries', amount: 45000, date: isoToday, envelopeId: 'e1', mine: true, member: { membershipId: 'm1', name: 'Asha' } }],
  income: { total: 8000000, sources: [{ id: 'i1', label: 'Salary', amount: 8000000, mine: true, earner: 'Asha' }] },
  allowanceReceived: 0,
  cycleStartDay: 1,
};

describe('Home reads from the right place', () => {
  it('solo mode shows the phone’s own data, exactly as before', async () => {
    const { root } = await renderScreen(HomeScreen, { phone });
    expect(hasText(root, 'Phone Food')).toBe(true);
    expect(hasText(root, 'Phone Cafe')).toBe(true);
    expect(allText(root).join(' ')).not.toMatch(/Server Mart|Household Groceries|Loading your household/);
  });

  it('solo mode ignores any server data left in the store', async () => {
    const { root, store } = await renderScreen(HomeScreen, { phone });
    await act(async () => {
      store.dispatch(syncSucceeded(serverData));
    });
    expect(hasText(root, 'Server Mart')).toBe(false);
    expect(hasText(root, 'Phone Cafe')).toBe(true);
  });

  it('household mode shows the household’s data and none of the phone’s', async () => {
    const { root, store } = await renderScreen(HomeScreen, { household: { user, current: home }, phone });
    await act(async () => {
      store.dispatch(syncSucceeded(serverData));
    });
    expect(hasText(root, 'Household Groceries')).toBe(true);
    expect(hasText(root, 'Server Mart')).toBe(true);
    expect(allText(root).join(' ')).not.toMatch(/Phone Food|Phone Cafe/);
  });

  it('household mode shows a loading message before the first load, and never falls back to the phone’s data', async () => {
    const { root } = await renderScreen(HomeScreen, { household: { user, current: home }, phone });
    expect(hasText(root, 'Loading your household')).toBe(true);
    expect(allText(root).join(' ')).not.toMatch(/Phone Food|Phone Cafe/);
  });

  it('household mode shows the earner’s own income-based cards from the server income', async () => {
    const { root, store } = await renderScreen(HomeScreen, { household: { user, current: home }, phone });
    await act(async () => {
      store.dispatch(syncSucceeded(serverData));
    });
    // The phone's income (₹50,000) must not be used; the earner's own server income is ₹80,000.
    expect(allText(root).join(' ')).not.toContain('50,000');
  });

  it('after leaving, the phone’s data is back and untouched', async () => {
    const { root, store } = await renderScreen(HomeScreen, { household: { user, current: home }, phone });
    await act(async () => {
      store.dispatch(syncSucceeded(serverData));
    });
    expect(hasText(root, 'Server Mart')).toBe(true);
    await act(async () => {
      store.dispatch({ type: 'household/householdSet', payload: null });
    });
    expect(hasText(root, 'Phone Cafe')).toBe(true);
    expect(hasText(root, 'Server Mart')).toBe(false);
  });
});
