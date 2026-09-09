import React, { useEffect, useMemo, useRef } from 'react';
import { gsap, prefersReducedMotion } from '../../utils/labMotion';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const packetKey = (packet) =>
  packet?.animationKey ||
  (packet?.events || [])
    .map((event) =>
      [
        event.type,
        event.deviceId,
        event.from?.deviceId,
        event.to?.deviceId,
        event.packet?.ttl,
      ].join(':')
    )
    .join('|');

const hopList = (packet, byId) => {
  const frames = (packet?.events || []).filter(
    (event) => event.type === 'FRAME' && event.from?.deviceId && event.to?.deviceId
  );
  const hops = frames.map((event) => ({ from: event.from.deviceId, to: event.to.deviceId }));
  if (hops.length) return hops;
  const seen = [];
  (packet?.events || []).forEach((event) => {
    if (event.deviceId && byId[event.deviceId] && seen.at(-1) !== event.deviceId)
      seen.push(event.deviceId);
  });
  return seen.slice(0, -1).map((from, index) => ({ from, to: seen[index + 1] }));
};

export default function NetworkTopology({
  devices,
  links = [],
  selected,
  onSelect,
  onMove,
  onLinkSelect,
  selectedLink,
  packet,
  stp = {},
  disabled = false,
}) {
  const svgRef = useRef(null);
  const markerRef = useRef(null);
  const animationTimeline = useRef(null);
  const drag = useRef(null);
  const animatedKey = useRef('');
  const list = useMemo(
    () =>
      Array.isArray(devices)
        ? devices
        : Object.entries(devices || {}).map(([id, d]) => ({ ...d, id })),
    [devices]
  );
  const byId = useMemo(() => Object.fromEntries(list.map((device) => [device.id, device])), [list]);
  const position = (id) => byId[id]?.position || { x: 100, y: 100 };
  const animationId = packetKey(packet);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return undefined;
    if (!animationId) {
      animationTimeline.current?.kill();
      animationTimeline.current = null;
      animatedKey.current = '';
      marker.setAttribute('visibility', 'hidden');
      return undefined;
    }
    if (animatedKey.current === animationId) return undefined;
    animatedKey.current = animationId;
    const hops = hopList(packet, byId)
      .filter((hop) => byId[hop.from] && byId[hop.to])
      .filter(
        (hop, index, all) =>
          index === 0 || hop.from !== all[index - 1].from || hop.to !== all[index - 1].to
      );
    if (!hops.length || prefersReducedMotion()) {
      marker.setAttribute('visibility', 'hidden');
      return undefined;
    }
    const timeline = gsap.timeline({
      onComplete: () => marker.setAttribute('visibility', 'hidden'),
    });
    animationTimeline.current = timeline;
    gsap.set(marker, { x: 0, y: 0, clearProps: 'transform', attr: { cx: 0, cy: 0 } });
    marker.setAttribute('visibility', 'visible');
    hops.forEach((hop) => {
      const a = position(hop.from);
      const b = position(hop.to);
      timeline.to(marker, {
        duration: 0.48,
        ease: 'power1.inOut',
        motionPath: { path: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, autoRotate: false },
      });
    });
    return () => {
      timeline.kill();
      if (animationTimeline.current === timeline) animationTimeline.current = null;
      marker.setAttribute('visibility', 'hidden');
      // StrictMode mounts effects twice. Clearing the key lets the second
      // mount replay the packet instead of leaving a hidden marker behind.
      if (animatedKey.current === animationId) animatedKey.current = '';
    };
    // The animation is keyed by the packet signature. Polling replaces the
    // state object, so depending on the whole packet would tear down an active
    // route animation when the server returns the same event again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationId]);

  const move = (event) => {
    if (!drag.current || !onMove || disabled) return;
    const svg = svgRef.current;
    const rect = svg?.getBoundingClientRect();
    if (!svg || !rect?.width || !rect?.height) return;
    let point;
    try {
      const source = svg.createSVGPoint();
      source.x = event.clientX;
      source.y = event.clientY;
      point = source.matrixTransform(svg.getScreenCTM()?.inverse());
    } catch {
      point = {
        x: ((event.clientX - rect.left) * 1000) / rect.width,
        y: ((event.clientY - rect.top) * 600) / rect.height,
      };
    }
    onMove(drag.current, {
      x: clamp(point.x, 40, 960),
      y: clamp(point.y, 40, 560),
    });
  };
  const finishDrag = () => {
    drag.current = null;
  };
  const selectLink = (link) => {
    if (!onLinkSelect || disabled) return;
    onLinkSelect(link);
  };

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1000 600"
      className="network-topology"
      aria-label="Sơ đồ mạng"
      onPointerMove={move}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      {links.map((link) => {
        const a = position(link.a.deviceId);
        const b = position(link.b.deviceId);
        const blocked = Object.values(stp || {}).some((value) =>
          [link.a, link.b].some(
            (port) => value.ports?.[`${port.deviceId}:${port.interface}`] === 'BLOCKING'
          )
        );
        const shutdown = [link.a, link.b].some(
          (port) => byId[port.deviceId]?.interfaces?.[port.interface]?.shutdown
        );
        const stateClass =
          link.enabled === false || shutdown ? 'link-down' : blocked ? 'link-blocked' : 'link-up';
        const linkLabel = `${link.id}: ${link.a.deviceId}:${link.a.interface} ↔ ${link.b.deviceId}:${link.b.interface}`;
        return (
          <g
            key={link.id}
            className={`network-link ${selectedLink === link.id ? 'selected' : ''}`}
            role={onLinkSelect ? 'button' : undefined}
            tabIndex={onLinkSelect && !disabled ? 0 : undefined}
            aria-label={onLinkSelect ? `Chọn dây ${linkLabel}` : undefined}
            aria-disabled={disabled || undefined}
            onClick={() => selectLink(link)}
            onKeyDown={(event) => {
              if (['Enter', ' '].includes(event.key)) {
                event.preventDefault();
                selectLink(link);
              }
            }}
          >
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="network-link-hit" />
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={stateClass}
              data-testid={stateClass}
              pointerEvents="none"
            />
            <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 10} pointerEvents="none">
              {link.id}
              {blocked ? ' · STP' : ''}
            </text>
            <title>{`${linkLabel} · ${link.enabled === false ? 'Bấm để nối lại' : 'Bấm để ngắt dây, mô phỏng lỗi đường truyền'}`}</title>
          </g>
        );
      })}
      <circle
        ref={markerRef}
        r="9"
        className="network-packet network-packet-gsap"
        visibility="hidden"
        pointerEvents="none"
      >
        <title>Gói tin đang di chuyển</title>
      </circle>
      {list.map((device) => {
        const p = position(device.id);
        return (
          <g
            key={device.id}
            role="button"
            tabIndex={0}
            aria-label={`Chọn ${device.id}`}
            transform={`translate(${p.x},${p.y})`}
            className={`network-node ${selected === device.id ? 'selected' : ''}`}
            onClick={() => onSelect?.(device.id)}
            onKeyDown={(event) => {
              if (['Enter', ' '].includes(event.key)) {
                event.preventDefault();
                onSelect?.(device.id);
              }
            }}
            onPointerDown={(event) => {
              if (onMove && !disabled) {
                drag.current = device.id;
                event.currentTarget.setPointerCapture?.(event.pointerId);
              }
            }}
          >
            <rect
              x="-52"
              y="-31"
              width="104"
              height="62"
              rx={device.deviceType === 'ROUTER' ? 31 : 10}
            />
            <text textAnchor="middle" y="5">
              {device.deviceType}
            </text>
            <text textAnchor="middle" y="50">
              {device.hostname || device.id} ({device.id})
            </text>
          </g>
        );
      })}
    </svg>
  );
}
