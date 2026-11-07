import { runThemeTransition } from './themeTransition';

const originalTransition = document.startViewTransition;
const originalAnimate = document.documentElement.animate;
const originalMedia = window.matchMedia;
let dispose;
const trigger = { getBoundingClientRect: () => ({ left: 90, top: 30, width: 20, height: 20 }) };
beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  dispose?.();
  dispose = null;
  document.startViewTransition = originalTransition;
  document.documentElement.animate = originalAnimate;
  window.matchMedia = originalMedia;
  jest.useRealTimers();
});

test('reuses the original 650ms circular reveal even with reduced motion enabled', async () => {
  const update = jest.fn();
  window.matchMedia = () => ({ matches: true });
  let complete;
  document.startViewTransition = jest.fn((callback) => {
    callback();
    return {
      ready: Promise.resolve(),
      finished: new Promise((resolve) => {
        complete = resolve;
      }),
      skipTransition: jest.fn(),
    };
  });
  document.documentElement.animate = jest.fn(() => ({ cancel: jest.fn() }));
  dispose = runThemeTransition(update, trigger, 'dark');
  await Promise.resolve();
  expect(update).toHaveBeenCalledTimes(1);
  expect(document.documentElement.animate).toHaveBeenCalledWith(
    {
      clipPath: [
        'circle(0px at 100px 40px)',
        expect.stringMatching(/^circle\(.+ at 100px 40px\)$/),
      ],
    },
    {
      duration: 650,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      pseudoElement: '::view-transition-new(root)',
    }
  );
  complete();
  await Promise.resolve();
  expect(document.documentElement.classList.contains('netmaster-theme-transition')).toBe(false);
});

test('browsers without View Transition animate a circle before changing theme and clean up', () => {
  document.startViewTransition = undefined;
  const update = jest.fn();
  dispose = runThemeTransition(update, trigger, 'dark');
  expect(document.querySelector('.netmaster-theme-reveal')).not.toBeNull();
  expect(update).not.toHaveBeenCalled();
  jest.advanceTimersByTime(700);
  expect(update).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(200);
  expect(document.querySelector('.netmaster-theme-reveal')).toBeNull();
});

test('rapid changes commit in order, cancel stale callbacks and leave no overlay after unmount', () => {
  let firstCommit;
  document.startViewTransition = jest.fn((callback) => {
    firstCommit ||= callback;
    return {
      ready: new Promise(() => {}),
      finished: new Promise(() => {}),
      skipTransition: jest.fn(),
    };
  });
  const first = jest.fn();
  const second = jest.fn();
  runThemeTransition(first, trigger, 'dark');
  dispose = runThemeTransition(second, trigger, 'light');
  expect(first).toHaveBeenCalledTimes(1);
  firstCommit();
  expect(first).toHaveBeenCalledTimes(1);
  dispose();
  expect(second).not.toHaveBeenCalled();
  expect(document.documentElement.classList.contains('netmaster-theme-transition')).toBe(false);
});

test('a broken View Transition implementation still performs the animated fallback', () => {
  document.startViewTransition = () => {
    throw new Error('unavailable');
  };
  const update = jest.fn();
  dispose = runThemeTransition(update, trigger, 'light');
  expect(update).not.toHaveBeenCalled();
  jest.advanceTimersByTime(900);
  expect(update).toHaveBeenCalledTimes(1);
  expect(document.querySelector('.netmaster-theme-reveal')).toBeNull();
});

test('missing pseudo-element animation support switches to the animated overlay without leaking promises', async () => {
  let complete;
  const skip = jest.fn();
  document.startViewTransition = (callback) => {
    callback();
    return {
      ready: Promise.resolve(),
      finished: new Promise((resolve) => {
        complete = resolve;
      }),
      skipTransition: skip,
    };
  };
  document.documentElement.animate = () => {
    throw new Error('pseudo-element unsupported');
  };
  const update = jest.fn();
  dispose = runThemeTransition(update, trigger, 'dark');
  await Promise.resolve();
  complete();
  await Promise.resolve();
  expect(skip).toHaveBeenCalled();
  expect(document.querySelector('.netmaster-theme-reveal')).not.toBeNull();
  jest.advanceTimersByTime(900);
  expect(update).toHaveBeenCalledTimes(1);
  expect(document.querySelector('.netmaster-theme-reveal')).toBeNull();
});
