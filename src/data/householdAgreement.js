// The Household Mode agreement shown before creating or joining a household.
//
// DRAFT - have this reviewed (privacy law, e.g. India's DPDP Act) before release.
//
// AGREEMENT_VERSION must equal CONSENT_VERSION in backend/src/households/service.ts:
// the server refuses a create/join that doesn't carry the version it expects, and it
// records that version with the time of acceptance. Change the text => bump BOTH
// (a test in __tests__/householdAgreement.test.js fails if they drift apart).
export const AGREEMENT_VERSION = '2026-10-v1';

export const AGREEMENT_TITLE = 'Household Mode agreement';

export const AGREEMENT_SECTIONS = [
  {
    heading: 'What changes',
    body: [
      'Normally everything in PocketBudz stays on your phone. Household Mode is optional: it uploads your budget data to a PocketBudz server so the people in your household can budget together.',
      'You can leave Household Mode at any time.',
    ],
  },
  {
    heading: 'What we store',
    body: [
      'Your Google name and email address.',
      'Your household name and its members.',
      'Envelopes and their budgets, and transactions you add or import (merchant, category, amount and date).',
      'If you are an earner or owner: the income you enter.',
      'Your sharing choices and the agreement version you accepted, with the time you accepted it.',
    ],
  },
  {
    heading: 'Who can see what',
    body: [
      'Everyone in the household sees shared envelopes and the spending in them, including who spent it.',
      'Your personal spending is yours. For each person in the household you choose: nothing, total only, or full details.',
      'Owners and earners always see the total of what each member spends, so the household budget adds up. They only see details you choose to share.',
      'Income is visible to owners and earners only. Spenders cannot see it.',
      'Changing a sharing choice applies to spending you add afterwards. It does not change what was already shared.',
    ],
  },
  {
    heading: 'Leaving and deleting',
    body: [
      'When you leave or are removed, your name is detached from your past spending. It stays in the household as anonymous totals so everyone else’s numbers remain correct, but its details (like merchant names) can no longer be read.',
      'Your personal envelopes, income entries, allowances and sharing choices are deleted.',
      'You can download your data, and you can delete your account. Deleting erases your name, email and sign-in; only the anonymous totals above remain in the household.',
    ],
  },
  {
    heading: 'Your responsibilities',
    body: [
      'Only invite people you trust. Anyone with an invite code can join as the role it was created for.',
      'Household owners can remove members and change earner and spender roles.',
    ],
  },
];

// Short promises for the intro screen, before the full text.
export const AGREEMENT_HIGHLIGHTS = [
  { icon: '👨‍👩‍👧', text: 'Budget together with family: shared envelopes, one household view.' },
  { icon: '🔒', text: 'Your personal spending stays private unless you choose to share it.' },
  { icon: '🚪', text: 'Leave or delete your account any time.' },
];
