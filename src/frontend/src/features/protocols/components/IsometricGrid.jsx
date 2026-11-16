import React, { useId } from 'react';

export default function IsometricGrid({ x = 0, y = 0, width, height }) {
  const id = `iso-${useId().replace(/:/g, '')}`;
  return (
    <g aria-hidden="true" pointerEvents="none">
      <defs>
        <pattern id={id} width="64" height="36" patternUnits="userSpaceOnUse">
          <path
            d="M0 0L64 36M64 0L0 36"
            fill="none"
            stroke="var(--border-subtle, #cbd9e5)"
            strokeWidth="var(--isometric-grid-width, 0.8)"
            opacity="var(--isometric-grid-opacity, 0.45)"
          />
        </pattern>
      </defs>
      <rect x={x} y={y} width={width} height={height} fill={`url(#${id})`} />
    </g>
  );
}
