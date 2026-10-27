import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CourseDetail from './CourseDetail';
import { api } from '../../../services/Api';
jest.mock('react-router-dom', () => ({
  useParams: () => ({ courseId: '1' }),
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams()],
  Link: ({ to, children, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ token: 'synthetic', isAuthenticated: true }),
}));
jest.mock('../../../services/Api', () => ({ api: { getCourses: jest.fn() } }));
beforeEach(() => {
  window.scrollTo = jest.fn();
  api.getCourses.mockResolvedValue([
    {
      id: '1',
      code: 'ITN',
      title: 'Khóa học IPv4',
      canAccess: true,
      modules: [
        {
          id: '2',
          title: 'Nền tảng mạng và IPv4',
          status: 'active',
          canAccess: true,
          lessons: [{ id: 11, title: 'Quan sát gói tin' }],
        },
      ],
    },
  ]);
});
test('exposes module expansion and lesson navigation as native keyboard controls', async () => {
  render(<CourseDetail />);
  const module = await screen.findByRole('button', { name: /Nền tảng mạng và IPv4/ });
  expect(module).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(module);
  expect(module).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('link', { name: /Quan sát gói tin/ })).toHaveAttribute(
    'href',
    '/lesson?course=1&lesson=11'
  );
  fireEvent.click(module);
  expect(module).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('link', { name: /Quan sát gói tin/ })).not.toBeInTheDocument();
});
