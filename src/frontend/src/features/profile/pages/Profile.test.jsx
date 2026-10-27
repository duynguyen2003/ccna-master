import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Profile from './Profile';
import { api } from '../../../services/Api';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ token: 'synthetic' }) }));
jest.mock('../../../services/Api', () => ({
  api: { getUserProfile: jest.fn(), getStudyTimeStats: jest.fn() },
  API_URL: '/api',
}));
const profile = {
  fullName: 'Học viên',
  stats: { labsDone: 2 },
  activities: [],
  badges: [],
  progress: [],
  weeklyScores: [],
};

beforeEach(() => {
  jest.resetAllMocks();
  api.getStudyTimeStats.mockResolvedValue([]);
});

test('shows a recoverable profile error instead of an empty page', async () => {
  api.getUserProfile.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(profile);
  render(<Profile />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được hồ sơ');
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại', exact: true }));
  expect(await screen.findByRole('heading', { name: /Xin chào, Học viên/ })).toBeInTheDocument();
  expect(api.getUserProfile).toHaveBeenCalledTimes(2);
  expect(screen.queryByText('/ 50')).not.toBeInTheDocument();
});

test('retries the chart independently without reloading the profile', async () => {
  api.getUserProfile.mockResolvedValue(profile);
  api.getStudyTimeStats.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  render(<Profile />);
  fireEvent.click(await screen.findByRole('button', { name: 'Thử lại biểu đồ' }));
  expect(await screen.findByText('Chưa có dữ liệu học tập trong khoảng này.')).toBeInTheDocument();
  expect(api.getUserProfile).toHaveBeenCalledTimes(1);
  expect(api.getStudyTimeStats).toHaveBeenCalledTimes(2);
});
