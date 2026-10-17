import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExamResult from './ExamResult';
import ReviewExam from './ReviewExam';
import { api } from '../../../services/Api';
let mockToken;
const mockNavigate = jest.fn();
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ token: mockToken }) }));
jest.mock('react-router-dom', () => ({
  useParams: () => ({ resultId: '12', examId: '7' }),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: '?resultId=12' }),
}));
jest.mock('../../../services/Api', () => ({ api: { getExamResult: jest.fn() } }));
const result = {
  score: 1000,
  totalQuestions: 1,
  percentage: 100,
  isPassed: true,
  timeSpent: 5,
  takenAt: '2026-10-15T00:00:00Z',
  answers: { 41: [1] },
  exam: {
    id: 7,
    title: 'Private exam A',
    passingScore: 70,
    questions: [
      {
        id: 41,
        question: 'Original snapshot question',
        options: ['Alpha', 'Beta'],
        correctAnswer: [1],
        explanation: 'Original explanation',
      },
    ],
  },
};
beforeEach(() => {
  jest.clearAllMocks();
  mockToken = 'account-a';
});
test('result state clears immediately on account switch and cannot show another account data', async () => {
  api.getExamResult.mockResolvedValueOnce(result).mockRejectedValueOnce(new Error('Not found'));
  const view = render(<ExamResult />);
  await screen.findByText('Kết Quả Thi Private exam A');
  mockToken = 'account-b';
  view.rerender(<ExamResult />);
  expect(screen.queryByText('Kết Quả Thi Private exam A')).not.toBeInTheDocument();
  await screen.findByText('Không tìm thấy kết quả');
  expect(api.getExamResult).toHaveBeenLastCalledWith('account-b', '12');
});
test('review reload fetches the owned historical snapshot through resultId in URL', async () => {
  api.getExamResult.mockResolvedValueOnce(result).mockRejectedValueOnce(new Error('Not found'));
  const view = render(<ReviewExam />);
  await screen.findByText('Original snapshot question');
  expect(api.getExamResult).toHaveBeenCalledWith('account-a', '12');
  mockToken = 'account-b';
  view.rerender(<ReviewExam />);
  expect(screen.queryByText('Original snapshot question')).not.toBeInTheDocument();
  await screen.findByText('Not found');
});
