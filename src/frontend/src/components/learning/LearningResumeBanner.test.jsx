import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LearningResumeBanner from './LearningResumeBanner';
import { api } from '../../services/Api';
import { learningKeys } from '../../features/courses/hooks/useLearningPath';
import { normalizeLearningPath } from '../../features/courses/utils/learningPathAdapter';

let mockAuth;
let mockPathname;
jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mockPathname }),
  Link: ({ to, children, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../services/Api', () => ({ api: { getLearningPath: jest.fn() } }));

const pathData = () => ({
  currentCourseId: '2',
  stats: { streakDays: 4, overallProgress: 45 },
  courses: [
    { id: '1', title: 'Nhập môn mạng', completed: true, status: 'completed', progressPercent: 100 },
    {
      id: '2',
      title: 'Chuyển mạch và định tuyến',
      status: 'current',
      canAccess: true,
      isStarted: true,
      progressPercent: 35,
      nextLessonId: 12,
      modules: [
        {
          id: 'm2',
          status: 'current',
          canAccess: true,
          lessons: [
            { id: 11, title: 'VLAN', completed: true },
            { id: 12, title: 'Định tuyến giữa các VLAN' },
          ],
        },
      ],
    },
    { id: '3', title: 'Mạng doanh nghiệp', status: 'locked', canAccess: false },
  ],
});

const mount = (route = '/') => {
  mockPathname = route;
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const tree = () => (
    <QueryClientProvider client={client}>
      <LearningResumeBanner />
    </QueryClientProvider>
  );
  const view = render(tree());
  return { client, rerender: () => view.rerender(tree()) };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = {
    user: { id: 'student-1' },
    token: 'synthetic',
    isAuthenticated: true,
    loading: false,
  };
  api.getLearningPath.mockResolvedValue(pathData());
});

test('uses the server current course, percentage, counts, streak and exact next lesson', async () => {
  mount('/roadmap');
  expect(await screen.findByRole('link', { name: 'Tiếp tục học' })).toHaveAttribute(
    'href',
    '/lesson?course=2&lesson=12'
  );
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '35');
  expect(screen.getByText('Chuyển mạch và định tuyến')).toBeInTheDocument();
  expect(screen.getByText('Bài tiếp: Định tuyến giữa các VLAN')).toBeInTheDocument();
  expect(screen.getByText('1/3 khóa học hoàn thành')).toBeInTheDocument();
  expect(screen.getByText('Chuỗi 4 ngày')).toBeInTheDocument();
});

test('reflects successful lesson saves from the shared learning-path cache', async () => {
  const { client } = mount();
  await screen.findByRole('link', { name: 'Tiếp tục học' });
  const updated = pathData();
  updated.courses[1].progressPercent = 60;
  updated.courses[1].modules[0].lessons[1].completed = true;
  act(() => client.setQueryData(learningKeys.path('student-1'), normalizeLearningPath(updated)));
  await waitFor(() =>
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60')
  );
  expect(screen.getByRole('link', { name: 'Tiếp tục học' })).toHaveAttribute(
    'href',
    '/course/2?from=resume'
  );
  expect(screen.queryByText(/^Bài tiếp:/)).not.toBeInTheDocument();
});

test('shows a truthful starting state and omits a zero-day streak', async () => {
  const data = pathData();
  data.courses[1].isStarted = false;
  data.courses[1].progressPercent = 0;
  data.stats.streakDays = 0;
  api.getLearningPath.mockResolvedValue(data);
  mount();
  expect(await screen.findByRole('link', { name: 'Bắt đầu học' })).toHaveAttribute(
    'href',
    '/lesson?course=2&lesson=12'
  );
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  expect(screen.queryByText(/Chuỗi/)).not.toBeInTheDocument();
});

test('hides the strip for a new learner and appears when learning starts in the shared cache', async () => {
  const data = {
    currentCourseId: '1',
    stats: { streakDays: 0, overallProgress: 0 },
    courses: [
      {
        id: '1',
        title: 'Nhập môn mạng',
        status: 'current',
        canAccess: true,
        isStarted: false,
        progressPercent: 0,
        nextLessonId: 11,
        modules: [
          {
            id: 'm1',
            status: 'current',
            canAccess: true,
            lessons: [{ id: 11, title: 'Bài đầu tiên' }],
          },
        ],
      },
      { id: '2', title: 'Khóa tiếp theo', status: 'locked', canAccess: false },
    ],
  };
  api.getLearningPath.mockResolvedValue(data);
  const { client } = mount();
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  await waitFor(() =>
    expect(client.getQueryState(learningKeys.path('student-1'))?.status).toBe('success')
  );
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

  data.courses[0].isStarted = true;
  act(() => client.setQueryData(learningKeys.path('student-1'), normalizeLearningPath(data)));
  expect(await screen.findByRole('link', { name: 'Tiếp tục học' })).toHaveAttribute(
    'href',
    '/lesson?course=1&lesson=11'
  );
  // A large course may still round to zero after the learner has started.
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
});

test('offers review when the server marks every course complete', async () => {
  const data = pathData();
  data.currentCourseId = null;
  data.courses.forEach((course) => {
    course.completed = true;
    course.progressPercent = 100;
  });
  api.getLearningPath.mockResolvedValue(data);
  mount();
  expect(await screen.findByRole('link', { name: 'Ôn tập lộ trình' })).toHaveAttribute(
    'href',
    '/roadmap'
  );
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  expect(screen.getByText('3/3 khóa học hoàn thành')).toBeInTheDocument();
  expect(screen.queryByText(/^Bài tiếp:/)).not.toBeInTheDocument();
});

test.each([null, 999])(
  'opens the course when the next lesson is unavailable (%s)',
  async (nextLessonId) => {
    const data = pathData();
    data.courses[1].nextLessonId = nextLessonId;
    api.getLearningPath.mockResolvedValue(data);
    mount();
    expect(await screen.findByRole('link', { name: 'Tiếp tục học' })).toHaveAttribute(
      'href',
      '/course/2?from=resume'
    );
  }
);

test('does not link into a locked module or course', async () => {
  const data = pathData();
  data.courses[1].modules[0].canAccess = false;
  api.getLearningPath.mockResolvedValue(data);
  const { client } = mount();
  expect(await screen.findByRole('link', { name: 'Tiếp tục học' })).toHaveAttribute(
    'href',
    '/course/2?from=resume'
  );
  data.courses[1].canAccess = false;
  act(() => client.setQueryData(learningKeys.path('student-1'), normalizeLearningPath(data)));
  expect(await screen.findByRole('link', { name: 'Xem lộ trình' })).toHaveAttribute(
    'href',
    '/roadmap'
  );
});

test('waits for learning data and offers an explicit retry after an error without inventing progress', async () => {
  let reject;
  api.getLearningPath.mockImplementationOnce(
    () =>
      new Promise((resolve, fail) => {
        reject = fail;
      })
  );
  mount();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  await act(async () => reject(Object.assign(new Error('Synthetic failure'), { status: 400 })));
  fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByRole('link', { name: 'Tiếp tục học' })).toBeInTheDocument();
  expect(api.getLearningPath).toHaveBeenCalledTimes(2);
});

test('does not render a banner when the catalog is empty', async () => {
  api.getLearningPath.mockResolvedValue({ courses: [] });
  mount();
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});

test('isolates progress when switching accounts and hides it on logout', async () => {
  const { client, rerender } = mount();
  await screen.findByText('Chuỗi 4 ngày');
  api.getLearningPath.mockResolvedValue({ courses: [] });
  mockAuth = { ...mockAuth, user: { id: 'student-2' }, token: 'another-synthetic' };
  rerender();
  expect(screen.queryByText('Chuỗi 4 ngày')).not.toBeInTheDocument();
  await waitFor(() => expect(client.getQueryData(learningKeys.path('student-1'))).toBeUndefined());
  mockAuth = { user: null, token: null, isAuthenticated: false, loading: false };
  rerender();
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});

test.each([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password/example',
  '/lesson',
  '/exam/take/1',
  '/exam/review/1',
  '/exam/result/1',
  '/admin/users',
  '/tools/cli',
  '/tools/subnet',
  '/tools/vlsm',
  '/tools/ports',
  '/labs',
  '/resources',
  '/profile',
  '/course/1',
  '/exam/testing-center',
])('does not fetch or distract the learner on %s', (route) => {
  mount(route);
  expect(api.getLearningPath).not.toHaveBeenCalled();
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});

test('keeps the resume strip on the roadmap URL with a trailing slash', async () => {
  mount('/roadmap/');
  expect(await screen.findByRole('link', { name: 'Tiếp tục học' })).toHaveAttribute(
    'href',
    '/lesson?course=2&lesson=12'
  );
});

test.each([{ isAuthenticated: false, token: null }, { loading: true }, { token: null }])(
  'does not query before authentication is ready: %j',
  (auth) => {
    mockAuth = { ...mockAuth, ...auth };
    mount();
    expect(api.getLearningPath).not.toHaveBeenCalled();
  }
);
