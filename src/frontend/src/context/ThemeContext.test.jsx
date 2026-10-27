import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
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
test('follows system changes until the learner chooses a theme and restores that choice', () => {
  const view = render(
    <ThemeProvider>
      <Toggle />
    </ThemeProvider>
  );
  const update = preference.addEventListener.mock.calls[0][1];
  act(() => {
    preference.matches = true;
    update();
  });
  expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'dark' }));
  expect(localStorage.getItem('netmaster-theme')).toBe('light');
  view.unmount();
  render(
    <ThemeProvider>
      <Toggle />
    </ThemeProvider>
  );
  expect(screen.getByRole('button', { name: 'light' })).toBeInTheDocument();
});
