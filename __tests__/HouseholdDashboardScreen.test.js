import { RefreshControl } from 'react-native';
import HouseholdDashboardScreen from '../src/Screens/HouseholdDashboardScreen';
import { householdActions } from '../src/services/householdApp';
import { act, allText, hasText, pressText, renderScreen } from '../jest/renderScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));
jest.mock('../src/services/householdApp', () => ({
  householdActions: { fetchDashboard: jest.fn() },
}));

const user = { id: 'u1', email: 'asha@example.com', name: 'Asha' };
const account = (role) => ({ household: { user, current: { id: 'h1', name: 'Sharma family', role, membershipId: 'm1' } } });

const earnerData = {
  period: { from: '2026-10-01', to: '2026-10-31', daysTotal: 31, daysElapsed: 12 },
  household: { id: 'h1', name: 'Sharma family', currencyFormat: 'indian' },
  me: { membershipId: 'm1', role: 'OWNER' },
  headline: { householdSpent: 5700000, sharedSpent: 3000000, privateSpent: 2700000, complete: true, sharedBudget: 3500000, sharedBudgetSpent: 3000000, mySpent: 1000000 },
  income: { total: 8000000, sources: [], leftOver: 2300000 },
  allowances: { given: 200000, total: 200000 },
  envelopes: [
    { id: 'e1', title: 'Groceries', icon: '🛒', colorKey: 'groceries', type: 'spending', scope: 'SHARED', budgetLimit: 1000000, spent: 900000, mine: false, owner: null },
    { id: 'e3', title: 'Pocket money', icon: '🎮', colorKey: 'fun', type: 'spending', scope: 'PERSONAL', budgetLimit: 500000, spent: 150000, mine: false, owner: 'Ravi' },
  ],
  members: [
    { membershipId: 'm1', name: 'Asha', role: 'OWNER', isMe: true, sharedSpent: 500000, privateSpent: 500000, itemisedSpent: 500000, currentLevel: 'FULL' },
    { membershipId: 'm2', name: 'Ravi', role: 'SPENDER', isMe: false, sharedSpent: 2500000, privateSpent: 2200000, itemisedSpent: 0, currentLevel: 'TOTAL' },
  ],
};

const spenderData = {
  ...earnerData,
  me: { membershipId: 'm2', role: 'SPENDER' },
  headline: { ...earnerData.headline, householdSpent: 3200000, privateSpent: 200000, complete: false, mySpent: 2700000 },
  income: null,
  allowances: { received: 300000 },
  envelopes: [earnerData.envelopes[0]],
  members: [
    { membershipId: 'm1', name: 'Asha', role: 'OWNER', isMe: false, sharedSpent: 500000, privateSpent: 0, itemisedSpent: 0, currentLevel: 'NONE' },
    { membershipId: 'm2', name: 'Ravi', role: 'SPENDER', isMe: true, sharedSpent: 2500000, privateSpent: 2200000, itemisedSpent: 2200000, currentLevel: 'FULL' },
  ],
};

const serve = (data) => householdActions.fetchDashboard.mockImplementation(() => () => Promise.resolve(data));

beforeEach(() => {
  jest.clearAllMocks();
  serve(earnerData);
});

describe('HouseholdDashboardScreen as an earner', () => {
  it('shows the household total, income, what is left and the cycle', async () => {
    const { root } = await renderScreen(HouseholdDashboardScreen, account('OWNER'));
    expect(hasText(root, 'Sharma family')).toBe(true);
    expect(hasText(root, '₹57,000')).toBe(true);
    expect(hasText(root, 'spent by your household this cycle')).toBe(true);
    expect(hasText(root, 'Left after spending: ₹23,000')).toBe(true);
    expect(hasText(root, '1 OCT – 31 OCT')).toBe(true);
    expect(hasText(root, 'Day 12 of 31')).toBe(true);
    expect(hasText(root, '₹2,000 set aside for spenders each cycle')).toBe(true);
  });

  it('shows shared and personal budgets with progress, and who is spending', async () => {
    const { root } = await renderScreen(HouseholdDashboardScreen, account('OWNER'));
    expect(hasText(root, 'Shared budgets')).toBe(true);
    expect(hasText(root, '₹9,000 of ₹10,000')).toBe(true);
    expect(hasText(root, 'Personal budgets')).toBe(true);
    expect(hasText(root, 'Ravi’s, shared with you')).toBe(true);
    expect(hasText(root, 'Who’s spending')).toBe(true);
    expect(hasText(root, 'Asha (you)')).toBe(true);
    expect(hasText(root, 'Total only')).toBe(true); // Ravi shared totals but no details
    expect(hasText(root, '₹47,000')).toBe(true);
  });

  it('asks the server for the current cycle once on open', async () => {
    await renderScreen(HouseholdDashboardScreen, account('OWNER'));
    expect(householdActions.fetchDashboard).toHaveBeenCalledTimes(1);
  });
});

describe('HouseholdDashboardScreen as a spender', () => {
  it('shows no income anywhere, and is honest that the total is partial', async () => {
    serve(spenderData);
    const { root } = await renderScreen(HouseholdDashboardScreen, account('SPENDER'));
    const text = allText(root).join(' | ');
    expect(text).not.toMatch(/Income|Left after|Spent beyond/);
    expect(hasText(root, 'spent that you can see this cycle')).toBe(true);
    expect(hasText(root, 'whatever others choose to show you')).toBe(true);
    expect(hasText(root, '₹3,000 set aside for you each cycle')).toBe(true);
  });

  it('does not claim another member has no personal spending when it simply can’t see it', async () => {
    serve(spenderData);
    const { root } = await renderScreen(HouseholdDashboardScreen, account('SPENDER'));
    expect(hasText(root, 'Personal spending is private')).toBe(true);
    expect(hasText(root, 'No personal spending')).toBe(false);
  });
});

describe('HouseholdDashboardScreen states', () => {
  it('shows a spinner while loading, then the content', async () => {
    let finish;
    householdActions.fetchDashboard.mockImplementation(() => () => new Promise((resolve) => { finish = resolve; }));
    const { root } = await renderScreen(HouseholdDashboardScreen, account('OWNER'));
    expect(hasText(root, '₹57,000')).toBe(false);
    await act(async () => finish(earnerData));
    expect(hasText(root, '₹57,000')).toBe(true);
  });

  it('shows a plain-language error with retry, and recovers', async () => {
    householdActions.fetchDashboard
      .mockImplementationOnce(() => () => Promise.reject(Object.assign(new Error('x'), { status: 0 })))
      .mockImplementation(() => () => Promise.resolve(earnerData));
    const { root } = await renderScreen(HouseholdDashboardScreen, account('OWNER'));
    expect(hasText(root, 'internet connection')).toBe(true);
    await pressText(root, 'Try again');
    expect(hasText(root, '₹57,000')).toBe(true);
    expect(hasText(root, 'internet connection')).toBe(false);
  });

  it('keeps showing the last dashboard if a refresh fails', async () => {
    const { root } = await renderScreen(HouseholdDashboardScreen, account('OWNER'));
    householdActions.fetchDashboard.mockImplementation(() => () => Promise.reject(Object.assign(new Error('x'), { status: 0 })));
    const refresh = root.findByType(RefreshControl);
    await act(async () => { await refresh.props.onRefresh(); });
    expect(hasText(root, 'internet connection')).toBe(true);
    expect(hasText(root, '₹57,000')).toBe(true);
  });

  it('refreshes on pull-down', async () => {
    const { root } = await renderScreen(HouseholdDashboardScreen, account('OWNER'));
    const refresh = root.findByType(RefreshControl);
    await act(async () => { await refresh.props.onRefresh(); });
    expect(householdActions.fetchDashboard).toHaveBeenCalledTimes(2);
  });

  it('explains an empty household and points to the settings', async () => {
    serve({
      ...earnerData,
      headline: { ...earnerData.headline, householdSpent: 0, sharedSpent: 0, privateSpent: 0, sharedBudget: 0, sharedBudgetSpent: 0, mySpent: 0 },
      envelopes: [],
      income: { total: 0, sources: [], leftOver: 0 },
      members: [earnerData.members[0]],
    });
    const { root } = await renderScreen(HouseholdDashboardScreen, account('OWNER'));
    expect(hasText(root, 'Nothing here yet')).toBe(true);
    await pressText(root, 'Open household settings');
    expect(mockNavigate).toHaveBeenCalledWith('Household');
  });

  it('opens household management from the header', async () => {
    const { root } = await renderScreen(HouseholdDashboardScreen, account('OWNER'));
    const manage = root.findAll((n) => n.props.accessibilityLabel === 'Manage household' && n.props.onPress)[0];
    await act(async () => manage.props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith('Household');
  });
});
