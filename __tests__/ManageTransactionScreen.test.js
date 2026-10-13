import { Alert } from 'react-native';
import ManageTransactionScreen from '../src/Screens/ManageTransactionScreen';
import { dataActions } from '../src/services/householdApp';
import { act, hasText, pressText, renderScreen, typeInto } from '../jest/renderScreen';

const mockGoBack = jest.fn();
let mockRouteParams = {};
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));
jest.mock('../src/services/householdApp', () => ({
  dataActions: {
    addTransaction: jest.fn(),
    updateTransaction: jest.fn(),
    deleteTransaction: jest.fn(),
  },
  householdActions: {},
}));

const user = { id: 'u1', email: 'asha@example.com', name: 'Asha' };
const home = { id: 'h1', name: 'Home', role: 'EARNER', membershipId: 'm1' };
const categories = [
  { key: 'food', label: 'Food', icon: '🍕', colorKey: 'food' },
  { key: 'fun', label: 'Fun', icon: '🎮', colorKey: 'fun' },
];
const ok = () => () => Promise.resolve();
const apiError = (status, message = 'x') => Object.assign(new Error(message), { status });

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = {};
  Object.values(dataActions).forEach((action) => action.mockImplementation(ok));
});

async function fillAndSubmit(root, { category = 'Food', merchant = 'Blinkit', amount = '120' } = {}) {
  await pressText(root, category);
  await typeInto(root, 'e.g. Blinkit', merchant);
  await typeInto(root, '0', amount);
  await pressText(root, 'Add Transaction');
}

describe('adding a transaction', () => {
  it('saves through the data action and closes', async () => {
    const { root } = await renderScreen(ManageTransactionScreen, { profile: { categories } });
    await fillAndSubmit(root);
    expect(dataActions.addTransaction).toHaveBeenCalledTimes(1);
    expect(dataActions.addTransaction.mock.calls[0][0]).toMatchObject({ merchant: 'Blinkit', category: 'Food', amount: 120 });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('adds up an amount typed as a sum', async () => {
    const { root } = await renderScreen(ManageTransactionScreen, { profile: { categories } });
    await fillAndSubmit(root, { amount: '120+300' });
    expect(dataActions.addTransaction.mock.calls[0][0].amount).toBe(420);
  });

  it('asks for what is missing and saves nothing', async () => {
    const { root } = await renderScreen(ManageTransactionScreen, { profile: { categories } });
    await pressText(root, 'Add Transaction');
    expect(hasText(root, 'Pick a category')).toBe(true);
    await pressText(root, 'Food');
    await pressText(root, 'Add Transaction');
    expect(hasText(root, 'Enter who you paid')).toBe(true);
    await typeInto(root, 'e.g. Blinkit', 'Shop');
    await pressText(root, 'Add Transaction');
    expect(hasText(root, 'greater than zero')).toBe(true);
    expect(dataActions.addTransaction).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('stays on the form, keeps what was typed and shows why when saving fails', async () => {
    dataActions.addTransaction.mockImplementation(() => () => Promise.reject(apiError(0)));
    const { root } = await renderScreen(ManageTransactionScreen, { profile: { categories } });
    await fillAndSubmit(root);
    expect(hasText(root, 'internet connection')).toBe(true);
    expect(mockGoBack).not.toHaveBeenCalled();
    // ...and they can simply try again.
    dataActions.addTransaction.mockImplementation(ok);
    await pressText(root, 'Add Transaction');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(dataActions.addTransaction).toHaveBeenCalledTimes(2);
  });

  it('shows the server’s own wording for a refusal', async () => {
    dataActions.addTransaction.mockImplementation(() => () => Promise.reject(apiError(400, 'Enter an amount between ₹0.01 and ₹2,00,00,000.')));
    const { root } = await renderScreen(ManageTransactionScreen, { profile: { categories } });
    await fillAndSubmit(root);
    expect(hasText(root, 'Enter an amount between')).toBe(true);
  });

  it('ignores a second tap while the first save is still running', async () => {
    let finish;
    dataActions.addTransaction.mockImplementation(() => () => new Promise((resolve) => { finish = resolve; }));
    const { root } = await renderScreen(ManageTransactionScreen, { profile: { categories } });
    await fillAndSubmit(root);
    expect(hasText(root, 'Saving')).toBe(true);
    await pressText(root, 'Saving');
    expect(dataActions.addTransaction).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('does not save in "local only" review mode, but still hands the values back', async () => {
    const onSaved = jest.fn();
    mockRouteParams = { localOnly: true, onSaved, draftTransaction: { merchant: 'Draft', category: 'Food', amount: 50, date: '2026-10-05' } };
    const { root } = await renderScreen(ManageTransactionScreen, { profile: { categories } });
    await pressText(root, 'Save');
    expect(dataActions.addTransaction).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ merchant: 'Draft', amount: 50 }));
  });
});

describe('household: shared budgets are visible to everyone', () => {
  const envelope = (over) => ({ id: 'e', scope: 'SHARED', ownerId: null, categoryKey: 'k', icon: 'x', title: 'Food', colorKey: 'c', type: 'spending', budgetLimit: 1, ...over });
  const household = { user, current: home };

  it('warns before saving spending that will land in a shared budget', async () => {
    const { root } = await renderScreen(ManageTransactionScreen, { household, profile: { categories }, householdData: { loadedFor: 'h1', envelopes: [envelope({})] } });
    expect(hasText(root, 'shared')).toBe(false);
    await pressText(root, 'Food');
    expect(hasText(root, 'goes to the shared “Food” budget')).toBe(true);
    expect(hasText(root, 'everyone in your household can see it')).toBe(true);
  });

  it('says nothing when a personal budget of the same name keeps it private', async () => {
    const { root } = await renderScreen(ManageTransactionScreen, {
      household,
      profile: { categories },
      householdData: { loadedFor: 'h1', envelopes: [envelope({}), envelope({ id: 'p', scope: 'PERSONAL', ownerId: 'm1' })] },
    });
    await pressText(root, 'Food');
    expect(hasText(root, 'everyone in your household')).toBe(false);
  });

  it('says nothing for a category with no shared budget, and never in solo mode', async () => {
    const hh = await renderScreen(ManageTransactionScreen, { household, profile: { categories }, householdData: { loadedFor: 'h1', envelopes: [envelope({})] } });
    await pressText(hh.root, 'Fun');
    expect(hasText(hh.root, 'everyone in your household')).toBe(false);
    const solo = await renderScreen(ManageTransactionScreen, { profile: { categories }, phone: { envelopes: [{ id: 'e', title: 'Food', budgetLimit: 1 }] } });
    await pressText(solo.root, 'Food');
    expect(hasText(solo.root, 'everyone in your household')).toBe(false);
  });
});

describe('editing and deleting', () => {
  const mine = { id: 't1', merchant: 'Cafe', category: 'Food', amount: 12000, date: '2026-10-02', envelopeId: null, mine: true, member: { membershipId: 'm1', name: 'Asha' } };
  const theirs = { ...mine, id: 't2', merchant: 'Their lunch', mine: false, member: { membershipId: 'm2', name: 'Ravi' } };
  const seeded = { household: { user, current: home }, profile: { categories }, householdData: { loadedFor: 'h1', envelopes: [], transactions: [mine, theirs] } };

  beforeEach(() => jest.spyOn(Alert, 'alert').mockImplementation(() => {}));
  afterEach(() => Alert.alert.mockRestore());

  it('updates my own transaction', async () => {
    mockRouteParams = { transactionId: 't1' };
    const { root } = await renderScreen(ManageTransactionScreen, seeded);
    await typeInto(root, '0', '150');
    await pressText(root, 'Save Changes');
    expect(dataActions.updateTransaction.mock.calls[0][0]).toMatchObject({ id: 't1', merchant: 'Cafe', amount: 150 });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('shows someone else’s spending read-only: no save or delete, and says who can change it', async () => {
    mockRouteParams = { transactionId: 't2' };
    const { root } = await renderScreen(ManageTransactionScreen, seeded);
    expect(hasText(root, 'Ravi added this, so only they can change it')).toBe(true);
    expect(hasText(root, 'Save Changes')).toBe(false);
    expect(hasText(root, 'Delete Transaction')).toBe(false);
  });

  it('asks before deleting, then deletes and closes', async () => {
    mockRouteParams = { transactionId: 't1' };
    const { root } = await renderScreen(ManageTransactionScreen, seeded);
    await pressText(root, 'Delete Transaction');
    expect(dataActions.deleteTransaction).not.toHaveBeenCalled();
    await act(async () => {
      await Alert.alert.mock.calls[0][2].find((b) => b.text === 'Delete').onPress();
    });
    expect(dataActions.deleteTransaction).toHaveBeenCalledWith('t1');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('stays open and explains when a delete fails', async () => {
    dataActions.deleteTransaction.mockImplementation(() => () => Promise.reject(apiError(0)));
    mockRouteParams = { transactionId: 't1' };
    const { root } = await renderScreen(ManageTransactionScreen, seeded);
    await pressText(root, 'Delete Transaction');
    await act(async () => {
      await Alert.alert.mock.calls[0][2].find((b) => b.text === 'Delete').onPress();
    });
    expect(Alert.alert).toHaveBeenLastCalledWith('Couldn’t delete', expect.stringMatching(/internet connection/));
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
