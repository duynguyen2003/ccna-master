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

test('locked lesson in the course list exposes a reason and has no navigable href', async () => {
  const courses = await api.getCourses();
  courses[0].modules[0].lessons.push({
    id: 12,
    title: 'Bài chưa mở',
    canAccess: false,
    lockedReason: 'Xem ít nhất 70% bài trước.',
  });
  render(<CourseDetail />);
  fireEvent.click(await screen.findByRole('button', { name: /Nền tảng mạng và IPv4/ }));
  const locked = screen.getByRole('link', { name: /Bài chưa mở.*70%/ });
  expect(locked).toHaveAttribute('aria-disabled', 'true');
  expect(locked).not.toHaveAttribute('href');
  expect(locked).toHaveAttribute('title', 'Xem ít nhất 70% bài trước.');
});
