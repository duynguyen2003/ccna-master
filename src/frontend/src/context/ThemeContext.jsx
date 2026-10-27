import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const systemTheme = () =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
function initialTheme() {
  try {
    const saved = localStorage.getItem('netmaster-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return systemTheme();
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);
  const [followSystem, setFollowSystem] = useState(() => {
    try {
      return !['light', 'dark'].includes(localStorage.getItem('netmaster-theme'));
    } catch {
      return true;
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    if (!followSystem || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setTheme(query.matches ? 'dark' : 'light');
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, [followSystem]);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setFollowSystem(false);
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
