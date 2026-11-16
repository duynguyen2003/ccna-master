import React, { forwardRef } from 'react';

const PacketEventInspector = forwardRef(function PacketEventInspector(
  {
    event,
    comparison,
    showDescription = true,
    title,
    showPhase = true,
    hideEmpty = false,
    tabIndex,
    id,
    children,
  },
  ref
) {
  const groups = (event?.groups || []).filter((group) => group.fields.length);
  const payload =
    event?.kind === 'frame' && Array.isArray(event.raw?.payload) ? event.raw.payload : [];
  if (hideEmpty && !groups.length && !event?.detail && !payload.length && !children) return null;
  if (!event) return <p className="packet-observer__empty">Chưa có sự kiện để xem.</p>;
  return (
    <section
      ref={ref}
      id={id}
      className="packet-inspector"
      aria-label="Chi tiết sự kiện"
      tabIndex={tabIndex}
    >
      <h3>{title || event.label}</h3>
      {showDescription && <p>{event.description}</p>}
      {event.detail && <p className="packet-inspector__detail">{event.detail}</p>}
      {event.raw?.detail && event.raw.detail !== event.detail && (
        <details>
          <summary>Thông báo kỹ thuật gốc</summary>
          <p>{event.raw.detail}</p>
        </details>
      )}
      {showPhase && (
        <p className="packet-inspector__phase">
          {event.phaseLabel || (event.phase === 'reply' ? 'Chiều phản hồi' : 'Chiều yêu cầu')}
        </p>
      )}
      {comparison && (
        <div>
          <h4>
            Thay đổi từ sự kiện {comparison.from + 1} → {comparison.to + 1}
          </h4>
          <dl>
            {comparison.fields.map((field) => (
              <React.Fragment key={field.label}>
                <dt>{field.label}</dt>
                <dd>
                  {String(field.before)} → {String(field.after)}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      )}
      {groups.map((group) => (
        <div key={group.title}>
          <h4>{group.title}</h4>
          <dl>
            {group.fields.map(([label, value]) => (
              <React.Fragment key={label}>
                <dt>{label}</dt>
                <dd>{String(value)}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      ))}
      {payload.length > 0 && (
        <div>
          <h4>Thông điệp</h4>
          <pre className="packet-inspector__payload">{payload.join('\n')}</pre>
        </div>
      )}
      {children}
    </section>
  );
});

export default PacketEventInspector;
