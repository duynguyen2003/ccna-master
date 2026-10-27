import React from 'react';
import './HeroTopology.css';

const devices = [
  { id: 'PC1', type: '', icon: 'pc' },
  { id: 'S1', type: 'Switch', icon: 'switch' },
  { id: 'R1', type: 'Router', icon: 'router' },
  { id: 'Cloud', type: '', icon: 'cloud' },
];

function DeviceIcon({ type }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      {type === 'pc' && (
        <>
          <rect x="4" y="5" width="24" height="16" rx="2" />
          <path d="M12 26h8M16 21v5M7 18h18" />
        </>
      )}
      {type === 'switch' && (
        <>
          <rect x="3" y="8" width="26" height="16" rx="3" />
          <path d="M7 13h2m3 0h2m3 0h2m3 0h2M7 19h2m3 0h2m3 0h2m3 0h2" />
        </>
      )}
      {type === 'router' && (
        <>
          <ellipse cx="16" cy="9" rx="11" ry="4" />
          <path d="M5 9v11c0 2.2 4.9 4 11 4s11-1.8 11-4V9M5 15c0 2.2 4.9 4 11 4s11-1.8 11-4" />
          <path d="M12 9h8m-3-2 3 2-3 2" />
        </>
      )}
      {type === 'cloud' && (
        <path d="M9.5 24h14a5.5 5.5 0 0 0 .7-11 8.5 8.5 0 0 0-16.3 1A5 5 0 0 0 9.5 24Z" />
      )}
    </svg>
  );
}

/** A decorative network sketch; it does not represent a live connection. */
export default function HeroTopology({ compact = false }) {
  return (
    <div className={`hero-topology${compact ? ' hero-topology--compact' : ''}`} aria-hidden="true">
      <div className="hero-topology__track">
        {devices.map((device, index) => (
          <React.Fragment key={device.id}>
            <div className="hero-topology__node">
              <div className="hero-topology__device">
                <DeviceIcon type={device.icon} />
              </div>
              <span className="hero-topology__label">
                {device.type && <span className="hero-topology__type">{device.type} </span>}
                <strong>{device.id}</strong>
              </span>
            </div>
            {index < devices.length - 1 && (
              <span className={`hero-topology__link hero-topology__link--${index + 1}`}>
                <span className="hero-topology__packet-rail">
                  <span className="hero-topology__packet-motion">
                    <span className="hero-topology__packet" />
                  </span>
                </span>
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
