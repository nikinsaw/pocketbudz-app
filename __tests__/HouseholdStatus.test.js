import React from 'react';
import HouseholdStatus, { inviteMessage } from '../src/Components/Household/HouseholdStatus';
import {
  buttonWithText,
  hasText,
  isDisabled,
  pressText,
  renderScreen,
} from '../jest/renderScreen';

const members = [
  { membershipId: 'm1', role: 'OWNER', name: 'Asha', joinedAt: '2026-10-01' },
  { membershipId: 'm2', role: 'SPENDER', name: 'Ravi', joinedAt: '2026-10-02' },
];

function setup({ role = 'OWNER', ...overrides } = {}) {
  const props = {
    household: { id: 'h1', name: 'Sharma family', role, membershipId: 'm1' },
    fetchMembers: jest.fn(async () => members),
    createInvite: jest.fn(async ({ role: r }) => ({ code: 'abc123XY', role: r, expiresAt: '2026-10-20' })),
    onLeave: jest.fn(),
    onSignOut: jest.fn(),
    onOpenDashboard: jest.fn(),
    share: jest.fn(async () => ({})),
    busy: false,
    error: '',
    ...overrides,
  };
  const Screen = () => <HouseholdStatus {...props} />;
  return { props, render: () => renderScreen(Screen) };
}

describe('HouseholdStatus members', () => {
  it('shows the household, my role and the members, marking me', async () => {
    const { render } = setup();
    const { root } = await render();
    expect(hasText(root, 'Sharma family')).toBe(true);
    expect(hasText(root, 'You are the Owner')).toBe(true);
    expect(hasText(root, 'Asha (you)')).toBe(true);
    expect(hasText(root, 'Ravi')).toBe(true);
    expect(hasText(root, 'Spender')).toBe(true);
  });

  it('loads the members exactly once (no render loop)', async () => {
    const { props, render } = setup();
    await render();
    expect(props.fetchMembers).toHaveBeenCalledTimes(1);
  });

  it('shows an error with retry when members cannot load, and recovers', async () => {
    const fetchMembers = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('x'), { status: 0 }))
      .mockResolvedValueOnce(members);
    const { render } = setup({ fetchMembers });
    const { root } = await render();
    expect(hasText(root, 'internet connection')).toBe(true);
    await pressText(root, 'Try again');
    expect(hasText(root, 'Ravi')).toBe(true);
    expect(hasText(root, 'internet connection')).toBe(false);
  });
});

describe('HouseholdStatus dashboard link', () => {
  it('opens the dashboard', async () => {
    const { props, render } = setup();
    const { root } = await render();
    await pressText(root, 'dashboard');
    expect(props.onOpenDashboard).toHaveBeenCalledTimes(1);
  });
});

describe('HouseholdStatus inviting', () => {
  it('lets the owner create an invite and share it with instructions', async () => {
    const { props, render } = setup();
    const { root } = await render();
    await pressText(root, 'Create invite code');
    expect(props.createInvite).toHaveBeenCalledWith({ role: 'SPENDER' }); // default role
    expect(hasText(root, 'abc123XY')).toBe(true);
    expect(hasText(root, 'expires in 7 days')).toBe(true);

    await pressText(root, 'Share invite');
    const { message } = props.share.mock.calls[0][0];
    expect(message).toContain('abc123XY');
    expect(message).toContain('Sharma family');
    expect(message).toContain('Join with code');
  });

  it('creates an earner invite when that role is chosen, and drops the old code when the role changes', async () => {
    const { props, render } = setup();
    const { root } = await render();
    await pressText(root, 'Create invite code');
    await pressText(root, 'Earner');
    expect(hasText(root, 'abc123XY')).toBe(false); // stale code for the other role is gone
    await pressText(root, 'Create invite code');
    expect(props.createInvite).toHaveBeenLastCalledWith({ role: 'EARNER' });
  });

  it('shows a plain-language error if the invite cannot be created', async () => {
    const createInvite = jest.fn(async () => {
      throw Object.assign(new Error('Your role does not allow this'), { status: 403 });
    });
    const { render } = setup({ createInvite });
    const { root } = await render();
    await pressText(root, 'Create invite code');
    expect(hasText(root, 'Your role does not allow this')).toBe(true);
    expect(hasText(root, 'Create invite code')).toBe(true); // can try again
  });

  it('does not offer invites to earners or spenders (only the owner can invite)', async () => {
    for (const role of ['EARNER', 'SPENDER']) {
      const { render } = setup({ role });
      const { root } = await render();
      expect(hasText(root, 'Invite someone')).toBe(false);
      expect(hasText(root, 'Create invite code')).toBe(false);
    }
  });

  it('builds a message people can follow', () => {
    const message = inviteMessage('Sharma family', 'CODE1234');
    expect(message).toContain('"Sharma family"');
    expect(message).toContain('Settings > Household mode');
    expect(message.trim().endsWith('CODE1234')).toBe(true);
  });
});

describe('HouseholdStatus leaving', () => {
  it('passes leave and sign out up to the screen', async () => {
    const { props, render } = setup();
    const { root } = await render();
    await pressText(root, 'Leave household');
    await pressText(root, 'Sign out');
    expect(props.onLeave).toHaveBeenCalledTimes(1);
    expect(props.onSignOut).toHaveBeenCalledTimes(1);
  });

  it('disables leaving and signing out while another action is running', async () => {
    const { props, render } = setup({ busy: true });
    const { root } = await render();
    expect(isDisabled(buttonWithText(root, 'Leave household'))).toBe(true);
    expect(isDisabled(buttonWithText(root, 'Sign out'))).toBe(true);
    await pressText(root, 'Leave household');
    expect(props.onLeave).not.toHaveBeenCalled();
  });

  it('shows an error from leaving (e.g. the sole owner must transfer ownership first)', async () => {
    const { render } = setup({ error: 'Transfer ownership before leaving' });
    const { root } = await render();
    expect(hasText(root, 'Transfer ownership before leaving')).toBe(true);
  });
});
