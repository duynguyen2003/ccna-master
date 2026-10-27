import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import GuestSectionTabs from './GuestSectionTabs';
import { ThemeProvider } from '../../../context/ThemeContext';
import TopHeader from './TopHeader';

let mockAuth;
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../../services/Api', () => ({
  __esModule: true,
  API_URL: 'http://localhost:5500/api',
  default: { getCourses: jest.fn(), getLabs: jest.fn() },
}));

const items = [
  { id: 'home-how-it-works', label: 'Cách học' },
  { id: 'home-courses', label: 'Lộ trình' },
  { id: 'home-tools', label: 'Công cụ' },
  { id: 'home-faq', label: 'Câu hỏi thường gặp', shortLabel: 'FAQ' },
];
const originalObserver = global.ResizeObserver;
const originalMatchMedia = window.matchMedia;
const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'scrollIntoView'
);
let geometry;
let rectangles;
let measuredPill;
let resizeMeasure;
let disconnectObserver;
let snapTransitions;

function Tabs() {
  const [activeSection, setActiveSection] = useState(items[0].id);
  return (
    <GuestSectionTabs
      items={items}
      activeSection={activeSection}
      onSelect={(event, id) => {
        event.preventDefault();
        setActiveSection(id);
      }}
    />
  );
}

beforeEach(() => {
  mockAuth = { isAuthenticated: false, logout: jest.fn(), token: null, user: null };
  measuredPill = undefined;
  snapTransitions = [];
  geometry = {
    '#home-how-it-works': { left: 3, width: 86 },
    '#home-courses': { left: 92, width: 91 },
    '#home-tools': { left: 186, width: 87 },
    '#home-faq': { left: 276, width: 170 },
  };
  rectangles = { hero: { top: -500, bottom: -100 } };
  items.forEach((item, index) => {
    rectangles[item.id] = { top: 100 + index * 800, bottom: 700 + index * 800 };
  });
  disconnectObserver = jest.fn();
  global.ResizeObserver = jest.fn(function (callback) {
    resizeMeasure = callback;
    this.observe = jest.fn();
    this.disconnect = disconnectObserver;
  });
  jest.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function () {
    return geometry[this.getAttribute('href')]?.left || 0;
  });
  jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function () {
    if (this.className === 't-tabs-pill') {
      measuredPill = this;
      snapTransitions.push(this.style.transition);
      return Number.parseFloat(this.style.width) || 0;
    }
    return geometry[this.getAttribute('href')]?.width || 100;
  });
  jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return rectangles[this.id] || { top: 0, bottom: 0 };
  });
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback();
    return 1;
  });
  jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: jest.fn(),
  });
  window.matchMedia = jest.fn(() => ({ matches: false }));
});

afterEach(() => {
  jest.restoreAllMocks();
  global.ResizeObserver = originalObserver;
  if (originalMatchMedia) window.matchMedia = originalMatchMedia;
  else delete window.matchMedia;
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
  else delete document.fonts;
  if (originalScrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView);
  } else delete HTMLElement.prototype.scrollIntoView;
});

test('initial geometry snaps, then rapid selections use each link offset and width', () => {
  render(<Tabs />);
  expect(measuredPill).toHaveStyle({ left: '3px', width: '86px' });
  expect(snapTransitions).toEqual(['none']);
  expect(measuredPill.style.transition).toBe('');

  fireEvent.click(screen.getByRole('link', { name: 'Công cụ' }));
  expect(measuredPill).toHaveStyle({ left: '186px', width: '87px' });
  fireEvent.click(screen.getByRole('link', { name: /Câu hỏi thường gặp/ }));
  expect(measuredPill).toHaveStyle({ left: '276px', width: '170px' });
  expect(screen.getByRole('link', { name: /Câu hỏi thường gặp/ })).toHaveAttribute(
    'aria-current',
    'page'
  );
  expect(snapTransitions).toEqual(['none']);
});

test('responsive and late-font measurements snap to the current link and disconnect on unmount', async () => {
  let fontsReady;
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      ready: new Promise((resolve) => {
        fontsReady = resolve;
      }),
    },
  });
  const { unmount } = render(<Tabs />);
  fireEvent.click(screen.getByRole('link', { name: 'Lộ trình' }));

  geometry['#home-courses'] = { left: 64, width: 62 };
  fireEvent.resize(window);
  expect(measuredPill).toHaveStyle({ left: '64px', width: '62px' });

  geometry['#home-courses'] = { left: 66, width: 68 };
  act(() => resizeMeasure());
  expect(measuredPill).toHaveStyle({ left: '66px', width: '68px' });

  geometry['#home-courses'] = { left: 70, width: 74 };
  await act(async () => fontsReady());
  expect(measuredPill).toHaveStyle({ left: '70px', width: '74px' });
  expect(snapTransitions.every((value) => value === 'none')).toBe(true);
  unmount();
  expect(disconnectObserver).toHaveBeenCalledTimes(1);
});

const renderHeader = () =>
  render(
    <>
      <section id="hero" className="landing-hero" />
      {items.map((item) => (
        <section key={item.id} id={item.id} />
      ))}
      <ThemeProvider>
        <TopHeader />
      </ThemeProvider>
    </>
  );

test('guest header holds a clicked destination across intermediate smooth-scroll sections', () => {
  renderHeader();
  const tools = screen.getByRole('link', { name: 'Công cụ' });
  fireEvent.click(tools);
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenLastCalledWith({
    behavior: 'smooth',
    block: 'start',
  });

  rectangles['home-how-it-works'] = { top: -800, bottom: -100 };
  rectangles['home-courses'] = { top: 100, bottom: 700 };
  fireEvent.scroll(window);
  expect(tools).toHaveAttribute('aria-current', 'page');

  rectangles['home-courses'] = { top: -800, bottom: -100 };
  rectangles['home-tools'] = { top: 100, bottom: 700 };
  fireEvent.scroll(window);
  rectangles['home-tools'] = { top: -800, bottom: -100 };
  rectangles['home-faq'] = { top: 100, bottom: 700 };
  fireEvent.scroll(window);
  expect(screen.getByRole('link', { name: /Câu hỏi thường gặp/ })).toHaveAttribute(
    'aria-current',
    'page'
  );
});

test('manual scrolling can interrupt a destination and reduced motion uses instant section scrolling', () => {
  window.matchMedia = jest.fn(() => ({ matches: true }));
  renderHeader();
  fireEvent.click(screen.getByRole('link', { name: 'Công cụ' }));
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenLastCalledWith({
    behavior: 'auto',
    block: 'start',
  });
  rectangles['home-how-it-works'] = { top: -800, bottom: -100 };
  rectangles['home-courses'] = { top: 100, bottom: 700 };
  fireEvent.wheel(window);
  fireEvent.scroll(window);
  expect(screen.getByRole('link', { name: 'Lộ trình' })).toHaveAttribute('aria-current', 'page');
});

test('authenticated header keeps its existing navigation without the guest pill', () => {
  mockAuth = { ...mockAuth, isAuthenticated: true, user: { fullName: 'Test User' } };
  renderHeader();
  expect(
    screen.queryByRole('navigation', { name: 'Điều hướng trang chủ' })
  ).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Khóa học của tôi' })).toBeInTheDocument();
  expect(measuredPill).toBeUndefined();
});
