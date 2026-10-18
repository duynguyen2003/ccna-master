import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Home } from './Home';
import api, { BACKEND_URL } from '../../../services/Api';
import course1 from '../../../assets/images/course1.jpg';
import course2 from '../../../assets/images/course2.jpg';
import course3 from '../../../assets/images/course3.jpg';

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
  useAuth: () => ({ token: 'student-token', isAuthenticated: true }),
}));
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

beforeEach(() => jest.clearAllMocks());

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
