/* eslint-disable testing-library/no-node-access */
import { gsap } from './labMotion';
import { killUnlockSequence, playUnlockSequence } from './learningPathMotion';
import '@testing-library/jest-dom';

jest.mock('./labMotion', () => {
  return {
    gsap: {
      fromTo: jest.fn(),
      killTweensOf: jest.fn(),
      set: jest.fn(),
      timeline: jest.fn(),
    },
    prefersReducedMotion: jest.fn(() => false),
  };
});

const createTimelineMock = () => {
  const timeline = {
    addLabel: jest.fn(),
    fromTo: jest.fn(),
    kill: jest.fn(),
    set: jest.fn(),
    to: jest.fn(),
  };
  Object.values(timeline).forEach((method) => method.mockReturnValue(timeline));
  return timeline;
};

describe('learningPathMotion unlock sequence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    gsap.timeline.mockReturnValue(createTimelineMock());
    document.querySelectorAll('[data-lp-confetti]').forEach((element) => element.remove());
  });

  it('creates confetti at the completed node and cleans it when interrupted', () => {
    const completedNodeEl = document.createElement('button');
    const nextNodeEl = document.createElement('button');
    completedNodeEl.getBoundingClientRect = () => ({
      left: 100,
      top: 50,
      width: 72,
      height: 72,
      right: 172,
      bottom: 122,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    });

    const timeline = playUnlockSequence({ completedNodeEl, nextNodeEl });

    expect(document.querySelectorAll('.lp-unlock-confetti-particle')).toHaveLength(84);
    expect(gsap.timeline).toHaveBeenCalledTimes(1);

    killUnlockSequence(timeline);

    expect(timeline.kill).toHaveBeenCalled();
    expect(document.querySelector('[data-lp-confetti]')).not.toBeInTheDocument();
  });

  it('skips confetti and finishes immediately for reduced motion', () => {
    const onComplete = jest.fn();

    const timeline = playUnlockSequence({
      completedNodeEl: document.createElement('button'),
      nextNodeEl: document.createElement('button'),
      reducedMotion: true,
      onComplete,
    });

    expect(timeline).toBeNull();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-lp-confetti]')).not.toBeInTheDocument();
  });
});
