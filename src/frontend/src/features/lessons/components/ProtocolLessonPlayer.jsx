import { Eye, ExternalLink, ListOrdered, Network } from 'lucide-react';
import SlidingTabs from '../../../components/ui/SlidingTabs';
import PhaseNavigation from '../../protocols/components/PhaseNavigation';
import { getProtocolScenario } from '../../protocols/data/lessonCatalog';
import { hasLessonDetails, lessonEventContext } from '../../protocols/model/lessonPresentation';
import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import DropdownSelect from '../../../components/ui/DropdownSelect';
import { catalogVersion, loadProtocolLesson } from '../../protocols/data/lessonCatalog';
import { lessonVietnamese } from '../../protocols/data/lessonVietnamese';
import { createLessonObservation } from '../../protocols/model/lessonObservation';
import useObservationPlayback from '../../protocols/hooks/useObservationPlayback';
import PlaybackControls from '../../protocols/components/PlaybackControls';
import PacketSequenceView from '../../protocols/components/PacketSequenceView';
import PacketEventInspector from '../../protocols/components/PacketEventInspector';
import LessonNetworkView from '../../protocols/components/LessonNetworkView';
import '../../protocols/styles/PacketObservation.css';
import ScrollRail from '../../../components/ui/ScrollRail';
import '../../protocols/styles/ProtocolLesson.css';

function readSeen(key, events) {
  if (!key) return [];
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return Array.isArray(saved)
      ? saved.filter((id) => events.some((event) => event.id === id))
      : [];
  } catch {
    return [];
  }
}

export function LoadedProtocolLesson({ lesson, userId, lessonId = 'library' }) {
  const key = [catalogVersion, lesson.id, lessonId, userId || 'preview'].join(':');
  const model = useMemo(() => createLessonObservation(lesson, key), [lesson, key]);
  const playback = useObservationPlayback(model, { autoPlay: false });
  const [view, setView] = useState('network');
  const storageKey = userId ? 'netmaster:protocol-view:' + key : null;
  const [seen, setSeen] = useState(() => readSeen(storageKey, model.events));
  const [saved, setSaved] = useState(true);
  const information = useRef(null);
  const explanation = useRef(null);
  const inspector = useRef(null);
  const informationId = useId();
  const event = model.events[playback.index];
  useLayoutEffect(() => {
    for (const viewport of [information, explanation, inspector])
      if (viewport.current) viewport.current.scrollTop = 0;
  }, [event?.id]);
  useEffect(() => {
    if (!event || playback.status === 'idle') return;
    setSeen((previous) => (previous.includes(event.id) ? previous : [...previous, event.id]));
  }, [event, playback.status]);
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(seen));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [storageKey, seen]);
  const phases = lesson.steps.map((step, i) => {
    const entries = model.events.filter((entry) => entry.stepIndex === i);
    return {
      title: (lesson.teaching?.steps || lessonVietnamese[lesson.id])?.[i]?.[0] || step.title,
      total: entries.length,
      seen: entries.filter((entry) => seen.includes(entry.id)).length,
    };
  });
  const viewedPhases = phases.filter((phase) => phase.seen === phase.total).length;
  const currentStep = event?.stepIndex || 0;
  const scenario = getProtocolScenario?.(lesson.id);
  const context = lessonEventContext(event);
  const details = hasLessonDetails(event);
  const status = {
    idle: 'Sẵn sàng',
    playing: 'Đang phát',
    paused: 'Đã tạm dừng',
    complete: 'Đã phát hết',
  }[playback.status];
  return (
    <section className="packet-observer protocol-lesson" aria-label={'Mô phỏng ' + lesson.name}>
      <header className="protocol-lesson__header">
        <div className="protocol-lesson__identity">
          <span className="protocol-lesson__protocol">{lesson.name}</span>
          <div>
            <h2>{scenario?.title || lesson.name}</h2>
            <p>
              {phases.length} giai đoạn <span aria-hidden="true">·</span> {model.events.length} sự
              kiện
            </p>
          </div>
        </div>
        <span className="protocol-lesson__status" data-state={playback.status} role="status">
          {status}
        </span>
      </header>
      <div className="protocol-lesson__toolbar">
        <PlaybackControls playback={playback} detailed />
        <SlidingTabs className="protocol-lesson__views" value={view} aria-label="Cách xem mô phỏng">
          <button
            type="button"
            aria-pressed={view === 'network'}
            onClick={() => setView('network')}
          >
            <Network size={16} aria-hidden="true" />
            Sơ đồ mạng
          </button>
          <button
            type="button"
            aria-pressed={view === 'sequence'}
            onClick={() => setView('sequence')}
          >
            <ListOrdered size={16} aria-hidden="true" />
            Trình tự
          </button>
        </SlidingTabs>
      </div>
      <div className="protocol-lesson__workspace">
        <PhaseNavigation
          phases={phases}
          current={currentStep}
          onSelect={(step) => playback.select(model.stepStarts[step])}
        />
        <div className="protocol-lesson__canvas">
          <div className="protocol-lesson__eventbar">
            <label>
              <span>Sự kiện</span>
              <DropdownSelect
                className="protocol-lesson__event-select"
                aria-label="Sự kiện"
                value={playback.index}
                onChange={(e) => playback.select(Number(e.target.value))}
              >
                {model.events.map((entry, i) => (
                  <option key={entry.id} value={i}>
                    {i + 1}. {entry.label}
                    {entry.failure ? ' · Mất gói' : ''}
                  </option>
                ))}
              </DropdownSelect>
            </label>
            <span className="protocol-lesson__direction">{context.actors}</span>
          </div>
          <div
            className="protocol-lesson__stage"
            style={{
              '--protocol-mobile-stage-height':
                Math.max(
                  330,
                  200 +
                    Math.ceil(
                      (event?.visible || []).filter(
                        (id) => !['client', 'router', 'internet'].includes(id)
                      ).length / 2
                    ) *
                      130
                ) + 'px',
            }}
          >
            <div hidden={view !== 'network'}>
              <LessonNetworkView lesson={lesson} playback={playback} />
            </div>
            {view === 'sequence' && <PacketSequenceView playback={playback} compactColumns />}
          </div>
        </div>
      </div>
      <div className="protocol-lesson__information">
        <div
          ref={information}
          id={`${informationId}-information`}
          role="group"
          aria-label="Thông tin sự kiện"
          className={
            'protocol-lesson__details' + (!details ? ' protocol-lesson__details--single' : '')
          }
        >
          <div className="protocol-lesson__information-panel">
            <section
              ref={explanation}
              id={`${informationId}-explanation`}
              className="protocol-lesson__explanation"
              aria-label="Giải thích sự kiện"
              tabIndex={0}
            >
              <h3>Điều gì đang xảy ra?</h3>
              <strong className="protocol-lesson__action">{context.action}</strong>
              <p className="protocol-lesson__actors">{context.actors}</p>
              <p>{context.explanation}</p>
              {event?.raw.type === 'note' && event.raw.text && (
                <blockquote>{event.noteText}</blockquote>
              )}
            </section>
            <ScrollRail viewportRef={explanation} label="Cuộn giải thích sự kiện" />
          </div>
          {details && (
            <div className="protocol-lesson__information-panel">
              <PacketEventInspector
                ref={inspector}
                id={`${informationId}-inspector`}
                event={event}
                title="Chi tiết sự kiện"
                showDescription={false}
                showPhase={false}
                hideEmpty
                tabIndex={0}
              >
                {event?.raw.row?.wire && (
                  <details>
                    <summary>Header gói tin</summary>
                    <pre>{JSON.stringify(event.raw.row.wire, null, 2)}</pre>
                  </details>
                )}
              </PacketEventInspector>
              <ScrollRail viewportRef={inspector} label="Cuộn chi tiết sự kiện" />
            </div>
          )}
        </div>
        <ScrollRail
          viewportRef={information}
          label="Cuộn thông tin sự kiện"
          className="protocol-lesson__information-rail"
        />
      </div>
      <footer>
        <div className="protocol-lesson__viewed">
          <Eye size={14} aria-hidden="true" />
          <span>
            Đã xem {seen.length}/{model.events.length} sự kiện · {viewedPhases}/{phases.length} giai
            đoạn
          </span>
        </div>
        <div className="protocol-lesson__footnotes">
          <span>
            {userId
              ? saved
                ? 'Tiến độ xem lưu trên trình duyệt này.'
                : 'Không lưu được tiến độ trên trình duyệt này.'
              : 'Chế độ xem trước, không lưu tiến độ.'}
          </span>
          <a href="https://protocol-explorer-alpha.vercel.app/" target="_blank" rel="noreferrer">
            Nguồn: Protocol Explorer <ExternalLink size={12} aria-hidden="true" />
          </a>
        </div>
      </footer>
    </section>
  );
}

export default function ProtocolLessonPlayer({ protocolId, userId, lessonId }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ id: null });
  useEffect(() => {
    let active = true;
    setState({ id: protocolId });
    loadProtocolLesson(protocolId).then(
      (lesson) => {
        if (active) setState({ id: protocolId, lesson });
      },
      () => {
        if (active) setState({ id: protocolId, error: true });
      }
    );
    return () => {
      active = false;
    };
  }, [protocolId, attempt]);
  if (state.id !== protocolId || (!state.lesson && !state.error))
    return <p role="status">Đang tải mô phỏng…</p>;
  if (state.error)
    return (
      <div role="alert">
        Không tải được mô phỏng.{' '}
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Thử lại
        </button>
      </div>
    );
  return (
    <LoadedProtocolLesson
      key={`${protocolId}:${userId || 'preview'}:${lessonId || 'library'}`}
      lesson={state.lesson}
      userId={userId}
      lessonId={lessonId}
    />
  );
}
