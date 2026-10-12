import { describeHouseholdError, isCancelled } from '../src/utils/householdErrors';

describe('describeHouseholdError', () => {
  const api = (status, message = 'x') => Object.assign(new Error(message), { status });

  it('explains being offline, rate limits and server problems', () => {
    expect(describeHouseholdError(api(0))).toMatch(/internet connection/);
    expect(describeHouseholdError(api(429))).toMatch(/Too many attempts/);
    expect(describeHouseholdError(api(503))).toMatch(/server had a problem/);
  });

  it('shows our own API messages for client errors', () => {
    expect(describeHouseholdError(api(400, 'Invalid or expired invite'))).toBe('Invalid or expired invite');
    expect(describeHouseholdError(api(409, 'You are already in a household'))).toBe(
      'You are already in a household',
    );
  });

  it('explains Google sign-in problems', () => {
    expect(describeHouseholdError({ reason: 'play-services' })).toMatch(/Play services/);
    expect(describeHouseholdError({ reason: 'not-configured' })).toMatch(/isn.t set up/);
    expect(describeHouseholdError({ reason: 'no-token' })).toMatch(/try again/i);
  });

  it('falls back to a generic message for anything unknown', () => {
    expect(describeHouseholdError(new Error('boom'))).toBe('Something went wrong. Please try again.');
    expect(describeHouseholdError(undefined, 'Custom')).toBe('Custom');
  });

  it('treats cancelling as not an error worth showing', () => {
    expect(isCancelled({ reason: 'cancelled' })).toBe(true);
    expect(isCancelled({ reason: 'in-progress' })).toBe(true);
    expect(isCancelled({ reason: 'play-services' })).toBe(false);
    expect(isCancelled(new Error('x'))).toBe(false);
  });
});
