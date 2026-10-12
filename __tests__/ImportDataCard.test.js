import React from 'react';
import ImportDataCard from '../src/Components/Household/ImportDataCard';
import {
  allText,
  buttonWithText,
  hasText,
  isDisabled,
  pressText,
  renderScreen,
} from '../jest/renderScreen';

function setup(overrides = {}) {
  const props = {
    counts: { envelopes: 3, transactions: 120 },
    hasIncome: true,
    role: 'EARNER',
    onImport: jest.fn(),
    busy: false,
    error: '',
    result: null,
    ...overrides,
  };
  const Screen = () => <ImportDataCard {...props} />;
  return { props, render: () => renderScreen(Screen) };
}

describe('ImportDataCard', () => {
  it('tells the person exactly what will be copied, and that the phone keeps its data', async () => {
    const { render } = setup();
    const { root } = await render();
    expect(hasText(root, '120 transactions')).toBe(true);
    expect(hasText(root, '3 envelopes')).toBe(true);
    expect(hasText(root, 'monthly income')).toBe(true);
    expect(hasText(root, 'stays exactly as it is')).toBe(true);
    expect(hasText(root, 'only do this once')).toBe(true);
  });

  it('uses singular wording for one item', async () => {
    const { render } = setup({ counts: { envelopes: 1, transactions: 1 }, hasIncome: false });
    const { root } = await render();
    expect(hasText(root, '1 transaction and 1 envelope')).toBe(true);
    expect(hasText(root, '1 transactions')).toBe(false);
  });

  it('defaults earners to PERSONAL, because sharing exposes every transaction', async () => {
    const { props, render } = setup({ role: 'OWNER' });
    const { root } = await render();
    await pressText(root, 'Upload to household');
    expect(props.onImport).toHaveBeenCalledWith({ scope: 'PERSONAL' });
  });

  it('lets an owner or earner choose to share with the household and warns what that means', async () => {
    const { props, render } = setup({ role: 'EARNER' });
    const { root } = await render();
    expect(hasText(root, 'every transaction in them')).toBe(true);
    await pressText(root, 'Share with the household');
    await pressText(root, 'Upload to household');
    expect(props.onImport).toHaveBeenCalledWith({ scope: 'SHARED' });
  });

  it('gives spenders no sharing choice and always uploads as personal', async () => {
    const { props, render } = setup({ role: 'SPENDER' });
    const { root } = await render();
    expect(hasText(root, 'Share with the household')).toBe(false);
    expect(hasText(root, 'personal to you')).toBe(true);
    expect(hasText(root, 'monthly income')).toBe(false); // spenders hold no income
    await pressText(root, 'Upload to household');
    expect(props.onImport).toHaveBeenCalledWith({ scope: 'PERSONAL' });
  });

  it('renders nothing when there is nothing on the phone to upload', async () => {
    const { render } = setup({ counts: { envelopes: 0, transactions: 0 }, hasIncome: false });
    const { root } = await render();
    expect(allText(root)).toEqual([]);
  });

  it('still offers the upload when the phone only has an income figure', async () => {
    const { render } = setup({ counts: { envelopes: 0, transactions: 0 }, hasIncome: true });
    const { root } = await render();
    expect(hasText(root, 'Upload to household')).toBe(true);
  });

  it('blocks a second tap while uploading, and shows errors', async () => {
    const { props, render } = setup({ busy: true, error: 'Could not reach the server.' });
    const { root } = await render();
    expect(hasText(root, 'Could not reach the server.')).toBe(true);
    expect(hasText(root, 'Upload to household')).toBe(false); // spinner replaces the label
    const buttons = root.findAll((n) => n.props.accessibilityRole === 'button' && isDisabled(n));
    expect(buttons.length).toBeGreaterThan(0);
    expect(props.onImport).not.toHaveBeenCalled();
  });

  it('confirms the result, including rows that could not be uploaded', async () => {
    const result = { envelopes: 3, transactions: 118, incomeImported: true, skipped: { envelopes: 0, transactions: 2 } };
    const { render } = setup({ result });
    const { root } = await render();
    expect(hasText(root, 'Your data is in the household')).toBe(true);
    expect(hasText(root, '118 transactions and 3 envelopes, plus your monthly income')).toBe(true);
    expect(hasText(root, '2 items couldn')).toBe(true);
    expect(hasText(root, 'Upload to household')).toBe(false);
  });

  it('omits the skipped note when nothing was skipped', async () => {
    const result = { envelopes: 1, transactions: 1, incomeImported: false, skipped: { envelopes: 0, transactions: 0 } };
    const { render } = setup({ result });
    const { root } = await render();
    expect(hasText(root, 'couldn')).toBe(false);
    expect(buttonWithText(root, 'Upload to household')).toBeFalsy(); // no button once it's done
  });
});
