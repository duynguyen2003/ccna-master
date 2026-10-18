import React from 'react';
import './HeartbeatLoader.css';

const TRACE = 'M 4 24 H 48 L 58 18 L 66 31 L 78 4 L 90 44 L 102 24 H 126 Q 138 8 150 24 H 204';

const HeartbeatLoader = ({
  label = 'Đang tải...',
  fullScreen = false,
  compact = false,
  dark = false,
}) => (
  <div
    className={`heartbeat-loader${fullScreen ? ' heartbeat-loader--fullscreen' : ''}${compact ? ' heartbeat-loader--compact' : ''}${dark ? ' heartbeat-loader--dark' : ''}`}
    role="status"
  >
    <span className="heartbeat-loader__trace" aria-hidden="true">
      <svg width="208" height="48" viewBox="0 0 208 48" fill="none" focusable="false">
        <path d={TRACE} />
      </svg>
      <span className="heartbeat-loader__dot" style={{ offsetPath: `path("${TRACE}")` }} />
    </span>
    <span className="heartbeat-loader__label">{label}</span>
  </div>
);

export default HeartbeatLoader;
