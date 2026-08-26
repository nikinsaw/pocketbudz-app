// All colors the app can ever render, grouped by theme. Components never
// hardcode a color — they read it from ThemeContext so switching themes
// updates every screen at once.

const shared = {
  avatarBg: '#BFD9F2',
  white: '#FFFFFF',
  gradientStart: '#1FBBA6',
  gradientEnd: '#0E6E68',
  onGradientMuted: 'rgba(255,255,255,0.75)',
  trackLight: 'rgba(255,255,255,0.35)',
  streakPill: 'rgba(255,255,255,0.18)',
  dining: '#FF6B81',
  groceries: '#4CD7F6',
  travel: '#FFB199',
  utilities: '#F4C95D',
  householdHelp: '#A0785A',
  familySupport: '#B79CED',
  giftsJewelry: '#E893C4',
  healthMedical: '#6FCF97',
  personalCare: '#E6A4B4',
  householdSupplies: '#8C9BB5',
  successTint: 'rgba(31,187,166,0.16)',
  successIconBg: '#0E6E68',
  warningTint: 'rgba(255,107,129,0.14)',
  warningBorder: 'rgba(255,107,129,0.55)',
  pillBg: 'rgba(76,215,246,0.18)',
  onTrack: '#2FE0B0',
  // Soft icon-background tint per category colorKey, for transaction Recent
  // Activity rows — one per solid category color above. diningTint and
  // groceriesTint intentionally match warningTint/pillBg's existing values
  // rather than introducing a near-duplicate shade.
  diningTint: 'rgba(255,107,129,0.14)',
  groceriesTint: 'rgba(76,215,246,0.18)',
  travelTint: 'rgba(255,177,153,0.18)',
  utilitiesTint: 'rgba(244,201,93,0.18)',
  householdHelpTint: 'rgba(160,120,90,0.18)',
  familySupportTint: 'rgba(183,156,237,0.18)',
  giftsJewelryTint: 'rgba(232,147,196,0.18)',
  healthMedicalTint: 'rgba(111,207,151,0.18)',
  personalCareTint: 'rgba(230,164,180,0.18)',
  householdSuppliesTint: 'rgba(140,155,181,0.18)',
};

export const darkTheme = {
  ...shared,
  background: '#0B1A2B',
  card: '#16283D',
  cardBorder: '#22374E',
  text: '#FFFFFF',
  textMuted: '#9AA9B8',
  textDim: 'rgba(255,255,255,0.7)',
  trackDark: 'rgba(255,255,255,0.12)',
  teal: '#4CD7F6',
};

export const lightTheme = {
  ...shared,
  background: '#F5F7FB',
  card: '#FFFFFF',
  cardBorder: '#E3E7F0',
  text: '#0B1A2B',
  textMuted: '#5B6B7A',
  textDim: 'rgba(11,26,43,0.65)',
  trackDark: 'rgba(11,26,43,0.08)',
  teal: '#00687A',
};
