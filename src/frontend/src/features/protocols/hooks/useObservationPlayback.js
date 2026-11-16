import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export default function useObservationPlayback(model, { autoPlay = true } = {}) {
  const source = useRef(model);
  source.current = model;
  const timelineRef = useRef(null);
  const renderer = useRef(null);
  const current = useRef({ index: 0, status: 'idle', speed: 1 });
  const [state, setState] = useState({ key: '', ...current.current });
  const publish = useCallback((changes) => {
    current.current = { ...current.current, ...changes };
    setState({ key: source.current.key, ...current.current });
  }, []);
  const attach = useCallback(() => {
    const entry = timelineRef.current;
    if (!entry || renderer.current?.key !== entry.key) return;
    const time = entry.timeline.time();
    entry.visual?.kill();
    entry.visual = renderer.current.build(entry.starts);
    if (entry.visual) {
      entry.timeline.add(entry.visual, 0).time(time, true);
      // Render newly attached zero-time sets while the parent is paused at 0.
      entry.visual.render(time, true, true);
    }
  }, []);
  const registerRenderer = useCallback(
    (key, build) => {
      const registration = { key, build };
      renderer.current = registration;
      attach();
      return () => {
        if (renderer.current !== registration) return;
        renderer.current = null;
        timelineRef.current?.visual?.kill();
      };
    },
    [attach]
  );

  useLayoutEffect(() => {
    const events = source.current.events;
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    current.current = { index: 0, status: 'idle', speed: current.current.speed };
    const timeline = gsap.timeline({
      paused: true,
      onComplete: () => publish({ status: 'complete', index: Math.max(0, events.length - 1) }),
    });
    const starts = [];
    const clock = { value: 0 };
    let offset = 0;
    events.forEach((event, index) => {
      const supplied = source.current.starts?.[index];
      const start =
        Number.isFinite(supplied) && supplied >= (starts[index - 1] || 0) ? supplied : offset;
      starts.push(start);
      timeline.call(() => publish({ index }), [], start);
      // The clock reserves the whole flight, including packets that overlap in a stream.
      timeline.to(clock, { value: index + 1, duration: event.duration, ease: 'none' }, start);
      offset = Math.max(offset, start + event.duration);
    });
    timelineRef.current = { key: source.current.key, timeline, starts, visual: null };
    timeline.timeScale(current.current.speed);
    attach();
    const running = autoPlay && events.length > 0 && !media?.matches;
    publish({ status: running ? 'playing' : 'idle' });
    if (running) timeline.play(0);
    const motionChanged = (event) => {
      if (event.matches) {
        timeline.pause();
        publish({ status: 'paused' });
      }
    };
    media?.addEventListener?.('change', motionChanged);
    return () => {
      media?.removeEventListener?.('change', motionChanged);
      timeline.kill();
      if (timelineRef.current?.timeline === timeline) timelineRef.current = null;
    };
  }, [model.key, autoPlay, attach, publish]);

  const select = useCallback(
    (index) => {
      const entry = timelineRef.current;
      if (!entry?.starts.length) return;
      const next = Math.max(0, Math.min(index, entry.starts.length - 1));
      entry.timeline.pause().seek(entry.starts[next], true);
      entry.visual?.render(entry.starts[next], true, true);
      publish({ index: next, status: 'paused' });
    },
    [publish]
  );
  const play = useCallback(() => {
    const entry = timelineRef.current;
    if (!entry?.starts.length) return;
    const restart = current.current.status === 'complete';
    if (restart) {
      entry.timeline.pause(0, true);
      entry.visual?.render(0, true, true);
    }
    publish({ status: 'playing', ...(restart ? { index: 0 } : {}) });
    entry.timeline.play();
  }, [publish]);
  const pause = useCallback(() => {
    timelineRef.current?.timeline.pause();
    publish({ status: 'paused' });
  }, [publish]);
  const step = useCallback((direction = 1) => select(current.current.index + direction), [select]);
  const reset = useCallback(() => select(0), [select]);
  const setSpeed = useCallback(
    (value) => {
      const speed = Number(value);
      if (![0.5, 1, 1.5, 2].includes(speed)) return;
      timelineRef.current?.timeline.timeScale(speed);
      publish({ speed });
    },
    [publish]
  );
  const visible =
    state.key === model.key ? state : { index: 0, status: 'idle', speed: current.current.speed };
  return {
    ...visible,
    model,
    timelineRef,
    registerRenderer,
    select,
    play,
    pause,
    step,
    reset,
    setSpeed,
  };
}
