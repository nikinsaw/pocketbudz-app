import { Alert } from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import AIAssistantScreen from '../src/Screens/AIAssistantScreen';
import SettingsScreen from '../src/Screens/SettingsScreen';
import { dataActions } from '../src/services/householdApp';
import { parseTransactionFromPrompt } from '../src/services/aiTransactionParser';
import { importTransactionsFromFile } from '../src/services/importTransactions';
import { hasText, pressExactText, pressText, renderScreen, typeInto } from '../jest/renderScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));
jest.mock('../src/services/householdApp', () => ({
  dataActions: { addTransaction: jest.fn(), addTransactions: jest.fn() },
  householdActions: { syncData: jest.fn(() => () => Promise.resolve(true)) },
}));
jest.mock('../src/services/aiTransactionParser', () => ({ parseTransactionFromPrompt: jest.fn() }));
jest.mock('../src/services/importTransactions', () => ({ importTransactionsFromFile: jest.fn() }));

const apiError = (status) => Object.assign(new Error('x'), { status });
const parsed = { merchant: 'Blinkit', category: 'Groceries', amount: 500, date: '2026-10-05' };

beforeEach(() => {
  jest.clearAllMocks();
  dataActions.addTransaction.mockImplementation(() => () => Promise.resolve());
  dataActions.addTransactions.mockImplementation(() => () => Promise.resolve());
  parseTransactionFromPrompt.mockResolvedValue({ success: true, transaction: parsed });
  // The Quick Add screen opens the camera on load; here the person dismisses it to type instead.
  launchCamera.mockResolvedValue({ didCancel: true });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => Alert.alert.mockRestore());

describe('AI quick add', () => {
  const send = async (root) => {
    await typeInto(root, 'e.g. ₹500 groceries yesterday', '₹500 groceries');
    await pressExactText(root, 'Add');
  };

  it('saves what the AI understood through the data action', async () => {
    const { root } = await renderScreen(AIAssistantScreen);
    await send(root);
    expect(dataActions.addTransaction).toHaveBeenCalledWith(parsed);
  });

  it('tells the person it could not be saved - and keeps their text so they can resend', async () => {
    dataActions.addTransaction.mockImplementation(() => () => Promise.reject(apiError(0)));
    const { root } = await renderScreen(AIAssistantScreen);
    await send(root);
    expect(hasText(root, 'internet connection')).toBe(true);
    const input = root.findAll((n) => n.props.placeholder === 'e.g. ₹500 groceries yesterday' && n.props.onChangeText)[0];
    expect(input.props.value).toBe('₹500 groceries');
  });

  it('still shows the AI’s own error when it cannot understand the text, and saves nothing', async () => {
    parseTransactionFromPrompt.mockResolvedValue({ success: false, error: 'I could not find an amount.' });
    const { root } = await renderScreen(AIAssistantScreen);
    await send(root);
    expect(hasText(root, 'I could not find an amount.')).toBe(true);
    expect(dataActions.addTransaction).not.toHaveBeenCalled();
  });
});

describe('CSV import in Settings', () => {
  const rows = [
    { merchant: 'A', category: 'Food', amount: 10, date: '2026-10-01' },
    { merchant: 'B', category: 'Food', amount: 20, date: '2026-10-02' },
  ];

  it('adds all the imported rows in one go and reports how many', async () => {
    importTransactionsFromFile.mockResolvedValue({ success: true, transactions: rows, skipped: 1 });
    const { root } = await renderScreen(SettingsScreen);
    await pressText(root, 'Import Transactions');
    expect(dataActions.addTransactions).toHaveBeenCalledWith(rows);
    expect(Alert.alert).toHaveBeenLastCalledWith('Import complete', 'Added 2 transactions (1 row skipped).');
  });

  it('says it could not import - and does not claim success - when saving fails', async () => {
    importTransactionsFromFile.mockResolvedValue({ success: true, transactions: rows, skipped: 0 });
    dataActions.addTransactions.mockImplementation(() => () => Promise.reject(apiError(0)));
    const { root } = await renderScreen(SettingsScreen);
    await pressText(root, 'Import Transactions');
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenLastCalledWith('Couldn’t import', expect.stringMatching(/internet connection/));
  });

  it('does nothing when the file picker is cancelled', async () => {
    importTransactionsFromFile.mockResolvedValue({ success: false, cancelled: true });
    const { root } = await renderScreen(SettingsScreen);
    await pressText(root, 'Import Transactions');
    expect(dataActions.addTransactions).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
