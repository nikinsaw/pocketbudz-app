import { Alert } from 'react-native';
import AllTransactionsScreen from '../src/Screens/AllTransactionsScreen';
import { dataActions } from '../src/services/householdApp';
import { getActivityDisplay } from '../src/utils/transactionDisplay';
import { act, allText, buttonWithText, hasText, isDisabled, pressText, renderScreen } from '../jest/renderScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));
jest.mock('../src/services/householdApp', () => ({
  dataActions: { deleteTransactions: jest.fn(), mergeTransactions: jest.fn() },
  householdActions: { syncData: jest.fn(() => () => Promise.resolve(true)) },
}));

const user = { id: 'u1', email: 'asha@example.com', name: 'Asha' };
const apiError = (status) => Object.assign(new Error('x'), { status });
const ok = () => () => Promise.resolve();

const soloTx = (id, merchant, extra = {}) => ({ id, merchant, category: 'Food', amount: 100, date: '2026-10-02', icon: '🍕', colorKey: 'food', ...extra });
const phone = { transactions: [soloTx('s1', 'Cafe'), soloTx('s2', 'Cafe'), soloTx('s3', 'Bakery', { date: '2026-09-15' })] };

const serverTx = (id, merchant, mine, extra = {}) => ({
  id, merchant, category: 'Food', amount: 10000, date: '2026-10-02', envelopeId: null, mine,
  member: { membershipId: mine ? 'm1' : 'm2', name: mine ? 'Asha' : 'Ravi' }, ...extra,
});
const household = {
  household: { user, current: { id: 'h1', name: 'Home', role: 'EARNER', membershipId: 'm1' } },
  profile: { categories: [{ label: 'Food', icon: '🍕', colorKey: 'food' }] },
  householdData: { loadedFor: 'h1', transactions: [serverTx('a', 'My lunch', true), serverTx('b', 'Their lunch', false), serverTx('c', 'My tea', true, { merchant: 'My lunch' })] },
};

beforeEach(() => {
  jest.clearAllMocks();
  // The list batches its rendering on timers; run them inside act so they don't fire later.
  jest.useFakeTimers();
  dataActions.deleteTransactions.mockImplementation(ok);
  dataActions.mergeTransactions.mockImplementation(ok);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(async () => {
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
  Alert.alert.mockRestore();
});

const confirm = async (label) => {
  await act(async () => {
    await Alert.alert.mock.calls.at(-1)[2].find((b) => b.text === label).onPress();
  });
};

describe('getActivityDisplay', () => {
  const colors = {};
  it('is unchanged for solo transactions', () => {
    expect(getActivityDisplay(soloTx('s1', 'Cafe'), colors).subtitle).not.toContain('·');
  });

  it('names who spent it, but only for other people’s spending', () => {
    expect(getActivityDisplay({ ...soloTx('x', 'Lunch'), mine: false, memberName: 'Ravi' }, colors).subtitle).toMatch(/ · Ravi$/);
    expect(getActivityDisplay({ ...soloTx('x', 'Lunch'), mine: true, memberName: 'Asha' }, colors).subtitle).not.toContain('Asha');
  });
});

describe('solo mode', () => {
  it('lists the phone’s transactions by month with no household extras', async () => {
    const { root } = await renderScreen(AllTransactionsScreen, { phone });
    expect(hasText(root, 'October 2026')).toBe(true);
    expect(hasText(root, 'September 2026')).toBe(true);
    expect(hasText(root, 'Bakery')).toBe(true);
    expect(allText(root).join(' ')).not.toMatch(/Loading your household|Includes spending added by others/);
  });

  it('deletes the selected rows through the data action', async () => {
    const { root } = await renderScreen(AllTransactionsScreen, { phone });
    await pressText(root, 'Select');
    await pressText(root, 'Bakery');
    await pressText(root, 'Delete 1 selected');
    await confirm('Delete');
    expect(dataActions.deleteTransactions).toHaveBeenCalledWith(['s3']);
  });

  it('offers to merge same-day same-merchant rows, and merges them', async () => {
    const { root } = await renderScreen(AllTransactionsScreen, { phone });
    await pressText(root, 'Select');
    await pressText(root, 'Select All');
    expect(hasText(root, 'Merge')).toBe(false); // Bakery is a different merchant/day
    await pressText(root, 'Deselect All');
    const cafes = root.findAll((n) => n.type === 'Text' && n.props.children === 'Cafe');
    expect(cafes).toHaveLength(2);
    await act(async () => {
      cafes.forEach((c) => {
        let node = c;
        while (node && typeof node.props.onPress !== 'function') node = node.parent;
        node.props.onPress();
      });
    });
    await pressText(root, 'Merge 2 into one');
    await confirm('Merge');
    expect(dataActions.mergeTransactions).toHaveBeenCalledWith(expect.objectContaining({ ids: ['s1', 's2'], merchant: 'Cafe', amount: 200 }));
  });
});

describe('household mode', () => {
  it('shows the household’s transactions with who spent others’ ones', async () => {
    const { root } = await renderScreen(AllTransactionsScreen, household);
    expect(hasText(root, 'Their lunch')).toBe(true);
    expect(allText(root).some((t) => /· Ravi$/.test(t))).toBe(true);
    expect(allText(root).some((t) => t.includes('Asha'))).toBe(false); // your own rows aren't labelled
  });

  it('lets you delete your own selected spending', async () => {
    const { root } = await renderScreen(AllTransactionsScreen, household);
    await pressText(root, 'Select');
    await pressText(root, 'My lunch');
    expect(hasText(root, 'Includes spending added by others')).toBe(false);
    await pressText(root, 'selected');
    await confirm('Delete');
    expect(dataActions.deleteTransactions).toHaveBeenCalledTimes(1);
  });

  it('blocks deleting and merging once someone else’s spending is in the selection, and says why', async () => {
    const { root } = await renderScreen(AllTransactionsScreen, household);
    await pressText(root, 'Select');
    await pressText(root, 'Select All');
    expect(hasText(root, 'Includes spending added by others. You can only delete or merge your own.')).toBe(true);
    expect(isDisabled(buttonWithText(root, 'Delete 3 selected'))).toBe(true);
    expect(hasText(root, 'Merge')).toBe(false);
    await pressText(root, 'Delete 3 selected');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(dataActions.deleteTransactions).not.toHaveBeenCalled();
  });

  it('tells you when a delete only partly worked, and leaves selection mode', async () => {
    dataActions.deleteTransactions.mockImplementation(() => () => Promise.reject(Object.assign(new Error('1 of 2 couldn’t be deleted.'), { status: 400 })));
    const { root } = await renderScreen(AllTransactionsScreen, household);
    await pressText(root, 'Select');
    await pressText(root, 'My lunch');
    await pressText(root, 'selected');
    await confirm('Delete');
    expect(Alert.alert).toHaveBeenLastCalledWith('Couldn’t delete everything', '1 of 2 couldn’t be deleted.');
    expect(hasText(root, 'Select All')).toBe(false); // back to the normal list
  });

  it('keeps selection mode open when a merge fails, so nothing is lost', async () => {
    dataActions.mergeTransactions.mockImplementation(() => () => Promise.reject(apiError(0)));
    const { root } = await renderScreen(AllTransactionsScreen, household);
    await pressText(root, 'Select');
    const mine = root.findAll((n) => n.type === 'Text' && n.props.children === 'My lunch');
    await act(async () => {
      mine.forEach((c) => {
        let node = c;
        while (node && typeof node.props.onPress !== 'function') node = node.parent;
        node.props.onPress();
      });
    });
    await pressText(root, 'Merge 2 into one');
    await confirm('Merge');
    expect(Alert.alert).toHaveBeenLastCalledWith('Couldn’t merge', expect.stringMatching(/internet connection/));
    expect(hasText(root, 'Select All')).toBe(true);
  });
});
