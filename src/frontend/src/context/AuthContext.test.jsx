import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from './AuthContext';
jest.mock('../services/Api', () => ({ api: { logout: jest.fn() } }));
function Session() {
  const auth = useAuth();
  return <p>{auth.loading ? 'loading' : auth.isAuthenticated ? auth.user.fullName : 'guest'}</p>;
}
beforeEach(() => localStorage.clear());
test('restores a valid local session without requesting the backend', () => {
  localStorage.setItem(
    'accessToken',
    'x.' + btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 })) + '.synthetic'
  );
  localStorage.setItem('userData', JSON.stringify({ fullName: 'Học viên' }));
  render(
    <AuthProvider>
      <Session />
    </AuthProvider>
  );
  expect(screen.getByText('Học viên')).toBeInTheDocument();
});
test('discards expired sessions before protected content can render', () => {
  localStorage.setItem('accessToken', 'x.' + btoa(JSON.stringify({ exp: 1 })) + '.synthetic');
  localStorage.setItem('userData', '{}');
  render(
    <AuthProvider>
      <Session />
    </AuthProvider>
  );
  expect(screen.getByText('guest')).toBeInTheDocument();
  expect(localStorage.getItem('accessToken')).toBeNull();
});
test('public UI still renders when browser storage is unavailable', () => {
  const storage = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  render(
    <AuthProvider>
      <Session />
    </AuthProvider>
  );
  expect(screen.getByText('guest')).toBeInTheDocument();
  storage.mockRestore();
});
