import { buildDashboardView, formatMoney } from '../src/utils/householdDashboard';

const base = {
  period: { from: '2026-10-01', to: '2026-10-31', daysTotal: 31, daysElapsed: 12 },
  household: { id: 'h1', name: 'Sharma family', currencyFormat: 'indian' },
  me: { membershipId: 'm1', role: 'OWNER' },
  headline: { householdSpent: 5700000, sharedSpent: 3000000, privateSpent: 2700000, complete: true, sharedBudget: 3500000, sharedBudgetSpent: 3000000, mySpent: 1000000 },
  income: { total: 8000000, sources: [], leftOver: 2300000 },
  allowances: { given: 200000, total: 200000 },
  envelopes: [
    { id: 'e1', title: 'Groceries', icon: '🛒', colorKey: 'groceries', type: 'spending', scope: 'SHARED', budgetLimit: 1000000, spent: 900000, mine: false, owner: null },
    { id: 'e2', title: 'Rent', icon: '🏠', colorKey: 'rent', type: 'fixed', scope: 'SHARED', budgetLimit: 2500000, spent: 2500000, mine: false, owner: null },
    { id: 'e3', title: 'Pocket money', icon: '🎮', colorKey: 'fun', type: 'spending', scope: 'PERSONAL', budgetLimit: 500000, spent: 150000, mine: false, owner: 'Ravi' },
  ],
  members: [
    { membershipId: 'm1', name: 'Asha', role: 'OWNER', isMe: true, sharedSpent: 500000, privateSpent: 500000, itemisedSpent: 500000, currentLevel: 'FULL' },
    { membershipId: 'm2', name: 'Ravi', role: 'SPENDER', isMe: false, sharedSpent: 2500000, privateSpent: 2200000, itemisedSpent: 0, currentLevel: 'TOTAL' },
  ],
};

describe('formatMoney', () => {
  it('formats paise as rupees, dropping .00 and keeping real paise', () => {
    expect(formatMoney(0)).toBe('₹0');
    expect(formatMoney(50000)).toBe('₹500');
    expect(formatMoney(19999)).toBe('₹199.99');
    expect(formatMoney(5)).toBe('₹0.05');
    expect(formatMoney(-12345)).toBe('₹-123.45');
  });

  it('groups digits the Indian way or the international way, per the household setting', () => {
    expect(formatMoney(10000000, 'indian')).toBe('₹1,00,000');
    expect(formatMoney(10000000, 'international')).toBe('₹100,000');
    expect(formatMoney(123456789, 'indian')).toBe('₹12,34,567.89');
  });
});

describe('buildDashboardView headline and period', () => {
  it('labels the cycle and how far through it we are', () => {
    const view = buildDashboardView(base);
    expect(view.title).toBe('Sharma family');
    expect(view.periodLabel).toBe('1 Oct – 31 Oct');
    expect(view.progressLabel).toBe('Day 12 of 31');
  });

  it('earners see a complete household total with no caveat', () => {
    const { headline } = buildDashboardView(base);
    expect(headline.amountLabel).toBe('₹57,000');
    expect(headline.caption).toBe('spent by your household this cycle');
    expect(headline.note).toBeNull();
  });

  it('spenders are told their figure is only what they can see', () => {
    const view = buildDashboardView({
      ...base,
      me: { membershipId: 'm2', role: 'SPENDER' },
      headline: { ...base.headline, complete: false },
      income: null,
      allowances: { received: 200000 },
    });
    expect(view.headline.caption).toBe('spent that you can see this cycle');
    expect(view.headline.note).toMatch(/whatever others choose to show you/);
  });
});

describe('buildDashboardView income', () => {
  it('earners get income and what is left', () => {
    const view = buildDashboardView(base);
    expect(view.stats.map((s) => s.label)).toEqual(['Shared', 'Personal', 'Income']);
    expect(view.leftOver).toEqual({ label: 'Left after spending', value: '₹23,000', negative: false });
  });

  it('flags spending beyond income', () => {
    const view = buildDashboardView({ ...base, income: { total: 1000000, sources: [], leftOver: -4700000 } });
    expect(view.leftOver).toEqual({ label: 'Spent beyond income', value: '₹47,000', negative: true });
  });

  it('spenders get no income line at all', () => {
    const view = buildDashboardView({ ...base, me: { membershipId: 'm2', role: 'SPENDER' }, income: null, allowances: { received: 0 } });
    expect(view.leftOver).toBeNull();
    expect(view.stats.map((s) => s.label)).toEqual(['Shared', 'Personal']);
    expect(JSON.stringify(view)).not.toMatch(/Income/);
  });
});

describe('buildDashboardView envelopes', () => {
  const view = buildDashboardView(base);

  it('splits shared from personal envelopes', () => {
    expect(view.sharedEnvelopes.map((e) => e.title)).toEqual(['Groceries', 'Rent']);
    expect(view.personalEnvelopes.map((e) => e.title)).toEqual(['Pocket money']);
  });

  it('shows spent of limit, what is left, progress and a warning near the limit', () => {
    const groceries = view.sharedEnvelopes[0];
    expect(groceries.amountLabel).toBe('₹9,000 of ₹10,000');
    expect(groceries.status).toBe('₹1,000 left');
    expect(groceries.progress).toBeCloseTo(0.9);
    expect(groceries.warning).toBe(true); // 90% >= 85%
  });

  it('handles fixed envelopes as paid/fixed rather than "left"', () => {
    const rent = view.sharedEnvelopes[1];
    expect(rent.status).toBe('Paid this cycle');
    expect(rent.warning).toBe(false);
  });

  it('caps the bar at 100% but says by how much an envelope is over', () => {
    const over = buildDashboardView({
      ...base,
      envelopes: [{ ...base.envelopes[0], spent: 1250000 }],
    }).sharedEnvelopes[0];
    expect(over.progress).toBe(1);
    expect(over.status).toBe('Over by ₹2,500');
    expect(over.warning).toBe(true);
  });

  it('copes with a zero budget without dividing by zero', () => {
    const row = buildDashboardView({ ...base, envelopes: [{ ...base.envelopes[0], budgetLimit: 0, spent: 5000 }] }).sharedEnvelopes[0];
    expect(row.progress).toBe(0);
    expect(Number.isFinite(row.progress)).toBe(true);
  });

  it('says whose personal envelope it is when another member shared it in full', () => {
    expect(view.personalEnvelopes[0].ownerLabel).toBe('Ravi’s, shared with you');
    expect(view.sharedEnvelopes[0].ownerLabel).toBeNull();
  });
});

describe('buildDashboardView members and privacy wording', () => {
  const labels = (data) => Object.fromEntries(buildDashboardView(data).members.map((m) => [m.name, m.detail]));

  it('puts me first, then the biggest spenders, with totals including shared + private', () => {
    const { members } = buildDashboardView(base);
    expect(members.map((m) => m.name)).toEqual(['Asha', 'Ravi']);
    expect(members[1].totalLabel).toBe('₹47,000');
  });

  it('an earner seeing only a total says "Total only"', () => {
    expect(labels(base).Ravi).toBe('Total only');
  });

  it('says details are shared when everything private is itemised', () => {
    const data = { ...base, members: [base.members[0], { ...base.members[1], itemisedSpent: 2200000 }] };
    expect(labels(data).Ravi).toBe('Details shared with you');
  });

  it('says some details are shared when only part is itemised', () => {
    const data = { ...base, members: [base.members[0], { ...base.members[1], itemisedSpent: 1000000 }] };
    expect(labels(data).Ravi).toBe('Some details shared with you');
  });

  it('an earner can trust zero: it means no personal spending', () => {
    const data = { ...base, members: [base.members[0], { ...base.members[1], privateSpent: 0, itemisedSpent: 0 }] };
    expect(labels(data).Ravi).toBe('No personal spending');
  });

  it('a spender cannot tell zero from hidden, so the wording does not claim either', () => {
    const data = {
      ...base,
      headline: { ...base.headline, complete: false },
      members: [base.members[0], { ...base.members[1], privateSpent: 0, itemisedSpent: 0 }],
    };
    expect(labels(data).Ravi).toBe('Personal spending is private');
  });

  it('never exposes more than the totals it was given', () => {
    const json = JSON.stringify(buildDashboardView(base));
    expect(json).not.toMatch(/merchant/i);
  });
});

describe('buildDashboardView allowances and empty state', () => {
  it('earners see what they set aside; spenders see what is set aside for them', () => {
    expect(buildDashboardView(base).mine.givenLabel).toBe('₹2,000 set aside for spenders each cycle');
    const spender = buildDashboardView({ ...base, me: { membershipId: 'm2', role: 'SPENDER' }, income: null, allowances: { received: 300000 } });
    expect(spender.mine.allowanceLabel).toBe('₹3,000 set aside for you each cycle');
    expect(spender.mine.givenLabel).toBeNull();
  });

  it('shows nothing about allowances when there are none', () => {
    const view = buildDashboardView({ ...base, allowances: { given: 0, total: 0 } });
    expect(view.mine.givenLabel).toBeNull();
    expect(view.mine.allowanceLabel).toBeNull();
  });

  it('recognises a brand-new household as empty', () => {
    const empty = buildDashboardView({
      ...base,
      headline: { householdSpent: 0, sharedSpent: 0, privateSpent: 0, complete: true, sharedBudget: 0, sharedBudgetSpent: 0, mySpent: 0 },
      envelopes: [],
      income: { total: 0, sources: [], leftOver: 0 },
      members: [base.members[0]],
    });
    expect(empty.isEmpty).toBe(true);
    expect(buildDashboardView(base).isEmpty).toBe(false);
  });
});
