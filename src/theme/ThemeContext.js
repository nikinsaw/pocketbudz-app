import React, { createContext, useContext, useMemo, useState } from 'react';
import { darkTheme, lightTheme } from './palettes';

const ThemeContext = createContext(undefined);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);

  const value = useMemo(
    () => ({
      isDark,
      colors: isDark ? darkTheme : lightTheme,
      toggleTheme: () => setIsDark((prev) => !prev),
      setIsDark,
    }),
    [isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
