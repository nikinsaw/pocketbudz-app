import { createSlice } from '@reduxjs/toolkit';

// tint references a theme token (pillBg / successTint / warningTint),
// resolved at render time so icon backgrounds stay theme-aware.
const initialState = {
  items: [
    { name: 'Blue Tokai', subtitle: 'Today, 9:41 AM', amount: '350', icon: '☕', tint: 'teal' },
    { name: 'Blinkit', subtitle: 'Yesterday, 6:20 PM', amount: '820', icon: '🛍️', tint: 'success' },
    { name: 'Netflix', subtitle: '12 Oct', amount: '649', icon: '📺', tint: 'warning' },
  ],
};

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {},
});

export default transactionsSlice.reducer;
