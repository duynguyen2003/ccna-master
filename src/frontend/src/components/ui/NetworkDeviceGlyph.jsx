import React from 'react';
import './styles/NetworkDeviceGlyph.css';

const assetRoot = `${(process.env.PUBLIC_URL || '').replace(/\/$/, '')}/network-devices`;
const sourceDevices = {
  PC: 'laptop',
  LAPTOP: 'laptop',
  ROUTER: 'router',
  CLOUD: 'cloud',
  DNS: 'dns',
  SERVER: 'web',
  SWITCH: 'switch',
  CAMERA: 'camera',
  TV_BOX: 'tv',
};

// Center the visible device at (0, 0) in the 68×74 image box. The source SVG
// viewBoxes include an asymmetric ground shadow, which must not shift the
// artwork away from the node's selection ring, label and wire anchors.
const artworkPosition = {
  router: { x: -27.61, y: -33.31 },
  laptop: { x: -29.19, y: -33.92 },
  cloud: { x: -32.29, y: -35.86 },
  dns: { x: -25.35, y: -32.01 },
  web: { x: -25.6, y: -32.15 },
  switch: { x: -34, y: -37 },
  camera: { x: -34, y: -37 },
  tv: { x: -34, y: -37 },
};

/** Original Protocol Explorer artwork; the owning node supplies its accessible name. */
export default function NetworkDeviceGlyph({ type }) {
  const device = sourceDevices[type] || 'laptop';
  return (
    <g className="network-device-glyph" aria-hidden="true">
      {['light', 'dark'].map((theme) => (
        <image
          key={theme}
          className={`device-glyph-original device-glyph-original--${theme}`}
          href={`${assetRoot}/${device}-${theme}.svg`}
          x={artworkPosition[device].x}
          y={artworkPosition[device].y}
          width="68"
          height="74"
          preserveAspectRatio="xMidYMid meet"
        />
      ))}
    </g>
  );
}
