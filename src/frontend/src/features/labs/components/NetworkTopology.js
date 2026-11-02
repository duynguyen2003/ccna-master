import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap, prefersReducedMotion } from '../utils/labMotion';
import { labelLines, layoutTopology, shortPort } from '../utils/topologyLayout';
import { layoutLinks, packetMotionPath } from '../utils/topologyGeometry';
import '../styles/NetworkTopology.css';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function DeviceSymbol({ type, card }) {
  if (card)
    return (
      <>
        <rect className="network-device-body" x="-28" y="-28" width="56" height="56" rx="10" />
        <g className="network-device-symbol">
          {type === 'ROUTER' ? (
            <>
              <circle r="16" />
              <path d="M-2-2 -10-10m0 5v-5h5M2 2l8 8m0-5v5H5M2-2l8-8m-5 0h5v5M-2 2l-8 8m5 0h-5V5" />
            </>
          ) : type === 'SWITCH' ? (
            <>
              <rect x="-17" y="-11" width="34" height="22" rx="3" />
              <path d="M-10-4h20m-4-4 4 4-4 4M10 5h-20m4-4-4 4 4 4" />
            </>
          ) : (
            <>
              <rect x="-16" y="-14" width="32" height="23" rx="2" />
              <path d="M-16 3h32M0 9v7m-9 0H9" />
            </>
          )}
        </g>
      </>
    );
  if (type === 'ROUTER')
    return (
      <>
        <circle className="network-device-body" r="25" />
        <g className="network-device-symbol" aria-hidden="true">
          <path d="M-4-4 -14-14m0 7v-7h7M4 4l10 10m0-7v7H7M4-4l10-10m-7 0h7v7M-4 4l-10 10m7 0h-7V7" />
        </g>
      </>
    );
  if (type === 'SWITCH')
    return (
      <>
        <rect className="network-device-body" x="-27" y="-19" width="54" height="38" rx="8" />
        <g className="network-device-symbol" aria-hidden="true">
          <path d="M-16-7h31m-5-5 5 5-5 5M16 5h-31m5-5-5 5 5 5M-16 13h3m6 0h3m6 0h3m6 0h3" />
        </g>
      </>
    );
  return (
    <>
      <rect className="network-device-body" x="-24" y="-23" width="48" height="36" rx="5" />
      <g className="network-device-symbol" aria-hidden="true">
        <path d="M-16 5h32M0 13v10m-12 0h24" />
      </g>
    </>
  );
}

const packetKey = (packet) =>
  packet?.animationKey ||
  (packet?.events || [])
    .map((event) =>
      [
        event.type,
        event.deviceId,
        event.from?.deviceId,
        event.to?.deviceId,
        event.from?.interface,
        event.to?.interface,
        event.packet?.ttl,
      ].join(':')
    )
    .join('|');

const hopList = (packet, byId) => {
  const frames = (packet?.events || []).filter(
    (event) => event.type === 'FRAME' && event.from?.deviceId && event.to?.deviceId
  );
  const hops = frames.map((event) => ({
    from: event.from.deviceId,
    to: event.to.deviceId,
    fromInterface: event.from.interface,
    toInterface: event.to.interface,
  }));
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
  fit = false,
}) {
  const svgRef = useRef(null);
  const markerRef = useRef(null);
  const animationTimeline = useRef(null);
  const drag = useRef(null);
  const animatedKey = useRef('');
  const [viewport, setViewport] = useState({ width: 1000, height: 210 });
  // The editor keeps its authored coordinates. Practice diagrams fit positions
  // to the available pixels, keeping labels readable when the AI pane opens.
  const fitted = fit && !onMove;
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!fitted || !svg || typeof ResizeObserver === 'undefined') return undefined;
    const update = (width) => {
      const pixels = Math.floor(width);
      if (pixels > 0)
        setViewport((previous) =>
          previous.width === pixels ? previous : { width: pixels, height: 210 }
        );
    };
    // Fit before the first paint, rather than briefly shrinking a 1000px viewBox.
    update((svg.parentElement || svg).clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      update(entry.contentRect.width);
    });
    observer.observe(svg.parentElement || svg);
    return () => observer.disconnect();
  }, [fitted]);
  const list = useMemo(
    () =>
      Array.isArray(devices)
        ? devices
        : Object.entries(devices || {}).map(([id, d]) => ({ ...d, id })),
    [devices]
  );
  const byId = useMemo(() => Object.fromEntries(list.map((device) => [device.id, device])), [list]);
  const layout = useMemo(
    () => layoutTopology(list, links, viewport, fitted),
    [list, links, viewport, fitted]
  );
  const { positions } = layout;
  const wires = useMemo(() => layoutLinks(list, links, layout, stp), [list, links, layout, stp]);
  const position = (id) => positions[id] || { x: 100, y: 100 };
  const animationId = packetKey(packet);

  useEffect(() => {
    if (!selected || prefersReducedMotion()) return undefined;
    const node = [...(svgRef.current?.querySelectorAll('[data-device-id]') || [])].find(
      (item) => item.dataset.deviceId === selected
    );
    if (!node) return undefined;
    const context = gsap.context(() => {
      gsap.fromTo(
        node.querySelector('.network-device-ring'),
        { opacity: 0.3 },
        { opacity: 1, duration: 0.2, clearProps: 'opacity' }
      );
    }, svgRef);
    return () => context.revert();
  }, [selected]);

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
      timeline.to(marker, {
        duration: 0.48,
        ease: 'power1.inOut',
        motionPath: { path: packetMotionPath(wires, positions, hop), autoRotate: false },
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
  }, [animationId, layout.viewBox]);

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
      viewBox={layout.viewBox}
      className={`network-topology network-diagram${fitted ? ' network-diagram--fit' : ''}${layout.linear ? ' network-diagram--linear' : ''}`}
      style={fitted ? { minWidth: layout.minWidth, height: layout.height } : undefined}
      role="group"
      aria-label="Sơ đồ mạng"
      onPointerMove={move}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      {wires.map(
        ({
          link,
          a,
          b,
          route,
          label,
          lines,
          status,
          stateClass,
          labelWidth,
          labelHeight,
          x,
          y,
          anchor,
        }) => {
          const linkLabel = `${link.id}: ${link.a.deviceId}:${link.a.interface} ↔ ${link.b.deviceId}:${link.b.interface}`;
          const distance = Math.hypot(b.x - a.x, b.y - a.y);
          return (
            <g
              key={link.id}
              className={`network-link ${stateClass} ${selectedLink === link.id ? 'selected' : ''}`}
              role={onLinkSelect ? 'button' : undefined}
              tabIndex={onLinkSelect && !disabled ? 0 : undefined}
              aria-label={
                onLinkSelect ? `Chọn dây ${linkLabel}${status ? ' · ' + status : ''}` : undefined
              }
              aria-pressed={onLinkSelect ? selectedLink === link.id : undefined}
              aria-disabled={disabled || undefined}
              onClick={() => selectLink(link)}
              onKeyDown={(event) => {
                if (['Enter', ' '].includes(event.key)) {
                  event.preventDefault();
                  selectLink(link);
                }
              }}
            >
              <path d={route.d} className="network-link-hit" />
              <path
                d={route.d}
                className={stateClass}
                data-testid={stateClass}
                pointerEvents="none"
              />
              <circle className="network-link-port" cx={route.start.x} cy={route.start.y} r="3" />
              <circle className="network-link-port" cx={route.end.x} cy={route.end.y} r="3" />
              {fitted && layout.linear && distance >= 190 && stateClass === 'link-up' && (
                <g className="network-port-labels" pointerEvents="none" aria-hidden="true">
                  <text x={route.start.x + 8} y={route.start.y + 18}>
                    {shortPort(link.a.interface)}
                  </text>
                  <text x={route.end.x - 8} y={route.end.y + 18} textAnchor="end">
                    {shortPort(link.b.interface)}
                  </text>
                </g>
              )}
              {Math.hypot(x - anchor.x, y - anchor.y) > 35 && (
                <line
                  className="network-label-leader"
                  x1={anchor.x}
                  y1={anchor.y}
                  x2={x}
                  y2={y}
                  pointerEvents="none"
                />
              )}
              <g className="network-subnet" transform={`translate(${x},${y})`}>
                <rect
                  x={-labelWidth / 2}
                  y={-labelHeight / 2}
                  width={labelWidth}
                  height={labelHeight}
                  rx="5"
                />
                <text textAnchor="middle" dominantBaseline="central">
                  {lines.map((line, i) => (
                    <tspan key={i} x="0" y={-labelHeight / 2 + 13 + i * 16}>
                      {line}
                    </tspan>
                  ))}
                </text>
                {status && (
                  <text className="network-link-status" textAnchor="middle" y={labelHeight / 2 - 7}>
                    {status}
                  </text>
                )}
              </g>
              <title>{`${linkLabel} · ${label}${onLinkSelect ? ' · Chọn dây để ngắt hoặc nối lại' : ''}`}</title>
            </g>
          );
        }
      )}
      {!list.length && (
        <text
          className="network-empty"
          x={layout.width / 2}
          y={layout.height / 2}
          textAnchor="middle"
        >
          Chưa có thiết bị
        </text>
      )}
      <circle
        ref={markerRef}
        r="5"
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
            data-device-id={device.id}
            role="button"
            tabIndex={0}
            aria-label={`Chọn ${device.id}`}
            aria-pressed={selected === device.id}
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
            <g transform={fitted ? undefined : 'scale(1.35)'}>
              <circle className="network-device-ring" r="32" />
              <DeviceSymbol type={device.deviceType || device.type} card={fitted} />
              <text className="network-device-name" textAnchor="middle" y="48">
                {labelLines(device.id).map((line, i) => (
                  <tspan key={i} x="0" dy={i ? 15 : 0}>
                    {line}
                  </tspan>
                ))}
              </text>
              {device.hostname && device.hostname !== device.id && (
                <text
                  className="network-device-hostname"
                  textAnchor="middle"
                  y={48 + labelLines(device.id).length * 15}
                >
                  {labelLines(device.hostname).map((line, i) => (
                    <tspan key={i} x="0" dy={i ? 15 : 0}>
                      {line}
                    </tspan>
                  ))}
                </text>
              )}
            </g>
            <title>{`${device.id} · ${device.deviceType === 'ROUTER' ? 'Router' : device.deviceType === 'SWITCH' ? 'Switch' : 'Máy tính'}${device.hostname && device.hostname !== device.id ? ' · ' + device.hostname : ''}`}</title>
          </g>
        );
      })}
    </svg>
  );
}
