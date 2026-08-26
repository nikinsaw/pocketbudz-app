// Content reviewed and approved by the user before this was wired to
// anything — see the onboarding question-bank proposal in conversation.
// colorKey values must match a real token in theme/palettes.js.

// Always present, regardless of answers — common to virtually every user.
export const BASE_CATEGORIES = [
  { key: 'groceries', label: 'Groceries', icon: '🛒', colorKey: 'groceries' },
  { key: 'diningOut', label: 'Dining Out', icon: '🍴', colorKey: 'dining' },
  { key: 'shopping', label: 'Shopping', icon: '🛍️', colorKey: 'giftsJewelry' },
  { key: 'utilities', label: 'Utilities', icon: '💡', colorKey: 'utilities' },
  { key: 'other', label: 'Other', icon: '🧾', colorKey: 'householdSupplies' },
];

// Each question is single-select; `category: null` means "add nothing."
export const CATEGORY_QUESTIONS = [
  {
    id: 'housing',
    question: 'How do you handle housing costs?',
    options: [
      {
        label: 'I pay rent',
        category: { key: 'rent', label: 'Rent', icon: '🏠', colorKey: 'householdSupplies' },
      },
      {
        label: 'I own my home and pay maintenance',
        category: {
          key: 'maintenance',
          label: 'Maintenance',
          icon: '🏢',
          colorKey: 'householdSupplies',
        },
      },
      { label: 'I live with family / no housing cost', category: null },
    ],
  },
  {
    id: 'education',
    question: 'Do you pay school or college fees for children or dependents?',
    options: [
      {
        label: 'Yes',
        category: { key: 'schoolFees', label: 'School Fees', icon: '🎓', colorKey: 'familySupport' },
      },
      { label: 'No', category: null },
    ],
  },
  {
    id: 'householdHelp',
    question: 'Do you pay for household help (cook, maid, driver, etc.)?',
    options: [
      {
        label: 'Yes',
        category: {
          key: 'householdHelp',
          label: 'Household Help',
          icon: '🧹',
          colorKey: 'householdHelp',
        },
      },
      { label: 'No', category: null },
    ],
  },
  {
    id: 'transport',
    question: 'How do you mainly get around?',
    options: [
      {
        label: 'I own a vehicle',
        category: { key: 'vehicle', label: 'Vehicle & Fuel', icon: '🚗', colorKey: 'travel' },
      },
      {
        label: 'Public transport / cabs',
        category: { key: 'transport', label: 'Transport', icon: '🚌', colorKey: 'travel' },
      },
      {
        label: 'Both',
        category: { key: 'transport', label: 'Transport', icon: '🚌', colorKey: 'travel' },
      },
    ],
  },
  {
    id: 'loans',
    question: 'Any recurring loan EMIs — home, car, or personal?',
    options: [
      {
        label: 'Yes',
        category: { key: 'loanEmi', label: 'Loan EMI', icon: '🏦', colorKey: 'utilities' },
      },
      { label: 'No', category: null },
    ],
  },
  {
    id: 'familySupport',
    question: 'Do you regularly send money to support family?',
    options: [
      {
        label: 'Yes',
        category: {
          key: 'familySupport',
          label: 'Family Support',
          icon: '❤️',
          colorKey: 'familySupport',
        },
      },
      { label: 'No', category: null },
    ],
  },
  {
    id: 'subscriptions',
    question: 'Track subscriptions (streaming, gym, etc.) as their own category?',
    options: [
      {
        label: 'Yes',
        category: {
          key: 'subscriptions',
          label: 'Subscriptions',
          icon: '📺',
          colorKey: 'personalCare',
        },
      },
      { label: 'No, lump into Other', category: null },
    ],
  },
];

export const CURRENCY_FORMATS = [
  { key: 'indian', label: 'Indian (₹ Lakhs)', example: '₹1,00,000' },
  { key: 'international', label: 'International (₹ Thousands)', example: '₹100,000' },
];

export const CYCLE_START_OPTIONS = [
  { key: 1, label: '1st of the month' },
  { key: 5, label: '5th of the month' },
  { key: 15, label: '15th of the month' },
  { key: 25, label: '25th of the month' },
];
