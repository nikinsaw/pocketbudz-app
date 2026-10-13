import {
  addEnvelope as soloAddEnvelope,
  deleteEnvelope as soloDeleteEnvelope,
  updateEnvelope as soloUpdateEnvelope,
} from '../store/slices/budgetSlice';
import {
  envelopeRemoved,
  envelopeSaved,
  incomeChanged,
  transactionSaved,
  transactionsRemoved,
} from '../store/slices/householdDataSlice';
import { setMonthlyIncome as soloSetMonthlyIncome } from '../store/slices/profileSlice';
import {
  addTransaction as soloAddTransaction,
  deleteTransaction as soloDeleteTransaction,
  deleteTransactions as soloDeleteTransactions,
  mergeTransactions as soloMergeTransactions,
  updateTransaction as soloUpdateTransaction,
} from '../store/slices/transactionsSlice';
import { selectIsHousehold } from '../store/selectors';
import { envelopeIdForCategory, toPaise } from '../utils/householdDataMapping';

// What the screens call to change data. Same names and arguments as the solo slice
// actions they replace. In solo mode each one does exactly what it did before (dispatches
// the local action). In household mode it writes to the server and applies the reply to
// the household store. They return a promise that rejects with a message fit to show.
//
// Amounts arrive in rupees (what the screens hold) and go to the server in paise.

const MAX_PAISE = 2000000000; // matches backend/src/money.ts
const BULK_LIMIT = 500; // matches the bulk endpoint in backend/src/transactions/routes.ts

export class WriteError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WriteError';
    this.status = 400; // shown to the person as-is, like the server's own 4xx messages
  }
}

function paiseOf(rupees) {
  const paise = toPaise(Number(rupees));
  if (!Number.isFinite(paise) || paise < 1 || paise > MAX_PAISE) {
    throw new WriteError('Enter an amount between ₹0.01 and ₹2,00,00,000.');
  }
  return paise;
}

const clean = (value, max, fallback) => String(value ?? '').trim().slice(0, max) || fallback;

export function createDataActions({ api }) {
  // The signed-in member's household context, read at call time.
  function household(getState) {
    const state = getState();
    const { current } = state.household;
    return {
      base: `/households/${current.id}`,
      membershipId: current.membershipId,
      role: current.role,
      envelopes: state.householdData.envelopes,
    };
  }

  const transactionBody = (fields, ctx) => ({
    envelopeId: envelopeIdForCategory(fields.category, ctx.envelopes, ctx.membershipId),
    merchant: clean(fields.merchant, 60, 'Unknown'),
    category: clean(fields.category, 40, 'Other'),
    amount: paiseOf(fields.amount),
    date: fields.date,
  });

  // Deletes every id it can, applies those to the store, then reports any that failed.
  async function deleteMany(ids, ctx, dispatch) {
    const results = await Promise.allSettled(
      ids.map((id) => api.request(`${ctx.base}/transactions/${id}`, { method: 'DELETE' })),
    );
    const deleted = ids.filter((_, i) => results[i].status === 'fulfilled');
    if (deleted.length > 0) {
      dispatch(transactionsRemoved(deleted));
    }
    const failed = results.find((r) => r.status === 'rejected');
    if (failed) {
      const count = ids.length - deleted.length;
      const what = ids.length === 1 ? 'Couldn’t delete it.' : `${count} of ${ids.length} couldn’t be deleted.`;
      const why = failed.reason?.status === 403 ? ' You can only delete spending you added.' : '';
      throw new WriteError(what + why);
    }
  }

  return {
    // ---- transactions ----

    addTransaction: (fields) => async (dispatch, getState) => {
      if (!selectIsHousehold(getState())) {
        dispatch(soloAddTransaction(fields));
        return;
      }
      const ctx = household(getState);
      const saved = await api.request(`${ctx.base}/transactions`, {
        method: 'POST',
        body: transactionBody(fields, ctx),
      });
      dispatch(transactionSaved(saved));
    },

    updateTransaction:
      ({ id, ...fields }) =>
      async (dispatch, getState) => {
        if (!selectIsHousehold(getState())) {
          dispatch(soloUpdateTransaction({ id, ...fields }));
          return;
        }
        const ctx = household(getState);
        const saved = await api.request(`${ctx.base}/transactions/${id}`, {
          method: 'PATCH',
          body: transactionBody(fields, ctx),
        });
        dispatch(transactionSaved(saved));
      },

    deleteTransaction: (id) => async (dispatch, getState) => {
      if (!selectIsHousehold(getState())) {
        dispatch(soloDeleteTransaction(id));
        return;
      }
      await deleteMany([id], household(getState), dispatch);
    },

    deleteTransactions: (ids) => async (dispatch, getState) => {
      if (!selectIsHousehold(getState())) {
        dispatch(soloDeleteTransactions(ids));
        return;
      }
      await deleteMany(ids, household(getState), dispatch);
    },

    // Several at once (CSV import, a scanned statement). Household: one all-or-nothing
    // request, in chunks no bigger than the server accepts. Solo: one local add each.
    addTransactions: (list) => async (dispatch, getState) => {
      if (!selectIsHousehold(getState())) {
        list.forEach((fields) => dispatch(soloAddTransaction(fields)));
        return;
      }
      const ctx = household(getState);
      const bodies = list.map((fields) => transactionBody(fields, ctx)); // validates all first
      for (let start = 0; start < bodies.length; start += BULK_LIMIT) {
        const saved = await api.request(`${ctx.base}/transactions/bulk`, {
          method: 'POST',
          body: { transactions: bodies.slice(start, start + BULK_LIMIT) },
        });
        saved.forEach((transaction) => dispatch(transactionSaved(transaction)));
      }
    },

    // Replaces several of my transactions with one. Household: a single atomic request, so
    // a failure can never leave the originals half-deleted or the amounts counted twice.
    mergeTransactions: (merged) => async (dispatch, getState) => {
      if (!selectIsHousehold(getState())) {
        dispatch(soloMergeTransactions(merged));
        return;
      }
      const ctx = household(getState);
      const saved = await api.request(`${ctx.base}/transactions/merge`, {
        method: 'POST',
        body: { ids: merged.ids, ...transactionBody(merged, ctx) },
      });
      dispatch(transactionsRemoved(merged.ids));
      dispatch(transactionSaved(saved));
    },

    // ---- envelopes ----

    // `scope` ('SHARED' | 'PERSONAL') only matters in household mode; the solo slices ignore it.
    addEnvelope: (fields) => async (dispatch, getState) => {
      if (!selectIsHousehold(getState())) {
        dispatch(soloAddEnvelope(fields));
        return;
      }
      const ctx = household(getState);
      const saved = await api.request(`${ctx.base}/envelopes`, {
        method: 'POST',
        body: {
          scope: fields.scope ?? 'PERSONAL',
          categoryKey: clean(fields.categoryKey, 40, 'other'),
          icon: clean(fields.icon, 16, '🧾'),
          title: clean(fields.title, 40, 'Envelope'),
          colorKey: clean(fields.colorKey, 40, 'other'),
          type: clean(fields.type, 20, 'spending'),
          budgetLimit: toPaise(Number(fields.budgetLimit) || 0),
        },
      });
      dispatch(envelopeSaved(saved));
    },

    updateEnvelope:
      ({ id, ...fields }) =>
      async (dispatch, getState) => {
        if (!selectIsHousehold(getState())) {
          dispatch(soloUpdateEnvelope({ id, ...fields }));
          return;
        }
        const ctx = household(getState);
        const saved = await api.request(`${ctx.base}/envelopes/${id}`, {
          method: 'PATCH',
          body: {
            categoryKey: clean(fields.categoryKey, 40, 'other'),
            icon: clean(fields.icon, 16, '🧾'),
            title: clean(fields.title, 40, 'Envelope'),
            colorKey: clean(fields.colorKey, 40, 'other'),
            type: clean(fields.type, 20, 'spending'),
            budgetLimit: toPaise(Number(fields.budgetLimit) || 0),
          },
        });
        dispatch(envelopeSaved(saved));
      },

    deleteEnvelope: (id) => async (dispatch, getState) => {
      if (!selectIsHousehold(getState())) {
        dispatch(soloDeleteEnvelope(id));
        return;
      }
      await api.request(`${household(getState).base}/envelopes/${id}`, { method: 'DELETE' });
      dispatch(envelopeRemoved(id));
    },

    // ---- income ----

    // Solo: the single monthly income figure. Household: the earner's own income source.
    // Spenders have no income (an earner sets aside an allowance for them instead).
    setMonthlyIncome: (rupees) => async (dispatch, getState) => {
      if (!selectIsHousehold(getState())) {
        dispatch(soloSetMonthlyIncome(rupees));
        return;
      }
      const ctx = household(getState);
      if (ctx.role === 'SPENDER') {
        throw new WriteError(
          'Spenders don’t have income. An earner can set aside an allowance for you.',
        );
      }
      const amount = paiseOf(rupees);
      const current = await api.request(`${ctx.base}/income`);
      const mine = current.sources.filter((s) => s.mine);
      if (mine.length > 1) {
        throw new WriteError(
          'You have more than one income source, so a single figure can’t replace them.',
        );
      }
      if (mine.length === 1) {
        await api.request(`${ctx.base}/income/${mine[0].id}`, { method: 'PATCH', body: { amount } });
      } else {
        await api.request(`${ctx.base}/income`, {
          method: 'POST',
          body: { label: 'Monthly income', amount },
        });
      }
      dispatch(incomeChanged(await api.request(`${ctx.base}/income`)));
    },
  };
}
