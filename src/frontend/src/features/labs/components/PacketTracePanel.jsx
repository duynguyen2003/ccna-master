import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ChevronDown, ChevronUp, X } from 'lucide-react';
import DropdownSelect from '../../../components/ui/DropdownSelect';
import PlaybackControls from '../../protocols/components/PlaybackControls';
import PacketEventInspector from '../../protocols/components/PacketEventInspector';
import PacketSequenceView from '../../protocols/components/PacketSequenceView';
import { compareObservationEvent } from '../../protocols/model/observationComparison';
import { traceSummary } from '../../protocols/model/traceSummary';
import '../../protocols/styles/PacketObservation.css';
import '../styles/PacketTracePanel.css';

export default function PacketTracePanel({
  playback,
  devices,
  mode: controlledMode,
  onModeChange,
  detailTarget,
}) {
  const [localMode, setLocalMode] = useState('closed');
  const [view, setView] = useState(null);
  const mode = controlledMode ?? localMode;
  const changeMode = (next) => {
    setLocalMode(next);
    onModeChange?.(next);
  };
  const id = useId();
  const detailButton = useRef(null);
  const toggleButton = useRef(null);
  const previousMode = useRef(mode);
  useLayoutEffect(() => {
    if (
      previousMode.current === 'detail' &&
      mode !== 'detail' &&
      document.activeElement === document.body
    )
      detailButton.current?.focus();
    if (
      previousMode.current === 'quick' &&
      mode === 'closed' &&
      document.activeElement === document.body
    )
      toggleButton.current?.focus();
    previousMode.current = mode;
  }, [mode]);
  const viewport = useRef(null);
  const { model, index, select } = playback;
  const event = model.events[index];
  const summary = traceSummary(model, devices);
  const activeView = view || (summary.sequence ? 'sequence' : 'events');
  const firstQuickEvent = Math.max(0, Math.min(index - 1, model.events.length - 2));
  useLayoutEffect(() => {
    const container = viewport.current;
    const row = container?.querySelector('[aria-current="step"]');
    if (!row) return;
    const bounds = container.getBoundingClientRect();
    const box = row.getBoundingClientRect();
    if (mode !== 'detail') return;
    if (box.top < bounds.top) container.scrollTop -= bounds.top - box.top + 8;
    else if (box.bottom > bounds.bottom) container.scrollTop += box.bottom - bounds.bottom + 8;
  }, [index, mode, view, model.key]);
  const events = (
    <ol className="lab-trace-events" ref={viewport} aria-label="Danh sách sự kiện">
      {(mode === 'quick'
        ? model.events.slice(firstQuickEvent, firstQuickEvent + 2)
        : model.events
      ).map((item, offset) => {
        const row = mode === 'quick' ? firstQuickEvent + offset : offset;
        return (
          <li key={item.id}>
            <button
              type="button"
              aria-label={`Sự kiện ${row + 1}: ${item.label}`}
              aria-current={index === row ? 'step' : undefined}
              onClick={() => select(row)}
            >
              <span className="lab-trace-event-number" aria-hidden="true">
                {row + 1}
              </span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.actors.join(' → ') || 'Xử lý sự kiện'}</small>
              </span>
              {item.failure && <span className="lab-trace-error-mark">Lỗi</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
  const detail = (
    <section className="lab-trace-detail packet-observer" aria-label="Phân tích hành trình gói tin">
      <header className="lab-trace-detail-head">
        <button type="button" onClick={() => changeMode('quick')}>
          <ArrowLeft size={16} aria-hidden="true" /> Về bản xem nhanh
        </button>
        <strong>
          {summary.sourceId || summary.src || 'Nguồn'} → {summary.dst || 'Đích'}
        </strong>
      </header>
      <PlaybackControls playback={playback} />
      {summary.notice && <p className="lab-trace-local">{summary.notice}</p>}
      {summary.sequence && (
        <div className="packet-observer__views" role="group" aria-label="Cách xem hành trình">
          <button
            type="button"
            aria-pressed={activeView === 'events'}
            onClick={() => setView('events')}
          >
            Sự kiện
          </button>
          <button
            type="button"
            aria-pressed={activeView === 'sequence'}
            onClick={() => setView('sequence')}
          >
            Trình tự
          </button>
        </div>
      )}
      <div className="lab-trace-analysis">
        {activeView === 'sequence' && summary.sequence ? (
          <PacketSequenceView playback={playback} fitColumns />
        ) : (
          events
        )}
        <PacketEventInspector
          event={event}
          comparison={compareObservationEvent(model.events, index)}
        />
      </div>
    </section>
  );
  if (mode === 'hidden') return null;
  return (
    <section
      className={`packet-observer lab-trace lab-trace--${mode}`}
      aria-label="Hành trình gói tin"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || mode === 'closed') return;
        event.stopPropagation();
        changeMode(mode === 'detail' ? 'quick' : 'closed');
      }}
    >
      <header className="lab-trace-summary">
        <button
          type="button"
          ref={toggleButton}
          className="packet-observer__toggle"
          aria-label={mode === 'closed' ? 'Mở hành trình gói tin' : 'Thu gọn hành trình gói tin'}
          aria-expanded={mode !== 'closed'}
          aria-controls={id}
          onClick={() => changeMode(mode === 'closed' ? 'quick' : 'closed')}
        >
          {mode === 'closed' ? (
            <ChevronDown size={15} aria-hidden="true" />
          ) : (
            <ChevronUp size={15} aria-hidden="true" />
          )}
          {mode === 'closed' ? 'Hành trình gói tin' : 'Thu gọn'}
        </button>
        <div className="lab-trace-flow">
          <span>
            {summary.sourceId && <b>{summary.sourceId} </b>}
            {summary.sourceId && summary.src
              ? `(${summary.src})`
              : summary.src || 'Nguồn chưa có địa chỉ'}{' '}
            → {summary.dst || 'Đích chưa có địa chỉ'}
          </span>
          {summary.protocol && <span className="lab-trace-protocol">{summary.protocol}</span>}
          <span className={model.success ? 'packet-observer__success' : 'packet-observer__failure'}>
            {model.success ? 'Thành công' : 'Chưa tới đích'}
          </span>
          <span>{model.events.length} sự kiện</span>
        </div>
        <button
          type="button"
          className="lab-trace-open-detail"
          ref={detailButton}
          onClick={() => changeMode('detail')}
        >
          Xem chi tiết
        </button>
        <button
          type="button"
          className="lab-trace-hide"
          aria-label="Ẩn hành trình gói tin"
          title="Ẩn hành trình gói tin"
          onClick={() => changeMode('hidden')}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      {mode === 'quick' && (
        <div className="lab-trace-toolbar">
          <PlaybackControls playback={playback} />
          <DropdownSelect
            aria-label="Chuyển đến sự kiện"
            value={index}
            onChange={(event) => select(Number(event.target.value))}
          >
            {model.events.map((event, row) => (
              <option key={event.id} value={row}>
                {row + 1}. {event.label}
                {event.actors.length ? ` · ${event.actors.join(' → ')}` : ''}
              </option>
            ))}
          </DropdownSelect>
        </div>
      )}
      <div id={id} hidden={mode !== 'quick'} className="lab-trace-quick">
        {mode === 'quick' && (
          <>
            {summary.sequence ? <PacketSequenceView playback={playback} preview /> : events}
            <div className="lab-trace-explanation" aria-live="polite">
              <h3>{event?.label || 'Chưa có sự kiện'}</h3>
              <p>
                {summary.notice || event?.description || 'Chạy ping để xem hành trình gói tin.'}
              </p>
            </div>
          </>
        )}
      </div>
      {mode === 'detail' && (detailTarget ? createPortal(detail, detailTarget) : detail)}
    </section>
  );
}
