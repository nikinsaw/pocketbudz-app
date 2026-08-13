// All colors the app can ever render, grouped by theme. Components never
// hardcode a color — they read it from ThemeContext so switching themes
// updates every screen at once.

const shared = {
  headerBackground: '#D8DAE6',
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
  housing: '#8C9BB5',
  successTint: 'rgba(31,187,166,0.16)',
  successIconBg: '#0E6E68',
  warningTint: 'rgba(255,107,129,0.14)',
  warningBorder: 'rgba(255,107,129,0.55)',
  pillBg: 'rgba(76,215,246,0.18)',
  onTrack: '#2FE0B0',
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
