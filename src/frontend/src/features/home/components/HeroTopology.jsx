import React from 'react';
import NetworkDeviceGlyph from '../../../components/ui/NetworkDeviceGlyph';
import './HeroTopology.css';

const devices = [
  { id: 'PC1', type: '', icon: 'pc' },
  { id: 'S1', type: 'Switch', icon: 'switch' },
  { id: 'R1', type: 'Router', icon: 'router' },
  { id: 'Cloud', type: '', icon: 'cloud' },
];

/** A decorative network sketch; it does not represent a live connection. */
export default function HeroTopology({ compact = false }) {
  return (
    <div className={`hero-topology${compact ? ' hero-topology--compact' : ''}`} aria-hidden="true">
      <div className="hero-topology__track">
        {devices.map((device, index) => (
          <React.Fragment key={device.id}>
            <div className="hero-topology__node">
              <div className="hero-topology__device">
                <svg viewBox="-38 -42 76 80" aria-hidden="true" focusable="false">
                  <NetworkDeviceGlyph type={device.icon.toUpperCase()} />
                </svg>
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
