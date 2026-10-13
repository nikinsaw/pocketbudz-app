import { Alert } from 'react-native';
import CreateEnvelopeScreen from '../src/Screens/CreateEnvelopeScreen';
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
  dataActions: { addEnvelope: jest.fn(), updateEnvelope: jest.fn(), deleteEnvelope: jest.fn() },
  householdActions: {},
}));

const user = { id: 'u1', email: 'asha@example.com', name: 'Asha' };
const home = (role) => ({ id: 'h1', name: 'Home', role, membershipId: 'm1' });
const categories = [{ key: 'food', label: 'Food', icon: '🍕', colorKey: 'food' }];
const ok = () => () => Promise.resolve();
const apiError = (status, message = 'x') => Object.assign(new Error(message), { status });
const serverEnvelope = (over) => ({ id: 'e1', scope: 'SHARED', ownerId: null, categoryKey: 'food', icon: '🍕', title: 'Food', colorKey: 'food', type: 'spending', budgetLimit: 500000, ...over });
const inHousehold = (role, envelopes = []) => ({
  household: { user, current: home(role) },
  profile: { categories },
  householdData: { loadedFor: 'h1', envelopes },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = {};
  Object.values(dataActions).forEach((action) => action.mockImplementation(ok));
});

async function create(root, amount = '5000') {
  await pressText(root, 'Food');
  await typeInto(root, '0', amount);
  await pressText(root, 'Create Envelope');
}

describe('solo mode', () => {
  it('creates an envelope as before, with no household choices on screen', async () => {
    const { root } = await renderScreen(CreateEnvelopeScreen, { profile: { categories } });
    expect(hasText(root, 'Who is this budget for?')).toBe(false);
    await create(root);
    expect(dataActions.addEnvelope).toHaveBeenCalledTimes(1);
    expect(dataActions.addEnvelope.mock.calls[0][0]).toMatchObject({ title: 'Food', budgetLimit: 5000, type: 'spending' });
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('asks for a category and an amount first', async () => {
    const { root } = await renderScreen(CreateEnvelopeScreen, { profile: { categories } });
    await pressText(root, 'Create Envelope');
    expect(hasText(root, 'Pick a category')).toBe(true);
    await pressText(root, 'Food');
    await pressText(root, 'Create Envelope');
    expect(hasText(root, 'greater than zero')).toBe(true);
    expect(dataActions.addEnvelope).not.toHaveBeenCalled();
  });
});

describe('household: who the budget is for', () => {
  it('lets an earner choose, defaulting to just them', async () => {
    const { root } = await renderScreen(CreateEnvelopeScreen, inHousehold('EARNER'));
    expect(hasText(root, 'Who is this budget for?')).toBe(true);
    await create(root);
    expect(dataActions.addEnvelope.mock.calls[0][0].scope).toBe('PERSONAL');
  });

  it('creates a shared budget when the earner picks the household, and explains what that means', async () => {
    const { root } = await renderScreen(CreateEnvelopeScreen, inHousehold('OWNER'));
    expect(hasText(root, 'Everyone in the household sees this budget and all spending in it')).toBe(true);
    await pressText(root, 'The household');
    await create(root);
    expect(dataActions.addEnvelope.mock.calls[0][0].scope).toBe('SHARED');
  });

  it('gives a spender no choice - only their own budget', async () => {
    const { root } = await renderScreen(CreateEnvelopeScreen, inHousehold('SPENDER'));
    expect(hasText(root, 'Who is this budget for?')).toBe(false);
    expect(hasText(root, 'This will be your own budget')).toBe(true);
    await create(root);
    expect(dataActions.addEnvelope.mock.calls[0][0].scope).toBe('PERSONAL');
  });

  it('shows the reason and stays open when saving fails, then succeeds on retry', async () => {
    dataActions.addEnvelope.mockImplementationOnce(() => () => Promise.reject(apiError(0)));
    const { root } = await renderScreen(CreateEnvelopeScreen, inHousehold('EARNER'));
    await create(root);
    expect(hasText(root, 'internet connection')).toBe(true);
    expect(mockGoBack).not.toHaveBeenCalled();
    await pressText(root, 'Create Envelope');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('ignores a second tap while saving', async () => {
    let finish;
    dataActions.addEnvelope.mockImplementation(() => () => new Promise((resolve) => { finish = resolve; }));
    const { root } = await renderScreen(CreateEnvelopeScreen, inHousehold('EARNER'));
    await create(root);
    await pressText(root, 'Saving');
    expect(dataActions.addEnvelope).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });
});

describe('household: editing and deleting', () => {
  beforeEach(() => jest.spyOn(Alert, 'alert').mockImplementation(() => {}));
  afterEach(() => Alert.alert.mockRestore());

  it('an earner edits a shared budget', async () => {
    mockRouteParams = { envelopeId: 'e1' };
    const { root } = await renderScreen(CreateEnvelopeScreen, inHousehold('EARNER', [serverEnvelope({})]));
    expect(hasText(root, 'Shared with the household')).toBe(true);
    await typeInto(root, '0', '6000');
    await pressText(root, 'Save Changes');
    expect(dataActions.updateEnvelope.mock.calls[0][0]).toMatchObject({ id: 'e1', budgetLimit: 6000 });
  });

  it('a spender sees a shared budget read-only, with no save or delete', async () => {
    mockRouteParams = { envelopeId: 'e1' };
    const { root } = await renderScreen(CreateEnvelopeScreen, inHousehold('SPENDER', [serverEnvelope({})]));
    expect(hasText(root, 'Save Changes')).toBe(false);
    expect(hasText(root, 'Delete Envelope')).toBe(false);
  });

  it('a budget someone else shared with you is read-only and says so', async () => {
    mockRouteParams = { envelopeId: 'e2' };
    const { root } = await renderScreen(CreateEnvelopeScreen, inHousehold('EARNER', [serverEnvelope({ id: 'e2', scope: 'PERSONAL', ownerId: 'm9' })]));
    expect(hasText(root, 'Someone shared this budget with you')).toBe(true);
    expect(hasText(root, 'Save Changes')).toBe(false);
  });

  it('my own personal budget is fully editable', async () => {
    mockRouteParams = { envelopeId: 'e2' };
    const { root } = await renderScreen(CreateEnvelopeScreen, inHousehold('SPENDER', [serverEnvelope({ id: 'e2', scope: 'PERSONAL', ownerId: 'm1' })]));
    expect(hasText(root, 'Just yours')).toBe(true);
    expect(hasText(root, 'Save Changes')).toBe(true);
    expect(hasText(root, 'Delete Envelope')).toBe(true);
  });

  it('warns that deleting a shared budget affects everyone, then deletes', async () => {
    mockRouteParams = { envelopeId: 'e1' };
    const { root } = await renderScreen(CreateEnvelopeScreen, inHousehold('OWNER', [serverEnvelope({})]));
    await pressText(root, 'Delete Envelope');
    expect(Alert.alert.mock.calls[0][1]).toMatch(/removed for everyone in the household\. Spending in it is kept/);
    await act(async () => {
      await Alert.alert.mock.calls[0][2].find((b) => b.text === 'Delete').onPress();
    });
    expect(dataActions.deleteEnvelope).toHaveBeenCalledWith('e1');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('does not add the household warning to a solo delete, and explains a failed delete', async () => {
    mockRouteParams = { envelopeId: 'solo-e' };
    const solo = await renderScreen(CreateEnvelopeScreen, {
      profile: { categories },
      phone: { envelopes: [{ id: 'solo-e', categoryKey: 'food', icon: '🍕', title: 'Food', colorKey: 'food', type: 'spending', budgetLimit: 100 }] },
    });
    await pressText(solo.root, 'Delete Envelope');
    expect(Alert.alert.mock.calls[0][1]).toBe('This cannot be undone.');

    Alert.alert.mockClear();
    dataActions.deleteEnvelope.mockImplementation(() => () => Promise.reject(apiError(0)));
    mockRouteParams = { envelopeId: 'e1' };
    const { root } = await renderScreen(CreateEnvelopeScreen, inHousehold('OWNER', [serverEnvelope({})]));
    await pressText(root, 'Delete Envelope');
    await act(async () => {
      await Alert.alert.mock.calls[0][2].find((b) => b.text === 'Delete').onPress();
    });
    expect(Alert.alert).toHaveBeenLastCalledWith('Couldn’t delete', expect.stringMatching(/internet connection/));
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
