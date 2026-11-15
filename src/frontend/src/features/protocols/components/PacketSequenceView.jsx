import React, { useLayoutEffect, useRef, useState } from 'react';
import { packetTone } from '../model/packetPresentation';
import '../styles/PacketVisual.css';

export default function PacketSequenceView({
  playback,
  compactColumns = false,
  preview = false,
  fitColumns = false,
}) {
  const { model, index, select } = playback;
  const viewport = useRef(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  useLayoutEffect(() => {
    const element = viewport.current;
    const measure = () => setAvailableWidth(element?.clientWidth || 0);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const actorEvents = model.actorMeta
    ? model.events.filter((event) => event.kind === 'frame')
    : model.events;
  const actors = model.lifelines || [...new Set(actorEvents.flatMap((event) => event.actors))];
  const actorLabel = (actor) =>
    model.events[index]?.nodeLabels?.[actor] || [
      model.actorMeta?.[actor]?.name || actor,
      model.actorMeta?.[actor]?.address,
    ];
  const compact =
    preview || fitColumns || (compactColumns && availableWidth > 0 && availableWidth < 540);
  const left = preview ? 54 : compact ? 60 : 128;
  const right = preview ? 36 : compact ? 50 : 80;
  const width = preview
    ? Math.max(240, availableWidth)
    : compact
      ? Math.max(availableWidth, left + right + Math.max(0, actors.length - 1) * 98)
      : Math.max(560, availableWidth, 128 + actors.length * 180);
  const x = (actor) =>
    actors.length < 2
      ? width / 2
      : left + (Math.max(0, actors.indexOf(actor)) * (width - left - right)) / (actors.length - 1);
  const firstRow = preview ? Math.max(0, Math.min(index - 1, model.events.length - 2)) : 0;
  const visibleEvents = preview ? model.events.slice(firstRow, firstRow + 2) : model.events;
  let cursor = preview ? 20 : 30,
    lastStep = null;
  const rows = visibleEvents.map((event, offset) => {
    const heading = !preview && event.stepIndex != null && lastStep !== event.stepIndex;
    if (heading) cursor += 28;
    lastStep = event.stepIndex;
    const row = { event, y: cursor, heading, index: firstRow + offset };
    cursor += preview ? 36 : event.kind === 'frame' ? 68 : 52;
    return row;
  });
  useLayoutEffect(() => {
    const container = viewport.current,
      row = rows.find((row) => row.index === index);
    if (!container || !row || preview) return;
    const event = row.event;
    const center =
      (x(event.from?.deviceId || event.actors[0]) + x(event.to?.deviceId || event.actors[0])) / 2;
    container.scrollLeft = Math.max(0, center - container.clientWidth / 2);
    const top = row.y + 60,
      bottom = top + 50;
    if (top < container.scrollTop + 64) container.scrollTop = Math.max(0, top - 64);
    else if (bottom > container.scrollTop + container.clientHeight)
      container.scrollTop = bottom - container.clientHeight;
    // Positions belong to this event source; equivalent polling must not move the viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, model.key, width]);
  return (
    <div
      className={
        'packet-sequence' +
        (compact ? ' packet-sequence--compact' : '') +
        (preview ? ' packet-sequence--preview' : '')
      }
      ref={viewport}
      tabIndex={0}
      role="region"
      aria-label="Sequence: thứ tự gửi và nhận"
    >
      <div className="packet-sequence__actors" style={{ width }} aria-hidden="true">
        {actors.map((actor) => (
          <span key={actor} style={{ left: x(actor) }}>
            <strong>{actorLabel(actor)[0]}</strong>
            {actorLabel(actor)[1] && <small>{actorLabel(actor)[1]}</small>}
          </span>
        ))}
      </div>
      <svg
        width={width}
        height={preview ? cursor + 4 : Math.max(140, cursor + 28)}
        aria-label="Sơ đồ trình tự"
      >
        {actors.map((actor) => (
          <line
            key={actor}
            x1={x(actor)}
            x2={x(actor)}
            y1="0"
            y2={cursor + 20}
            className="packet-sequence__lifeline"
          />
        ))}
        {rows.map(({ event, y, heading, index: row }) => {
          const wire =
            event.kind === 'frame' &&
            event.from?.deviceId &&
            event.to?.deviceId &&
            event.from.deviceId !== event.to.deviceId;
          const start = x(wire ? event.from.deviceId : event.actors[0]),
            destination = wire ? x(event.to.deviceId) : start;
          const end = event.failure ? (start + destination) / 2 : destination;
          const rise = preview ? 16 : 30;
          const endY = y + (wire ? rise : 0);
          const center = (start + end) / 2;
          const angle =
            (Math.atan2((end >= start ? 1 : -1) * rise, Math.abs(end - start)) * 180) / Math.PI;
          const maxLabelLength =
            preview && wire
              ? Math.max(6, Math.floor(Math.abs(end - start) / 7) - 2)
              : compact
                ? Math.floor((width - 44) / 7)
                : 44;
          const label =
            event.label.length > maxLabelLength
              ? event.label.slice(0, maxLabelLength - 1) + '…'
              : event.label;
          const labelWidth = Math.max(54, label.length * 7 + 20);
          const labelX = wire
            ? center
            : Math.min(
                width - labelWidth / 2 - 12,
                Math.max(labelWidth / 2 + 12, start + labelWidth / 2 + 14)
              );
          return (
            <React.Fragment key={event.id}>
              {heading && (
                <g className="packet-sequence__step" aria-hidden="true">
                  <line x1="12" x2={width - 12} y1={y - 24} y2={y - 24} />
                  <text x="12" y={y - 28}>
                    BƯỚC {event.stepIndex + 1} · {event.stepTitle || event.label}
                  </text>
                </g>
              )}
              <g
                className={
                  'packet-sequence__event packet-tone--' +
                  packetTone(event) +
                  (index === row ? ' is-observed' : '') +
                  (row > index ? ' is-pending' : '')
                }
                role="button"
                tabIndex={0}
                aria-label={
                  'Sự kiện ' + (row + 1) + ': ' + event.label + ', ' + event.actors.join(' → ')
                }
                aria-current={index === row ? 'step' : undefined}
                onClick={() => select(row)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    select(row);
                  }
                }}
              >
                <rect
                  x="4"
                  y={y - (preview ? 16 : 18)}
                  width={width - 8}
                  height={preview ? 34 : wire ? 62 : 46}
                  rx="5"
                  className="packet-sequence__hit"
                />
                <text
                  className="packet-sequence__time"
                  x={compact ? 42 : 78}
                  y={y + 4}
                  textAnchor="end"
                >
                  {event.raw?.row?.time || '#' + (row + 1)}
                </text>
                {wire ? (
                  <>
                    <line
                      x1={start}
                      x2={end}
                      y1={y}
                      y2={endY}
                      strokeDasharray={event.failure ? '5 4' : undefined}
                      className="packet-sequence__arrow"
                    />
                    {!event.failure && (
                      <path
                        className="packet-sequence__tip"
                        d="M0 0L-8-4L-8 4Z"
                        transform={
                          'translate(' +
                          end +
                          ' ' +
                          endY +
                          ') rotate(' +
                          (Math.atan2(endY - y, end - start) * 180) / Math.PI +
                          ')'
                        }
                      />
                    )}
                    <circle cx={start} cy={y} r="3" />
                    {event.failure && (
                      <path
                        className="packet-sequence__cross"
                        d={'M' + (end - 5) + ' ' + (endY - 5) + 'l10 10m-10 0l10-10'}
                      />
                    )}
                  </>
                ) : actors.includes(event.actors[0]) ? (
                  <circle cx={start} cy={y} r="4" />
                ) : null}
                <g
                  className="packet-sequence__label"
                  transform={
                    'translate(' +
                    labelX +
                    ' ' +
                    (wire ? (y + endY) / 2 - 4 : y - 2) +
                    ') rotate(' +
                    (wire ? angle : 0) +
                    ')'
                  }
                >
                  <rect x={-labelWidth / 2} y="-16" width={labelWidth} height="23" rx="3" />
                  <text textAnchor="middle" y="0">
                    {label}
                    {event.failure ? ' ×' : ''}
                  </text>
                </g>
                <title>{event.label + (event.detail ? ' · ' + event.detail : '')}</title>
              </g>
            </React.Fragment>
          );
        })}
      </svg>
    </div>
  );
}
