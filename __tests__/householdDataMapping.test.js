import {
  envelopeIdForCategory,
  monthlyIncomeFor,
  toAppEnvelope,
  toAppTransaction,
  toPaise,
  toRupees,
} from '../src/utils/householdDataMapping';

describe('money conversion', () => {
  it('round-trips without floating-point drift', () => {
    for (const rupees of [0, 1, 199.99, 0.05, 12345.67, 0.1 + 0.2]) {
      expect(toRupees(toPaise(rupees))).toBeCloseTo(rupees, 2);
    }
    expect(toPaise(199.99)).toBe(19999);
    expect(toPaise(0.1 + 0.2)).toBe(30);
  });
});

describe('toAppEnvelope', () => {
  const server = { id: 'e1', householdId: 'h1', scope: 'SHARED', ownerId: null, categoryKey: 'food', icon: '🍕', title: 'Food', colorKey: 'food', type: 'spending', budgetLimit: 800050, createdAt: 'x' };

  it('uses the solo envelope shape with rupee amounts', () => {
    expect(toAppEnvelope(server)).toMatchObject({
      id: 'e1', categoryKey: 'food', icon: '🍕', title: 'Food', colorKey: 'food', type: 'spending', budgetLimit: 8000.5,
    });
  });

  it('marks shared vs personal and keeps the owner', () => {
    expect(toAppEnvelope(server)).toMatchObject({ shared: true, scope: 'SHARED', ownerId: null });
    expect(toAppEnvelope({ ...server, scope: 'PERSONAL', ownerId: 'm1' })).toMatchObject({ shared: false, ownerId: 'm1' });
  });
});

describe('toAppTransaction', () => {
  const server = { id: 't1', merchant: 'Cafe', category: 'Dining', amount: 19999, date: '2026-10-02', envelopeId: 'e1', mine: true, member: { membershipId: 'm1', name: 'Asha' } };
  const categories = [{ label: 'Dining', icon: '🍽️', colorKey: 'dining' }];

  it('uses the solo transaction shape with rupee amounts and the category look', () => {
    expect(toAppTransaction(server, categories)).toMatchObject({
      id: 't1', merchant: 'Cafe', category: 'Dining', amount: 199.99, date: '2026-10-02', icon: '🍽️', colorKey: 'dining',
    });
  });

  it('falls back to a neutral look for a category this phone does not have', () => {
    const t = toAppTransaction({ ...server, category: 'Gadgets' }, categories);
    expect(t.icon).toBe('🧾');
    expect(t.colorKey).toBe('householdSupplies');
  });

  it('keeps who spent it, and tolerates an anonymised former member', () => {
    expect(toAppTransaction(server, categories)).toMatchObject({ mine: true, memberName: 'Asha', envelopeId: 'e1' });
    expect(toAppTransaction({ ...server, mine: false, member: { membershipId: null, name: 'Former member' } }, categories)).toMatchObject({ mine: false, memberName: 'Former member' });
    expect(toAppTransaction({ ...server, member: undefined, envelopeId: undefined }, categories)).toMatchObject({ memberName: null, envelopeId: null });
  });
});

describe('monthlyIncomeFor', () => {
  const data = {
    income: { total: 10500000, sources: [{ id: 'i1', amount: 8000000, mine: true }, { id: 'i2', amount: 500000, mine: true }, { id: 'i3', amount: 2000000, mine: false }] },
    allowanceReceived: 300000,
  };

  it('an earner works from their own income only, not the household total', () => {
    expect(monthlyIncomeFor('OWNER', data)).toBe(85000);
    expect(monthlyIncomeFor('EARNER', data)).toBe(85000);
  });

  it('an earner with no income of their own has none (the card shows its empty state)', () => {
    expect(monthlyIncomeFor('EARNER', { income: { total: 5, sources: [{ amount: 5, mine: false }] }, allowanceReceived: 0 })).toBeNull();
    expect(monthlyIncomeFor('EARNER', { income: null, allowanceReceived: 0 })).toBeNull();
  });

  it('a spender works from the allowance set aside for them', () => {
    expect(monthlyIncomeFor('SPENDER', data)).toBe(3000);
  });

  it('a spender with no allowance has none, and never sees household income', () => {
    expect(monthlyIncomeFor('SPENDER', { ...data, allowanceReceived: 0 })).toBeNull();
    expect(monthlyIncomeFor('SPENDER', { income: data.income, allowanceReceived: 0 })).toBeNull();
  });
});

describe('envelopeIdForCategory', () => {
  const envelopes = [
    { id: 'shared-food', title: 'Food', scope: 'SHARED', ownerId: null },
    { id: 'my-food', title: 'Food', scope: 'PERSONAL', ownerId: 'm1' },
    { id: 'rent', title: 'Rent', scope: 'SHARED', ownerId: null },
    { id: 'theirs', title: 'Fun', scope: 'PERSONAL', ownerId: 'm2' },
  ];

  it('matches by title, ignoring case and surrounding spaces', () => {
    expect(envelopeIdForCategory('  rent ', envelopes, 'm1')).toBe('rent');
    expect(envelopeIdForCategory('RENT', envelopes, 'm1')).toBe('rent');
  });

  it('prefers my own personal envelope over a shared one with the same name', () => {
    expect(envelopeIdForCategory('Food', envelopes, 'm1')).toBe('my-food');
  });

  it('falls back to the shared envelope for someone without a personal one', () => {
    expect(envelopeIdForCategory('Food', envelopes, 'm3')).toBe('shared-food');
  });

  it('never picks another member’s personal envelope', () => {
    expect(envelopeIdForCategory('Fun', envelopes, 'm1')).toBeNull();
  });

  it('returns null when there is no matching envelope or no category', () => {
    for (const category of ['Gadgets', '', '   ', null, undefined]) {
      expect(envelopeIdForCategory(category, envelopes, 'm1')).toBeNull();
    }
  });
});
