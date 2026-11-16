import { act, renderHook } from '@testing-library/react';
import useObservationPlayback from './useObservationPlayback';
import { createObservation } from '../model/observation';

const model = (key) =>
  createObservation(
    {
      events: [
        { type: 'ROUTE', deviceId: 'R1' },
        { type: 'FRAME', from: { deviceId: 'R1' }, to: { deviceId: 'PC1' } },
        { type: 'DELIVERED', deviceId: 'PC1' },
      ],
    },
    key
  );

test('selection, stepping and speed control one timeline; equivalent polling keeps the cursor', () => {
  const { result, rerender, unmount } = renderHook(
    ({ value }) => useObservationPlayback(value, { autoPlay: false }),
    { initialProps: { value: model('p1') } }
  );
  const first = result.current.timelineRef.current.timeline;
  act(() => result.current.select(1));
  act(() => result.current.setSpeed(2));
  expect(result.current.index).toBe(1);
  expect(result.current.status).toBe('paused');
  expect(first.timeScale()).toBe(2);
  rerender({ value: model('p1') });
  expect(result.current.index).toBe(1);
  expect(result.current.timelineRef.current.timeline).toBe(first);
  act(() => result.current.step());
  expect(result.current.index).toBe(2);
  act(() => result.current.play());
  act(() => {
    first.progress(1);
  });
  expect(result.current.status).toBe('complete');
  act(() => result.current.play());
  expect(result.current.index).toBe(0);
  act(() => result.current.pause());
  rerender({ value: model('p2') });
  expect(result.current.index).toBe(0);
  expect(result.current.status).toBe('idle');
  expect(result.current.timelineRef.current.timeline).not.toBe(first);
  expect(first.parent).toBeNull();
  const last = result.current.timelineRef.current.timeline;
  unmount();
  expect(last.parent).toBeNull();
});

test('history and reduced motion do not autoplay; changing preference pauses an active trace', () => {
  const original = window.matchMedia;
  let change;
  const media = {
    matches: true,
    addEventListener: jest.fn((_, fn) => {
      change = fn;
    }),
    removeEventListener: jest.fn(),
  };
  window.matchMedia = () => media;
  try {
    const { result, unmount } = renderHook(() =>
      useObservationPlayback(model('history'), { autoPlay: false })
    );
    expect(result.current.status).toBe('idle');
    act(() => result.current.play());
    expect(result.current.status).toBe('playing');
    act(() => change({ matches: true }));
    expect(result.current.status).toBe('paused');
    expect(result.current.timelineRef.current.timeline.paused()).toBe(true);
    unmount();
    expect(media.removeEventListener).toHaveBeenCalled();
  } finally {
    window.matchMedia = original;
  }
});

test('overlapping packet starts share one clock and completion waits for every flight', () => {
  const value = { key: 'overlap', events: [{ duration: 2 }, { duration: 2 }], starts: [0, 0.5] };
  const { result, unmount } = renderHook(() => useObservationPlayback(value, { autoPlay: false }));
  const timeline = result.current.timelineRef.current.timeline;
  expect(result.current.timelineRef.current.starts).toEqual([0, 0.5]);
  expect(timeline.duration()).toBeCloseTo(2.5);
  act(() => {
    timeline.time(1, false);
  });
  expect(result.current.index).toBe(1);
  act(() => result.current.select(0));
  expect(timeline.time()).toBe(0);
  expect(result.current.status).toBe('paused');
  unmount();
});
