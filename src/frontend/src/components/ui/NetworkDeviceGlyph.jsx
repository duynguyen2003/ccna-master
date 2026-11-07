import React from 'react';
import './styles/NetworkDeviceGlyph.css';

const assetRoot = `${(process.env.PUBLIC_URL || '').replace(/\/$/, '')}/network-devices`;
const sourceDevices = { PC: 'laptop', LAPTOP: 'laptop', ROUTER: 'router', CLOUD: 'cloud' };

/** Original Protocol Explorer artwork; the owning node supplies its accessible name. */
export default function NetworkDeviceGlyph({ type }) {
  const device = type === 'SWITCH' ? null : sourceDevices[type] || 'laptop';
  return (
    <g className="network-device-glyph" aria-hidden="true">
      {device ? (
        <>
          {['light', 'dark'].map((theme) => (
            <image
              key={theme}
              className={`device-glyph-original device-glyph-original--${theme}`}
              href={`${assetRoot}/${device}-${theme}.svg`}
              x="-34"
              y="-39"
              width="68"
              height="74"
              preserveAspectRatio="xMidYMid meet"
            />
          ))}
        </>
      ) : (
        <>
          {/* The reference has no switch; retain the existing switch illustration. */}
          <ellipse className="device-glyph-shadow" cx="1" cy="25" rx="30" ry="7" />
          <path className="device-glyph-front" d="m-31-3 20 12v15l-20-12Z" />
          <path className="device-glyph-side" d="M-11 9 31-15V0l-42 24Z" />
          <path className="device-glyph-top" d="m-31-3 42-24 20 12L-11 9Z" />
          <g className="device-glyph-detail">
            <path d="m-19-5 22-13m-16 17L9-14m-22 4 5 3-5 3m15-12-5-3 5-3M-25 9l8 5" />
            {Array.from({ length: 6 }, (_, i) => {
              const x = -5 + i * 5.5;
              const y = 10 - i * 3.15;
              return <path key={i} d={`m${x} ${y} 3-1.7v5L${x} ${y + 5}Z`} />;
            })}
          </g>
        </>
      )}
    </g>
  );
}
