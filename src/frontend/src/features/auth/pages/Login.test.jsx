import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { api } from '../../../services/Api';
import Login from './Login';

const mockNavigate = jest.fn();
const mockOpenGoogle = jest.fn();
let mockLocation;
let mockAuth;
let mockGoogleCallbacks;
const originalGoogleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../../components/ui/Toast', () => ({ useToast: () => ({ ToastComponent: null }) }));
jest.mock('@react-oauth/google', () => ({ useGoogleLogin: jest.fn() }));
jest.mock('../../../services/Api', () => ({
  api: { login: jest.fn(), googleLogin: jest.fn() },
}));

beforeEach(() => {
  jest.resetAllMocks();
  mockLocation = { state: null };
  mockAuth = { login: jest.fn(), setPendingToast: jest.fn() };
  process.env.REACT_APP_GOOGLE_CLIENT_ID = 'test-google-client';
  useGoogleLogin.mockImplementation((options) => {
    mockGoogleCallbacks = options;
    return mockOpenGoogle;
  });
});

afterAll(() => {
  if (originalGoogleClientId === undefined) delete process.env.REACT_APP_GOOGLE_CLIENT_ID;
  else process.env.REACT_APP_GOOGLE_CLIENT_ID = originalGoogleClientId;
});

const enterCredentials = (password = ' x ') => {
  fireEvent.change(screen.getByLabelText('Địa chỉ Email'), {
    target: { value: 'member@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: password } });
};

test('keeps only email/password inputs and an accessible reveal button without changing values', () => {
  render(<Login />);
  const email = screen.getByLabelText('Địa chỉ Email');
  const password = screen.getByLabelText('Mật khẩu');
  expect(email).toHaveAttribute('name', 'email');
  expect(email).toHaveAttribute('autocomplete', 'email');
  expect(password).toHaveAttribute('name', 'password');
  expect(password).toHaveAttribute('autocomplete', 'current-password');
  expect(password).toHaveAttribute('type', 'password');
  expect(screen.queryByLabelText(/Họ và tên|Name|Nhập lại mật khẩu/i)).not.toBeInTheDocument();

  fireEvent.change(password, { target: { value: ' unchanged password ' } });
  const reveal = screen.getByRole('button', { name: 'Hiện mật khẩu' });
  expect(reveal).not.toHaveAttribute('tabindex', '-1');
  fireEvent.click(reveal);
  expect(password).toHaveAttribute('type', 'text');
  expect(password).toHaveValue(' unchanged password ');
  expect(screen.getByRole('button', { name: 'Ẩn mật khẩu' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
  expect(password).toHaveAttribute('type', 'password');
  expect(api.login).not.toHaveBeenCalled();
});

test('preserves submit-only validation and associates the existing errors with the inputs', () => {
  render(<Login />);
  const email = screen.getByLabelText('Địa chỉ Email');
  fireEvent.blur(email);
  expect(screen.queryByText('Vui lòng nhập email')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /ĐĂNG NHẬP/ }));
  expect(email).toHaveAttribute('aria-invalid', 'true');
  expect(email).toHaveAccessibleDescription('Vui lòng nhập email');
  expect(screen.getByLabelText('Mật khẩu')).toHaveAccessibleDescription('Vui lòng nhập mật khẩu');

  fireEvent.change(email, { target: { value: 'invalid-email' } });
  fireEvent.blur(email);
  expect(email).toHaveAttribute('aria-invalid', 'false');
  expect(screen.queryByText('Email không đúng định dạng')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /ĐĂNG NHẬP/ }));
  expect(email).toHaveAccessibleDescription('Email không đúng định dạng');
  expect(api.login).not.toHaveBeenCalled();
});

test('submits unchanged credentials, preserves loading behavior and returns students to their destination', async () => {
  let finishLogin;
  api.login.mockReturnValue(
    new Promise((resolve) => {
      finishLogin = resolve;
    })
  );
  mockLocation.state = { from: '/lesson?course=ITN' };
  render(<Login />);
  enterCredentials();
  const submit = screen.getByRole('button', { name: /ĐĂNG NHẬP/ });
  fireEvent.click(submit);
  expect(api.login).toHaveBeenCalledWith('member@example.com', ' x ');
  expect(submit).toBeDisabled();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Địa chỉ Email')).not.toBeDisabled();

  const user = { id: 7, role: 'STUDENT', fullName: 'Test Student' };
  await act(async () => finishLogin({ user, accessToken: 'test-access-token' }));
  expect(mockAuth.login).toHaveBeenCalledWith(user, 'test-access-token');
  expect(mockAuth.setPendingToast).toHaveBeenCalledWith({
    message: 'Xin chào, Test Student! 👋',
    type: 'success',
  });
  expect(mockNavigate).toHaveBeenCalledWith('/lesson?course=ITN');
  expect(submit).not.toBeDisabled();
});

test('retains the admin redirect', async () => {
  const user = { role: 'ADMIN', fullName: 'Test Admin' };
  api.login.mockResolvedValue({ user, accessToken: 'test-admin-token' });
  render(<Login />);
  enterCredentials();
  fireEvent.click(screen.getByRole('button', { name: /ĐĂNG NHẬP/ }));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin'));
});

test('shows the existing backend error and clears it when editing a credential', async () => {
  api.login.mockRejectedValue(new Error('Thông tin đăng nhập không đúng'));
  render(<Login />);
  enterCredentials();
  fireEvent.click(screen.getByRole('button', { name: /ĐĂNG NHẬP/ }));
  expect(await screen.findByText('Thông tin đăng nhập không đúng')).toBeInTheDocument();
  expect(mockAuth.login).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'edited' } });
  expect(screen.queryByText('Thông tin đăng nhập không đúng')).not.toBeInTheDocument();
});

test('keeps the Google flow and its existing return-path handling', async () => {
  const user = { role: 'STUDENT', fullName: 'Google Student' };
  api.googleLogin.mockResolvedValue({ user, accessToken: 'test-google-access' });
  mockLocation.state = { from: { pathname: '/roadmap' } };
  render(<Login />);
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập với Google' }));
  expect(mockOpenGoogle).toHaveBeenCalledTimes(1);
  await act(async () => mockGoogleCallbacks.onSuccess({ access_token: 'test-google-response' }));
  expect(api.googleLogin).toHaveBeenCalledWith('test-google-response');
  expect(mockAuth.login).toHaveBeenCalledWith(user, 'test-google-access');
  expect(mockNavigate).toHaveBeenCalledWith('/roadmap');
});
