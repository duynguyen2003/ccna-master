import React, { useLayoutEffect, useRef, useState } from 'react';
import { packetPayload, packetTitle, packetTone } from '../model/packetPresentation';
import { packetGlyphPlacement, packetGlyphScreenScale } from './packetGlyphLayout';
import '../styles/PacketVisual.css';

export function fitPacketGlyphTag(tag) {
  const requestedScale = Number(tag?.dataset.packetCardScale);
  if (!requestedScale || !tag.getBBox || !tag.parentElement?.getScreenCTM) return;
  const viewport = tag.ownerSVGElement?.getBoundingClientRect();
  const matrix = tag.parentElement.getScreenCTM();
  if (!viewport?.width || !viewport.height || !matrix || matrix.a <= 0 || matrix.d <= 0) return;
  const box = tag.getBBox();
  if (!box.width || !box.height) return;
  // Keep the label readable while the animated packet point pops in or out.
  const diagramScale = tag.ownerSVGElement.getScreenCTM?.()?.a || matrix.a;
  const field = tag.querySelector('.packet-visual__field');
  const text = field || tag.querySelector('.packet-visual__title');
  const fontSize = parseFloat(getComputedStyle(text).fontSize);
  const readableScale = packetGlyphScreenScale(
    fontSize,
    diagramScale,
    requestedScale,
    Boolean(field)
  );
  const scale = readableScale / matrix.a;
  const placement = packetGlyphPlacement(box, viewport, matrix, scale, {
    clearance: Math.max(28, diagramScale * (Number(tag.dataset.packetCardClearance) || 60)),
  });
  tag.setAttribute(
    'transform',
    `translate(${placement.x} ${placement.y}) scale(${placement.scale})`
  );
}

export default function PacketGlyph({ event, scale = 1, clearance }) {
  const label = packetTitle(event);
  const payload = packetPayload(event).slice(0, 4);
  const locked = Boolean(event?.raw?.locked);
  const tag = useRef(null);
  const [width, setWidth] = useState(150);
  const contentKey = JSON.stringify([label, payload, locked]);
  useLayoutEffect(() => {
    const texts = [...(tag.current?.querySelectorAll('text') || [])];
    const measure = () =>
      setWidth(
        Math.max(
          100,
          ...texts.map(
            (el) => (el.getComputedTextLength?.() || el.textContent.length * 7) + (locked ? 42 : 24)
          )
        )
      );
    measure();
    let active = true;
    document.fonts?.ready.then(() => {
      if (active) measure();
    });
    return () => {
      active = false;
    };
  }, [contentKey, locked]);
  useLayoutEffect(() => {
    if (scale > 1) fitPacketGlyphTag(tag.current);
  }, [width, scale, clearance, contentKey]);
  const height = payload.length * 16;
  return (
    <g className={`packet-visual packet-tone--${packetTone(event)}`}>
      <circle className="packet-visual__halo" r="13" />
      <circle className="packet-visual__core" r="6" />
      <g
        ref={tag}
        className="packet-visual__tag"
        data-packet-card-scale={scale > 1 ? scale : undefined}
        data-packet-card-clearance={clearance}
        transform={`translate(0 -22) scale(${scale})`}
      >
        <rect
          className="packet-visual__body"
          x={-width / 2}
          y={-height - 24}
          width={width}
          height={height + 28}
          rx="4"
        />
        <path
          className="packet-visual__title-bg"
          d={`M${-width / 2},${-height - 24}h${width}v24h${-width / 2 + 5}l-5,6l-5,-6h${-width / 2 + 5}Z`}
        />
        <text
          className="packet-visual__title"
          textAnchor="middle"
          x={locked ? 7 : 0}
          y={-height - 8}
        >
          {label}
        </text>
        {locked && (
          <g
            transform={'translate(' + (-width / 2 + 7) + ' ' + (-height - 20) + ')'}
            className="packet-visual__lock"
          >
            <path d="M3 7V4a3 3 0 0 1 6 0v3M1 7h10v9H1Z" />
          </g>
        )}
        {payload.map((line, i) => (
          <text
            className="packet-visual__field"
            key={i}
            x={-width / 2 + 10}
            y={-height + 17 + i * 16}
          >
            {line}
          </text>
        ))}
      </g>
    </g>
  );
}
