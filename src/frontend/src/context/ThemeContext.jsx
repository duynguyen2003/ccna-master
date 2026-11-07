import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { runThemeTransition } from '../components/ui/themeTransition';

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
  const choice = useRef(theme);
  const dispose = useRef(null);
  useEffect(() => () => dispose.current?.(), []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const toggleTheme = (origin) => {
    const next = choice.current === 'dark' ? 'light' : 'dark';
    choice.current = next;
    try {
      localStorage.setItem('netmaster-theme', next);
    } catch {}
    dispose.current = runThemeTransition(
      () => {
        document.documentElement.dataset.theme = next;
        setTheme(next);
      },
      origin,
      next
    );
  };
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
