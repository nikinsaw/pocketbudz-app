import SyncBanner from '../src/Components/Household/SyncBanner';
import { householdActions } from '../src/services/householdApp';
import { syncFailed, syncStarted, syncSucceeded } from '../src/store/slices/householdDataSlice';
import { allText, hasText, pressText, renderScreen } from '../jest/renderScreen';

jest.mock('../src/services/householdApp', () => ({
  householdActions: { syncData: jest.fn() },
}));

const user = { id: 'u1', email: 'a@x.com', name: 'A' };
const inHousehold = { household: { user, current: { id: 'h1', name: 'Home', role: 'OWNER', membershipId: 'm1' } } };
const loadedData = { loadedFor: 'h1', envelopes: [], transactions: [], income: null, allowanceReceived: 0, cycleStartDay: 1 };

beforeEach(() => {
  jest.clearAllMocks();
  householdActions.syncData.mockImplementation(() => () => Promise.resolve(true));
});

describe('SyncBanner', () => {
  it('shows nothing in solo mode and never talks to the server', async () => {
    const { root } = await renderScreen(SyncBanner);
    expect(allText(root)).toEqual([]);
    expect(householdActions.syncData).not.toHaveBeenCalled();
  });

  it('loads the household data when it was never loaded, and says so', async () => {
    const { root } = await renderScreen(SyncBanner, inHousehold);
    expect(householdActions.syncData).toHaveBeenCalledTimes(1);
    expect(hasText(root, 'Loading your household')).toBe(true);
  });

  it('shows the loading message during the first load', async () => {
    const { root, store } = await renderScreen(SyncBanner, inHousehold);
    await require('react-test-renderer').act(async () => {
      store.dispatch(syncStarted());
    });
    expect(hasText(root, 'Loading your household')).toBe(true);
  });

  it('shows nothing once loaded, and nothing during a quiet refresh', async () => {
    const { root, store } = await renderScreen(SyncBanner, inHousehold);
    await require('react-test-renderer').act(async () => {
      store.dispatch(syncSucceeded(loadedData));
    });
    expect(allText(root)).toEqual([]);
    await require('react-test-renderer').act(async () => {
      store.dispatch(syncStarted());
    });
    expect(allText(root)).toEqual([]); // cached data stays on screen without a banner
  });

  it('tells the person the data is the last saved copy when a refresh fails, and offers a retry', async () => {
    const { root, store } = await renderScreen(SyncBanner, inHousehold);
    await require('react-test-renderer').act(async () => {
      store.dispatch(syncSucceeded(loadedData));
      store.dispatch(syncFailed('Can’t reach the server. Check your internet connection and try again.'));
    });
    expect(hasText(root, 'internet connection')).toBe(true);
    expect(hasText(root, 'Showing your last saved data')).toBe(true);

    householdActions.syncData.mockClear();
    await pressText(root, 'Retry');
    expect(householdActions.syncData).toHaveBeenCalledTimes(1);
  });

  it('does not keep re-requesting the data on every render once it has loaded', async () => {
    const { store } = await renderScreen(SyncBanner, inHousehold);
    await require('react-test-renderer').act(async () => {
      store.dispatch(syncSucceeded(loadedData));
    });
    await require('react-test-renderer').act(async () => {
      store.dispatch(syncStarted());
    });
    expect(householdActions.syncData).toHaveBeenCalledTimes(1); // only the initial idle load
  });
});
