import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
function initialTheme() {
  try {
    const saved = localStorage.getItem('netmaster-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('netmaster-theme', next);
    } catch {}
  };
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
