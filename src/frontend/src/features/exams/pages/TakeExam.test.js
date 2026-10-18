import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TakeExam from './TakeExam';
import { api } from '../../../services/Api';

let mockAuth;
const mockNavigate = jest.fn();
const mockToast = jest.fn();
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('react-router-dom', () => ({
  useParams: () => ({ examId: '7' }),
  useNavigate: () => mockNavigate,
}));
jest.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ showToast: mockToast, ToastComponent: null }),
}));
jest.mock('../../../services/Api', () => ({
  api: { startExamAttempt: jest.fn(), getExamAttempt: jest.fn(), submitExam: jest.fn() },
}));
const attempt = () => ({
  id: 'attempt-a',
  serverTime: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60000).toISOString(),
  exam: {
    title: 'Exam',
    questions: [{ id: 41, question: 'Question A', options: ['Alpha', 'Beta'], answerCount: 1 }],
  },
});
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockAuth = { user: { id: 1 }, token: 'token-a', isAuthenticated: true, loading: false };
  api.startExamAttempt.mockImplementation(async () => attempt());
});
test('network failure retains the draft and retry submits the same attempt', async () => {
  api.submitExam
    .mockRejectedValueOnce(new Error('Network unavailable'))
    .mockResolvedValueOnce({ resultId: 12 });
  render(<TakeExam />);
  await screen.findByText('Question A');
  fireEvent.click(screen.getByText('Beta'));
  fireEvent.click(screen.getByText('Nộp bài thi ✓'));
  fireEvent.click(screen.getByText('Nộp bài ✓'));
  await waitFor(() => expect(mockToast).toHaveBeenCalled());
  expect(JSON.parse(localStorage.getItem('ccna_exam_session_1_7')).userAnswers).toEqual({
    41: [1],
  });
  fireEvent.click(screen.getByText('Nộp bài thi ✓'));
  fireEvent.click(screen.getByText('Nộp bài ✓'));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/exam/result/12'));
  expect(api.submitExam).toHaveBeenLastCalledWith('token-a', '7', 'attempt-a', { 41: [1] });
  expect(localStorage.getItem('ccna_exam_session_1_7')).toBeNull();
});
test('switching accounts uses a separate attempt and draft', async () => {
  localStorage.setItem(
    'ccna_exam_session_1_7',
    JSON.stringify({ attemptId: 'attempt-a', userAnswers: { 41: [1] } })
  );
  api.getExamAttempt.mockResolvedValue(attempt());
  const view = render(<TakeExam />);
  await screen.findByText('Question A');
  mockAuth = { ...mockAuth, user: { id: 2 }, token: 'token-b' };
  api.startExamAttempt.mockResolvedValue({ ...attempt(), id: 'attempt-b' });
  view.rerender(<TakeExam />);
  await waitFor(() => expect(api.startExamAttempt).toHaveBeenCalledWith('token-b', '7'));
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem('ccna_exam_session_2_7')).userAnswers).toEqual({})
  );
  expect(JSON.parse(localStorage.getItem('ccna_exam_session_1_7')).userAnswers).toEqual({
    41: [1],
  });
});
test('reload resumes server deadline and ignores a locally extended timer', async () => {
  localStorage.setItem(
    'ccna_exam_session_1_7',
    JSON.stringify({ attemptId: 'attempt-a', userAnswers: {}, timeLeft: 999999 })
  );
  api.getExamAttempt.mockResolvedValue({
    ...attempt(),
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  });
  render(<TakeExam />);
  await screen.findByRole('alert');
  expect(api.startExamAttempt).not.toHaveBeenCalled();
  expect(api.submitExam).not.toHaveBeenCalled();
});
