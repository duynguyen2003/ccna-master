import React, { useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw } from 'lucide-react';
import LessonNetworkView from '../../protocols/components/LessonNetworkView';
import { createLessonObservation } from '../../protocols/model/lessonObservation';
import useObservationPlayback from '../../protocols/hooks/useObservationPlayback';
import useReducedMotion from '../../../hooks/useReducedMotion';
import '../../protocols/styles/ProtocolLesson.css';
import '../../protocols/styles/PacketVisual.css';

const overviewLayout = {
  positions: {
    client: [100, 260],
    router: [330, 210],
    internet: [550, 260],
    dns: [550, 70],
    web: [800, 90],
  },
  viewBox: '0 -30 930 405',
};

export default function HomeProtocolDemo({ lesson, visible = true }) {
  const model = useMemo(() => {
    const source = createLessonObservation(lesson, 'home-preview:' + lesson.id);
    // Keep the whole topology in view on Home; packet routes and timing remain unchanged.
    return {
      ...source,
      events: source.events.map((event) => ({ ...event, visible: lesson.nodes })),
    };
  }, [lesson]);
  const playback = useObservationPlayback(model, { autoPlay: false });
  const reduced = useReducedMotion();
  const started = useRef(false);
  const { play, pause, status } = playback;
  useEffect(() => {
    if ((!visible || reduced) && status === 'playing') pause();
    else if (visible && !reduced && !started.current) {
      // Start after StrictMode's effect cleanup so the surviving timeline owns playback.
      const frame = requestAnimationFrame(() => {
        if (!started.current) {
          started.current = true;
          play();
        }
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [visible, reduced, status, play, pause]);
  const control = (action) => {
    started.current = true;
    action();
  };
  const event = model.events[playback.index];
  const phases = useMemo(
    () =>
      model.stepStarts.map((index, step) => ({
        index,
        title: model.events[index].stepTitle,
        step,
      })),
    [model]
  );
  return (
    <section className="home-protocol-demo protocol-lesson" aria-label="Xem thử mô phỏng HTTP">
      <header className="home-demo__title">
        <span>HTTP</span>
        <h2>Khi bạn mở một trang web</h2>
      </header>
      <div className="home-demo__controls" role="group" aria-label="Điều khiển mô phỏng trên Home">
        <button
          type="button"
          disabled={reduced}
          title={
            reduced ? 'Đang bật giảm chuyển động. Dùng tiến/lùi hoặc chọn giai đoạn.' : undefined
          }
          onClick={() => control(status === 'playing' ? pause : play)}
          aria-label={
            status === 'playing'
              ? 'Tạm dừng demo'
              : status === 'complete'
                ? 'Phát lại demo'
                : 'Phát demo'
          }
        >
          {status === 'playing' ? (
            <Pause size={16} aria-hidden="true" />
          ) : (
            <Play size={16} aria-hidden="true" />
          )}
          <span>
            {status === 'playing' ? 'Tạm dừng' : status === 'complete' ? 'Phát lại' : 'Phát'}
          </span>
        </button>
        <button
          type="button"
          aria-label="Sự kiện trước trong demo"
          disabled={!playback.index}
          onClick={() => control(() => playback.step(-1))}
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Sự kiện tiếp theo trong demo"
          disabled={playback.index >= model.events.length - 1}
          onClick={() => control(() => playback.step(1))}
        >
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Về đầu demo" onClick={() => control(playback.reset)}>
          <RotateCcw size={15} aria-hidden="true" />
        </button>
        <span className="home-demo__count" aria-label="Vị trí sự kiện demo">
          {playback.index + 1}/{model.events.length}
        </span>
      </div>
      <div className="home-demo__stage">
        <LessonNetworkView lesson={lesson} playback={playback} layout={overviewLayout} />
      </div>
      <nav className="home-demo__phases" aria-label="Giai đoạn trong demo HTTP">
        {phases.map((phase) => (
          <button
            key={phase.index}
            type="button"
            aria-label={`${phase.step + 1}. ${phase.title}`}
            aria-current={event.stepIndex === phase.step ? 'step' : undefined}
            onClick={() => control(() => playback.select(phase.index))}
          >
            <span>{phase.step + 1}</span>
            <span className="home-demo__phase-label">{phase.title}</span>
          </button>
        ))}
      </nav>
      <div className="home-demo__explanation" aria-live={status === 'playing' ? 'off' : 'polite'}>
        <strong>
          {event.stepTitle}
          {event.kind === 'frame' ? ` · ${event.label}` : ''}
        </strong>
        <p>{event.description}</p>
      </div>
    </section>
  );
}
