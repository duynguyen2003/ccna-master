import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from '../scripts/test-text-encoding.cjs';

global.TextEncoder = TextEncoder;
window.scrollTo = jest.fn();
global.TextDecoder = TextDecoder;
let mockAuth;
const mockLoads = { admin: 0, profile: 0 };
jest.mock('react-router-dom', () => jest.requireActual('react-router'));
jest.mock('./context/AuthContext', () => ({
  AuthContext: require('react').createContext(null),
  useAuth: () => mockAuth,
}));
jest.mock('./components/layout/Layout', () => ({ children }) => <main>{children}</main>);
jest.mock('./features/home/pages/Home', () => () => <h1>Trang chủ thử</h1>);
jest.mock('./features/auth/pages/Login', () => () => <h1>Đăng nhập thử</h1>);
jest.mock('./features/profile/pages/Profile', () => {
  mockLoads.profile++;
  return () => <h1>Hồ sơ thử</h1>;
});
jest.mock('./features/admin/AdminRoutes', () => {
  mockLoads.admin++;
  return () => <h1>Quản trị thử</h1>;
});
const App = require('./App').default;
const { AuthContext } = require('./context/AuthContext');

function open(path, role = null) {
  cleanup();
  window.history.replaceState(null, '', path);
  mockAuth = {
    loading: false,
    isAuthenticated: !!role,
    user: role ? { role } : null,
    pendingToast: null,
    setPendingToast: jest.fn(),
  };
  return render(
    <AuthContext.Provider value={mockAuth}>
      <App />
    </AuthContext.Provider>
  );
}

test('loads protected route modules only after authentication and role checks pass', async () => {
  open('/');
  expect(screen.getByRole('heading', { name: 'Trang chủ thử' })).toBeInTheDocument();
  expect(mockLoads).toEqual({ admin: 0, profile: 0 });

  open('/profile');
  expect(await screen.findByRole('heading', { name: 'Đăng nhập thử' })).toBeInTheDocument();
  expect(mockLoads).toEqual({ admin: 0, profile: 0 });

  open('/admin/dashboard', 'STUDENT');
  expect(await screen.findByRole('heading', { name: 'Trang chủ thử' })).toBeInTheDocument();
  expect(mockLoads.admin).toBe(0);

  open('/profile', 'STUDENT');
  expect(await screen.findByRole('heading', { name: 'Hồ sơ thử' })).toBeInTheDocument();
  expect(mockLoads).toEqual({ admin: 0, profile: 1 });

  open('/admin/dashboard', 'ADMIN');
  expect(await screen.findByRole('heading', { name: 'Quản trị thử' })).toBeInTheDocument();
  expect(mockLoads.admin).toBe(1);
});

test('renders the matching page when browser history moves back and forward', async () => {
  open('/', 'STUDENT');
  act(() => {
    window.history.pushState({}, '', '/profile');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(await screen.findByRole('heading', { name: 'Hồ sơ thử' })).toBeInTheDocument();
  act(() => window.history.back());
  expect(await screen.findByRole('heading', { name: 'Trang chủ thử' })).toBeInTheDocument();
  act(() => window.history.forward());
  expect(await screen.findByRole('heading', { name: 'Hồ sơ thử' })).toBeInTheDocument();
});
