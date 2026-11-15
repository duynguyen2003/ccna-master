import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import NetworkTopology from './NetworkTopology';
import { networkTemplate } from '../data/networkLabTemplates';
import { gsap } from '../utils/labMotion';

beforeEach(() => {
  gsap.timeline.mockImplementation(() => {
    const value = {};
    ['call', 'set', 'to', 'fromTo', 'play', 'kill'].forEach((name) => {
      value[name] = jest.fn(() => value);
    });
    return value;
  });
});

jest.mock('../utils/labMotion', () => {
  const timeline = () => {
    const value = {};
    ['call', 'set', 'to', 'fromTo', 'play', 'kill'].forEach((name) => {
      value[name] = jest.fn(() => value);
    });
    return value;
  };
  return {
    prefersReducedMotion: () => false,
    gsap: {
      timeline: jest.fn(timeline),
      set: jest.fn(),
      fromTo: jest.fn(),
      context: (callback) => {
        callback();
        return { revert: jest.fn() };
      },
    },
  };
});

test('polling and selecting another node preserve an active flight; a new probe and motion preference cancel it', () => {
  const oldMedia = window.matchMedia;
  let motionChanged;
  const media = {
    matches: false,
    addEventListener: jest.fn((_, callback) => {
      motionChanged = callback;
    }),
    removeEventListener: jest.fn(),
  };
  window.matchMedia = () => media;
  const packet = {
    animationKey: 'probe-1',
    events: [
      {
        type: 'FRAME',
        from: networkTemplate.links[0].a,
        to: networkTemplate.links[0].b,
        packet: { protocol: 'icmp', ttl: 32 },
      },
    ],
  };
  try {
    const { rerender, unmount } = render(<NetworkTopology {...networkTemplate} packet={packet} />);
    const first = gsap.timeline.mock.results.at(-1).value;
    const count = gsap.timeline.mock.calls.length;
    rerender(
      <NetworkTopology
        {...networkTemplate}
        selected="R1"
        packet={JSON.parse(JSON.stringify(packet))}
      />
    );
    expect(gsap.timeline).toHaveBeenCalledTimes(count);
    expect(first.kill).not.toHaveBeenCalled();
    rerender(
      <NetworkTopology {...networkTemplate} packet={{ ...packet, animationKey: 'probe-2' }} />
    );
    expect(first.kill).toHaveBeenCalledTimes(1);
    expect(gsap.timeline).toHaveBeenCalledTimes(count + 1);
    const second = gsap.timeline.mock.results.at(-1).value;
    motionChanged({ matches: true });
    expect(second.kill).toHaveBeenCalledTimes(1);
    unmount();
    expect(media.removeEventListener).toHaveBeenCalled();
  } finally {
    window.matchMedia = oldMedia;
  }
});
