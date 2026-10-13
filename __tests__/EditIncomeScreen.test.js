import EditIncomeScreen from '../src/Screens/EditIncomeScreen';
import { dataActions } from '../src/services/householdApp';
import { act, hasText, pressText, renderScreen, typeInto } from '../jest/renderScreen';

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack }),
}));
jest.mock('../src/services/householdApp', () => ({
  dataActions: { setMonthlyIncome: jest.fn() },
  householdActions: {},
}));

const user = { id: 'u1', email: 'asha@example.com', name: 'Asha' };
const inHousehold = (role, extra = {}) => ({
  household: { user, current: { id: 'h1', name: 'Home', role, membershipId: 'm1' } },
  householdData: { loadedFor: 'h1', ...extra },
});
const apiError = (status, message = 'x') => Object.assign(new Error(message), { status });

beforeEach(() => {
  jest.clearAllMocks();
  dataActions.setMonthlyIncome.mockImplementation(() => () => Promise.resolve());
});

describe('solo mode', () => {
  it('saves the income as before', async () => {
    const { root } = await renderScreen(EditIncomeScreen, { phone: { monthlyIncome: null } });
    expect(hasText(root, 'How much do you earn per month?')).toBe(true);
    expect(hasText(root, 'spenders')).toBe(false);
    await typeInto(root, '0', '60,000');
    await pressText(root, 'Save');
    expect(dataActions.setMonthlyIncome).toHaveBeenCalledWith(60000);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('rejects zero, negative and non-numeric input without saving', async () => {
    const { root } = await renderScreen(EditIncomeScreen, { phone: { monthlyIncome: null } });
    for (const value of ['0', '-5', 'abc', '']) {
      await typeInto(root, '0', value);
      await pressText(root, 'Save');
      expect(hasText(root, 'greater than zero')).toBe(true);
    }
    expect(dataActions.setMonthlyIncome).not.toHaveBeenCalled();
  });

  it('starts with the current income filled in', async () => {
    const { root } = await renderScreen(EditIncomeScreen, { phone: { monthlyIncome: 45000 } });
    const input = root.findAll((n) => n.props.placeholder === '0' && n.props.onChangeText)[0];
    expect(input.props.value).toBe('45000');
  });
});

describe('household earner', () => {
  const sources = { income: { total: 8000000, sources: [{ id: 'i1', amount: 8000000, mine: true }] } };

  it('edits their own income, shown in rupees, and is told who can see it', async () => {
    const { root } = await renderScreen(EditIncomeScreen, inHousehold('EARNER', sources));
    const input = root.findAll((n) => n.props.placeholder === '0' && n.props.onChangeText)[0];
    expect(input.props.value).toBe('80000'); // the earner's own server income, not the phone's
    expect(hasText(root, 'Only the owner and earners in your household can see household income')).toBe(true);
    await typeInto(root, '0', '90000');
    await pressText(root, 'Save');
    expect(dataActions.setMonthlyIncome).toHaveBeenCalledWith(90000);
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('stays open and explains when saving fails, then works on retry', async () => {
    dataActions.setMonthlyIncome.mockImplementationOnce(() => () => Promise.reject(apiError(0)));
    const { root } = await renderScreen(EditIncomeScreen, inHousehold('OWNER', sources));
    await pressText(root, 'Save');
    expect(hasText(root, 'internet connection')).toBe(true);
    expect(mockGoBack).not.toHaveBeenCalled();
    await pressText(root, 'Save');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('shows the explanation when someone has several income sources instead of overwriting them', async () => {
    dataActions.setMonthlyIncome.mockImplementation(() => () => Promise.reject(apiError(400, 'You have more than one income source, so a single figure can’t replace them.')));
    const { root } = await renderScreen(EditIncomeScreen, inHousehold('EARNER', sources));
    await pressText(root, 'Save');
    expect(hasText(root, 'more than one income source')).toBe(true);
  });

  it('ignores a second tap while saving', async () => {
    let finish;
    dataActions.setMonthlyIncome.mockImplementation(() => () => new Promise((resolve) => { finish = resolve; }));
    const { root } = await renderScreen(EditIncomeScreen, inHousehold('EARNER', sources));
    await pressText(root, 'Save');
    await pressText(root, 'Saving');
    expect(dataActions.setMonthlyIncome).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });
});

describe('household spender', () => {
  it('sees an explanation, not an income form, with their allowance', async () => {
    const { root } = await renderScreen(EditIncomeScreen, inHousehold('SPENDER', { allowanceReceived: 300000 }));
    expect(hasText(root, 'Set aside by an earner')).toBe(true);
    expect(hasText(root, 'Right now that is ₹3,000 a month')).toBe(true);
    expect(hasText(root, 'How much do you earn')).toBe(false);
    expect(hasText(root, 'Save')).toBe(false);
  });

  it('is told to ask an earner when no allowance is set', async () => {
    const { root } = await renderScreen(EditIncomeScreen, inHousehold('SPENDER', { allowanceReceived: 0 }));
    expect(hasText(root, 'Ask an earner in your household')).toBe(true);
  });
});
