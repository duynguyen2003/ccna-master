import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, useTheme } from './ThemeContext';
let preference;
const originalMatchMedia = window.matchMedia;
function Toggle() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>{theme}</button>;
}
beforeEach(() => {
  localStorage.clear();
  preference = { matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() };
  window.matchMedia = () => preference;
});
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});
test('new visitors start in light even when the operating system is dark', () => {
  preference.matches = true;
  render(
    <ThemeProvider>
      <Toggle />
    </ThemeProvider>
  );
  expect(screen.getByRole('button', { name: 'light' })).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  expect(preference.addEventListener).not.toHaveBeenCalled();
});

test('an explicit theme choice is saved and restored', () => {
  const view = render(
    <ThemeProvider>
      <Toggle />
    </ThemeProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'light' }));
  expect(localStorage.getItem('netmaster-theme')).toBe('dark');
  view.unmount();
  render(
    <ThemeProvider>
      <Toggle />
    </ThemeProvider>
  );
  expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument();
});

test.each(['light', 'dark'])('a saved %s preference takes priority over the default', (saved) => {
  localStorage.setItem('netmaster-theme', saved);
  preference.matches = saved !== 'dark';
  render(
    <ThemeProvider>
      <Toggle />
    </ThemeProvider>
  );
  expect(screen.getByRole('button', { name: saved })).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute('data-theme', saved);
});

test('an invalid saved preference falls back to light', () => {
  localStorage.setItem('netmaster-theme', 'auto');
  preference.matches = true;
  render(
    <ThemeProvider>
      <Toggle />
    </ThemeProvider>
  );
  expect(screen.getByRole('button', { name: 'light' })).toBeInTheDocument();
});

test('blocked storage still defaults to light and allows a theme change', () => {
  const read = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  try {
    preference.matches = true;
    render(
      <ThemeProvider>
        <Toggle />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'light' }));
    expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument();
  } finally {
    read.mockRestore();
    write.mockRestore();
  }
});
