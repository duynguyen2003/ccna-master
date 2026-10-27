import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Home } from './Home';
import api, { BACKEND_URL } from '../../../services/Api';
import course1 from '../../../assets/images/course1.jpg';
import course2 from '../../../assets/images/course2.jpg';
import course3 from '../../../assets/images/course3.jpg';

let mockAuth;
const originalMatchMedia = window.matchMedia;

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ search: '', hash: '' }),
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));
jest.mock('../../../components/learning/LearningResumeBanner', () => () => (
  <section aria-label="Tiến độ học tập">Thanh học tiếp</section>
));
jest.mock('../utils/homeMotion', () => ({
  useGSAP: jest.fn(),
  prefersReducedMotion: () => true,
  gsap: {},
  ScrollTrigger: { refresh: jest.fn() },
}));
jest.mock('../../../services/Api', () => ({
  __esModule: true,
  BACKEND_URL: 'https://backend.example',
  default: { getCourseSummaries: jest.fn() },
}));

const summary = (code, thumbnailUrl = null) => ({
  id: code,
  code,
  title: `Course ${code}`,
  description: 'Course description',
  thumbnailUrl,
  progress: 0,
});

const cardFor = (code) =>
  screen.findByRole('link', {
    name: (name) => name.includes(`Course ${code} Course description`),
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { token: 'student-token', isAuthenticated: true };
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  window.matchMedia = originalMatchMedia;
});

test.each([false, true])(
  'types and cycles the banner for authenticated=%s',
  async (authenticated) => {
    jest.useFakeTimers();
    mockAuth = { token: authenticated ? 'student-token' : null, isAuthenticated: authenticated };
    api.getCourseSummaries.mockResolvedValue([]);
    render(<Home />);
    await act(async () => {
      await Promise.resolve();
    });
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveAccessibleName('Học CCNA theo lộ trình. Thực hành mạng ngay khi học.');
    expect(heading.textContent.trim()).toBe('');
    let first = false,
      second = false;
    for (let tick = 0; tick < 200 && !second; tick++) {
      act(() => jest.runOnlyPendingTimers());
      first ||= heading.textContent.includes('Thực hành mạng ngay khi học.');
      second ||= heading.textContent.includes('Làm lab cấu hình Cisco thực tế.');
    }
    expect(first).toBe(true);
    expect(second).toBe(true);
  }
);

test.each([false, true])(
  'keeps the reduced-motion banner readable for authenticated=%s',
  async (authenticated) => {
    jest.useFakeTimers();
    window.matchMedia = () => ({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
    mockAuth = { token: authenticated ? 'student-token' : null, isAuthenticated: authenticated };
    api.getCourseSummaries.mockResolvedValue([]);
    render(<Home />);
    await act(async () => {
      await Promise.resolve();
    });
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Học CCNA theo lộ trình. Thực hành mạng ngay khi học.');
    act(() => jest.advanceTimersByTime(20000));
    expect(heading).toHaveTextContent('Học CCNA theo lộ trình. Thực hành mạng ngay khi học.');
  }
);

test('places one resume strip after the restored hero and removes the extra roadmap heading', async () => {
  api.getCourseSummaries.mockResolvedValue([]);
  render(<Home />);
  const hero = screen.getByRole('region', {
    name: 'Học CCNA theo lộ trình. Thực hành mạng ngay khi học.',
  });
  const resume = screen.getByRole('region', { name: 'Tiến độ học tập' });
  expect(hero.compareDocumentPosition(resume) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getAllByRole('region', { name: 'Tiến độ học tập' })).toHaveLength(1);
  expect(
    screen.queryByRole('heading', { name: 'Lộ trình học CCNA', exact: true })
  ).not.toBeInTheDocument();
  await act(async () => {
    await Promise.resolve();
  });
});

test('opens the interactive CLI from the hero and links to the testing center', async () => {
  api.getCourseSummaries.mockResolvedValue([]);
  render(<Home />);
  expect(screen.getByRole('link', { name: 'Luyện thi CCNA' })).toHaveAttribute(
    'href',
    '/exam/testing-center'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Thử CLI' }));
  const input = await screen.findByRole('textbox', { name: 'Lệnh terminal minh họa' });
  fireEvent.change(input, { target: { value: 'show ip interface brief' } });
  fireEvent.click(screen.getByRole('button', { name: 'Chạy' }));
  expect(within(screen.getByRole('log')).getByText('192.0.2.1')).toBeInTheDocument();
});

test('uses uploaded thumbnails for new and existing courses, including hover backgrounds', async () => {
  const customUrl = 'https://res.cloudinary.com/example/image/upload/new-course.jpg';
  const replacementUrl = 'https://res.cloudinary.com/example/image/upload/replaced-itn.jpg';
  api.getCourseSummaries.mockResolvedValue([
    summary('cs202', customUrl),
    summary('ITN', replacementUrl),
  ]);
  render(<Home />);

  for (const [code, url] of [
    ['cs202', customUrl],
    ['ITN', replacementUrl],
  ]) {
    const card = await cardFor(code);
    expect(card.style.getPropertyValue('--course-bg-image')).toContain(url);
    expect(card.getAttribute('style')).toContain(url);
    expect(card).toHaveAttribute('href', `/course/${code}?from=home`);
  }
});

test('resolves uploaded relative media paths against the backend', async () => {
  api.getCourseSummaries.mockResolvedValue([summary('cs202', '/uploads/ccna-thumbnail.jpg')]);
  render(<Home />);

  expect((await cardFor('cs202')).style.getPropertyValue('--course-bg-image')).toContain(
    `${BACKEND_URL}/uploads/ccna-thumbnail.jpg`
  );
});

test('keeps legacy fallback images attached to course codes after insertion and reordering', async () => {
  api.getCourseSummaries.mockResolvedValue([
    summary('cs202'),
    summary('ENA'),
    summary('SRW'),
    summary('ITN'),
    summary('SRWE'),
    summary('ENSA'),
  ]);
  render(<Home />);

  for (const [code, image] of [
    ['ITN', course1],
    ['SRW', course2],
    ['SRWE', course2],
    ['ENA', course3],
    ['ENSA', course3],
  ]) {
    expect((await cardFor(code)).style.getPropertyValue('--course-bg-image')).toContain(image);
  }
});
