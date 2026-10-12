import React from 'react';
import HouseholdSetup from '../src/Components/Household/HouseholdSetup';
import { AGREEMENT_VERSION } from '../src/data/householdAgreement';
import {
  buttonWithText,
  hasText,
  isDisabled,
  pressText,
  renderScreen,
  typeInto,
} from '../jest/renderScreen';

const user = { id: 'u1', email: 'asha@example.com', name: 'Asha' };

function setup(overrides = {}) {
  const props = {
    user,
    fetchConsentVersion: jest.fn(async () => AGREEMENT_VERSION),
    onCreate: jest.fn(),
    onJoin: jest.fn(),
    onSignOut: jest.fn(),
    busy: false,
    error: '',
    ...overrides,
  };
  const Screen = () => <HouseholdSetup {...props} />;
  return { props, render: () => renderScreen(Screen) };
}

describe('HouseholdSetup', () => {
  it('checks the agreement version with the server before offering anything', async () => {
    const { props, render } = setup();
    const { root } = await render();
    expect(props.fetchConsentVersion).toHaveBeenCalledTimes(1);
    expect(hasText(root, 'Set up your household')).toBe(true);
    expect(hasText(root, 'asha@example.com')).toBe(true);
  });

  it('tells the person to update the app when the server expects a newer agreement', async () => {
    const { props, render } = setup({ fetchConsentVersion: jest.fn(async () => '2099-01-v9') });
    const { root } = await render();
    expect(hasText(root, 'Update PocketBudz')).toBe(true);
    expect(hasText(root, 'Create household')).toBe(false);
    await pressText(root, 'Sign out');
    expect(props.onSignOut).toHaveBeenCalled();
  });

  it('offers a retry when the server cannot be reached, and recovers', async () => {
    const fetchConsentVersion = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(AGREEMENT_VERSION);
    const { render } = setup({ fetchConsentVersion });
    const { root } = await render();
    expect(hasText(root, 'reach the server')).toBe(true);
    await pressText(root, 'Try again');
    expect(hasText(root, 'Set up your household')).toBe(true);
  });

  it('will not submit until the agreement is accepted AND a name is entered', async () => {
    const { props, render } = setup();
    const { root } = await render();
    expect(isDisabled(buttonWithText(root, 'Create household'))).toBe(true);

    await typeInto(root, 'e.g. Sharma family', 'Sharma family');
    expect(isDisabled(buttonWithText(root, 'Create household'))).toBe(true); // not accepted yet

    await pressText(root, 'read and agree');
    expect(isDisabled(buttonWithText(root, 'Create household'))).toBe(false);

    await pressText(root, 'Create household');
    expect(props.onCreate).toHaveBeenCalledWith({
      name: 'Sharma family',
      consentVersion: AGREEMENT_VERSION,
    });
  });

  it('does not submit a blank or whitespace-only name even after accepting', async () => {
    const { props, render } = setup();
    const { root } = await render();
    await typeInto(root, 'e.g. Sharma family', '    ');
    await pressText(root, 'read and agree');
    expect(isDisabled(buttonWithText(root, 'Create household'))).toBe(true);
    await pressText(root, 'Create household');
    expect(props.onCreate).not.toHaveBeenCalled();
  });

  it('trims the name it sends', async () => {
    const { props, render } = setup();
    const { root } = await render();
    await typeInto(root, 'e.g. Sharma family', '  Sharma family  ');
    await pressText(root, 'read and agree');
    await pressText(root, 'Create household');
    expect(props.onCreate.mock.calls[0][0].name).toBe('Sharma family');
  });

  it('joins with an invite code, trimmed, carrying the accepted agreement version', async () => {
    const { props, render } = setup();
    const { root } = await render();
    await pressText(root, 'Join with code');
    expect(hasText(root, 'Invite code')).toBe(true);
    await typeInto(root, 'Paste the code you were sent', '  abc123XY  ');
    await pressText(root, 'read and agree');
    await pressText(root, 'Join household');
    expect(props.onJoin).toHaveBeenCalledWith({
      code: 'abc123XY',
      consentVersion: AGREEMENT_VERSION,
    });
    expect(props.onCreate).not.toHaveBeenCalled();
  });

  it('keeps the agreement acceptance when switching between create and join', async () => {
    const { props, render } = setup();
    const { root } = await render();
    await pressText(root, 'read and agree');
    await pressText(root, 'Join with code');
    await typeInto(root, 'Paste the code you were sent', 'code1');
    await pressText(root, 'Join household');
    expect(props.onJoin).toHaveBeenCalledTimes(1);
  });

  it('shows the full agreement text on demand', async () => {
    const { render } = setup();
    const { root } = await render();
    expect(hasText(root, 'Who can see what')).toBe(false);
    await pressText(root, 'Read the agreement');
    expect(hasText(root, 'Who can see what')).toBe(true);
    expect(hasText(root, 'Leaving and deleting')).toBe(true);
    await pressText(root, 'Hide the agreement');
    expect(hasText(root, 'Who can see what')).toBe(false);
  });

  it('shows the error it is given and blocks submitting while busy', async () => {
    const { props, render } = setup({ error: 'Invalid or expired invite', busy: true });
    const { root } = await render();
    expect(hasText(root, 'Invalid or expired invite')).toBe(true);
    await typeInto(root, 'e.g. Sharma family', 'X');
    await pressText(root, 'read and agree');
    // While busy the label is replaced by a spinner, and nothing can be submitted.
    expect(hasText(root, 'Create household')).toBe(false);
    const buttons = root.findAll((n) => n.props.accessibilityRole === 'button' && isDisabled(n));
    expect(buttons.length).toBeGreaterThan(0);
    expect(props.onCreate).not.toHaveBeenCalled();
  });

  it('lets someone sign out if the Google account is wrong', async () => {
    const { props, render } = setup();
    const { root } = await render();
    await pressText(root, 'Not you? Sign out');
    expect(props.onSignOut).toHaveBeenCalled();
  });
});
