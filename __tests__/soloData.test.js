import { MAX_TRANSACTIONS, buildSoloData } from '../src/utils/soloData';

const envelope = { id: 'env_1', categoryKey: 'food', icon: '🍕', title: 'Food', colorKey: 'food', type: 'spending', budgetLimit: 8000.5 };
const tx = (over = {}) => ({ id: 't', merchant: 'Cafe', category: 'Food', amount: 199.99, date: '2026-10-02', icon: 'x', colorKey: 'food', ...over });

describe('buildSoloData', () => {
  it('maps the app’s data to the upload shape, in rupees, without local ids or styling noise', () => {
    const { payload, counts, skipped } = buildSoloData(
      { envelopes: [envelope], transactions: [tx()], monthlyIncome: 50000 },
      'PERSONAL',
    );
    expect(payload).toEqual({
      envelopeScope: 'PERSONAL',
      monthlyIncome: 50000,
      envelopes: [{ categoryKey: 'food', icon: '🍕', title: 'Food', colorKey: 'food', type: 'spending', budgetLimit: 8000.5 }],
      transactions: [{ merchant: 'Cafe', category: 'Food', amount: 199.99, date: '2026-10-02' }],
    });
    expect(counts).toEqual({ envelopes: 1, transactions: 1 });
    expect(skipped).toEqual({ envelopes: 0, transactions: 0 });
  });

  it('sends no income when none is set', () => {
    for (const monthlyIncome of [null, undefined, 0, -5, NaN]) {
      const { payload } = buildSoloData({ envelopes: [], transactions: [], monthlyIncome }, 'SHARED');
      expect(payload.monthlyIncome).toBeNull();
    }
  });

  it('drops rows the server would reject, and counts them', () => {
    const { payload, skipped } = buildSoloData(
      {
        envelopes: [envelope, { ...envelope, title: '   ' }, { ...envelope, budgetLimit: -1 }, { ...envelope, budgetLimit: NaN }],
        transactions: [
          tx(),
          tx({ date: '2026-02-31' }), // impossible date
          tx({ date: 'yesterday' }),
          tx({ date: undefined }),
          tx({ amount: 0 }),
          tx({ amount: -20 }),
          tx({ amount: 0.001 }), // rounds to zero paise
          tx({ amount: NaN }),
          tx({ amount: '50' }), // not a number
        ],
        monthlyIncome: null,
      },
      'PERSONAL',
    );
    expect(payload.envelopes).toHaveLength(1);
    expect(payload.transactions).toHaveLength(1);
    expect(skipped).toEqual({ envelopes: 3, transactions: 8 });
  });

  it('fills in blanks the server would otherwise refuse', () => {
    const { payload } = buildSoloData(
      { envelopes: [], transactions: [tx({ merchant: '  ', category: undefined })], monthlyIncome: null },
      'PERSONAL',
    );
    expect(payload.transactions[0]).toMatchObject({ merchant: 'Unknown', category: 'Other' });
  });

  it('keeps the most recent transactions when there are more than the server accepts', () => {
    const many = Array.from({ length: MAX_TRANSACTIONS + 5 }, (_, i) =>
      tx({ merchant: `Shop ${i}`, date: i < 5 ? '2020-01-01' : '2026-10-02' }),
    );
    const { payload, counts, skipped } = buildSoloData({ envelopes: [], transactions: many, monthlyIncome: null }, 'PERSONAL');
    expect(payload.transactions).toHaveLength(MAX_TRANSACTIONS);
    expect(payload.transactions.every((t) => t.date === '2026-10-02')).toBe(true); // the oldest 5 were cut
    expect(counts.transactions).toBe(MAX_TRANSACTIONS);
    expect(skipped.transactions).toBe(5);
  });

  it('does not change the data it was given', () => {
    const transactions = [tx({ date: '2026-10-03' }), tx({ date: '2026-10-05' })];
    const snapshot = JSON.stringify(transactions);
    buildSoloData({ envelopes: [envelope], transactions, monthlyIncome: 1 }, 'PERSONAL');
    expect(JSON.stringify(transactions)).toBe(snapshot);
  });

  it('survives an empty phone', () => {
    const { payload, counts } = buildSoloData({ envelopes: [], transactions: [], monthlyIncome: null }, 'PERSONAL');
    expect(payload.envelopes).toEqual([]);
    expect(payload.transactions).toEqual([]);
    expect(counts).toEqual({ envelopes: 0, transactions: 0 });
  });
});
