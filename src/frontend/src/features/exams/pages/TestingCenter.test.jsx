import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TestingCenter from './TestingCenter';
import { api } from '../../../services/Api';

const mockNavigate = jest.fn();
const mockShowToast = jest.fn();
let mockAuth;

jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast, ToastComponent: null }),
}));
jest.mock('../../../services/Api', () => ({
  api: { getCourses: jest.fn(), getExams: jest.fn(), getMyExamHistory: jest.fn() },
}));

const exam = { id: 7, title: 'Đề ôn tập mạng', totalQuestions: 10, durationMinutes: 15 };
const courses = [{ code: 'ITN', modules: [{ id: 2, title: 'Mạng cơ bản', exams: [exam] }] }];
const deferred = () => {
  let resolve;
  const promise = new Promise((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
};

beforeEach(() => {
  jest.resetAllMocks();
  mockAuth = { token: 'test-token', isAuthenticated: true };
  api.getCourses.mockResolvedValue(courses);
  api.getExams.mockResolvedValue([exam]);
  api.getMyExamHistory.mockResolvedValue([]);
});

test('shows only page loading until all required data arrives, then enables exam navigation', async () => {
  const courseRequest = deferred();
  const examRequest = deferred();
  const historyRequest = deferred();
  api.getCourses.mockReturnValue(courseRequest.promise);
  api.getExams.mockReturnValue(examRequest.promise);
  api.getMyExamHistory.mockReturnValue(historyRequest.promise);

  render(<TestingCenter />);
  expect(screen.getByRole('status')).toHaveTextContent('Đang tải danh sách kỳ thi...');
  expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Luyện tập theo chương' })).not.toBeInTheDocument();
  expect(screen.queryByText('Chưa có bài tập luyện tập')).not.toBeInTheDocument();

  await act(async () => courseRequest.resolve(courses));
  expect(api.getExams).toHaveBeenCalledWith('test-token');
  expect(screen.getByRole('status')).toBeInTheDocument();
  await act(async () => examRequest.resolve([exam]));
  expect(api.getMyExamHistory).toHaveBeenCalledWith('test-token');
  expect(screen.queryByText(exam.title)).not.toBeInTheDocument();
  await act(async () => historyRequest.resolve([]));

  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Trung tâm Kiểm tra & Đánh giá'
  );
  expect(screen.getByText(exam.title)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Làm bài' }));
  expect(mockNavigate).toHaveBeenCalledWith('/exam/take/7');
});

test('preserves the guest exam tabs and login redirect after loading', async () => {
  mockAuth = { token: null, isAuthenticated: false };
  render(<TestingCenter />);
  await screen.findByRole('heading', { level: 1 });
  expect(api.getMyExamHistory).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Thi thử CCNA' }));
  fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu thi' }));
  expect(mockNavigate).toHaveBeenCalledWith('/login', { state: { from: '/exam/take/7' } });
  expect(mockShowToast).toHaveBeenCalledWith('Vui lòng đăng nhập để bắt đầu làm bài thi.', 'info');
});

test('leaves loading after a failed request and keeps the existing empty state', async () => {
  const logError = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    api.getCourses.mockRejectedValue(new Error('Không kết nối được API'));
    render(<TestingCenter />);
    await screen.findByText('Chưa có bài tập luyện tập');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  } finally {
    logError.mockRestore();
  }
});
