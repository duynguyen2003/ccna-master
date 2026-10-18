import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { api } from '../../../services/Api';
import Register from './Register';

const mockNavigate = jest.fn();
const mockShowToast = jest.fn();
const mockOpenGoogle = jest.fn();
const mockLogin = jest.fn();
const mockPendingToast = jest.fn();
let mockGoogleCallbacks;
const originalGoogleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, setPendingToast: mockPendingToast }),
}));
jest.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast, ToastComponent: null }),
}));
jest.mock('@react-oauth/google', () => ({ useGoogleLogin: jest.fn() }));
jest.mock('../../../services/Api', () => ({ api: { register: jest.fn(), googleLogin: jest.fn() } }));

beforeEach(() => {
  jest.resetAllMocks();
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

const enterDetails = (password = ' secret ') => {
  fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: ' Test Member ' } });
  fireEvent.change(screen.getByLabelText('Địa chỉ Email'), {
    target: { value: 'member@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu'), { target: { value: password } });
};

test('keeps all registration fields and independent accessible password toggles', () => {
  render(<Register />);
  expect(screen.getByLabelText('Họ và tên')).toHaveAttribute('name', 'fullName');
  expect(screen.getByLabelText('Họ và tên')).toHaveAttribute('autocomplete', 'name');
  expect(screen.getByLabelText('Địa chỉ Email')).toHaveAttribute('name', 'email');
  const password = screen.getByLabelText('Mật khẩu');
  const confirmation = screen.getByLabelText('Nhập lại mật khẩu');
  expect(password).toHaveAttribute('autocomplete', 'new-password');
  expect(confirmation).toHaveAttribute('autocomplete', 'new-password');
  enterDetails();
  fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
  expect(password).toHaveAttribute('type', 'text');
  expect(confirmation).toHaveAttribute('type', 'password');
  fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu xác nhận' }));
  expect(confirmation).toHaveAttribute('type', 'text');
  expect(password).toHaveValue(' secret ');
  expect(confirmation).toHaveValue(' secret ');
  expect(screen.getByRole('button', { name: 'Ẩn mật khẩu xác nhận' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(api.register).not.toHaveBeenCalled();
});

test('preserves submit-only validation, six-character minimum and matching confirmation', () => {
  render(<Register />);
  fireEvent.blur(screen.getByLabelText('Họ và tên'));
  expect(screen.queryByText('Vui lòng nhập họ tên')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /ĐĂNG KÝ/ }));
  expect(screen.getByLabelText('Họ và tên')).toHaveAccessibleDescription('Vui lòng nhập họ tên');
  expect(screen.getByLabelText('Địa chỉ Email')).toHaveAttribute('aria-invalid', 'true');
  enterDetails('12345');
  fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu'), { target: { value: 'different' } });
  fireEvent.click(screen.getByRole('button', { name: /ĐĂNG KÝ/ }));
  expect(screen.getByLabelText('Mật khẩu')).toHaveAccessibleDescription(
    'Mật khẩu phải có ít nhất 6 ký tự'
  );
  expect(screen.getByLabelText('Nhập lại mật khẩu')).toHaveAccessibleDescription(
    'Mật khẩu nhập lại không khớp'
  );
  expect(api.register).not.toHaveBeenCalled();
});

test('preserves exact payload, loading and the existing delayed redirect after success', async () => {
  jest.useFakeTimers();
  try {
    let finish;
    api.register.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    render(<Register />);
    enterDetails();
    const submit = screen.getByRole('button', { name: /ĐĂNG KÝ/ });
    fireEvent.click(submit);
    expect(api.register).toHaveBeenCalledWith('Test Member', 'member@example.com', ' secret ');
    expect(submit).toBeDisabled();
    await act(async () => finish({}));
    expect(submit).not.toBeDisabled();
    expect(mockShowToast).toHaveBeenCalledWith(
      'Đăng ký thành công! Đang chuyển đến trang đăng nhập...',
      'success'
    );
    expect(mockNavigate).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1500));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  } finally {
    jest.useRealTimers();
  }
});

test('retains backend errors and clears them when the user edits a field', async () => {
  api.register.mockRejectedValue(new Error('Email đã tồn tại'));
  render(<Register />);
  enterDetails();
  fireEvent.click(screen.getByRole('button', { name: /ĐĂNG KÝ/ }));
  expect(await screen.findByText('Email đã tồn tại')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Địa chỉ Email'), {
    target: { value: 'new@example.com' },
  });
  expect(screen.queryByText('Email đã tồn tại')).not.toBeInTheDocument();
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('preserves Google registration and its admin redirect', async () => {
  const user = { id: 5, role: 'ADMIN', fullName: 'Test Admin' };
  api.googleLogin.mockResolvedValue({ user, accessToken: 'test-access' });
  render(<Register />);
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập với Google' }));
  expect(mockOpenGoogle).toHaveBeenCalledTimes(1);
  await act(async () => mockGoogleCallbacks.onSuccess({ access_token: 'test-google-token' }));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard'));
  expect(api.googleLogin).toHaveBeenCalledWith('test-google-token');
  expect(mockLogin).toHaveBeenCalledWith(user, 'test-access');
  expect(mockPendingToast).toHaveBeenCalledWith({
    message: 'Xin chào, Test Admin! 👋',
    type: 'success',
  });
});
