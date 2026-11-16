import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap, prefersReducedMotion } from '../utils/labMotion';
import { labelLines, layoutTopology, nodeBounds, shortPort } from '../utils/topologyLayout';
import { layoutLinks } from '../utils/topologyGeometry';
import NetworkDeviceGlyph from '../../../components/ui/NetworkDeviceGlyph';
import PacketGlyph, { fitPacketGlyphTag } from '../../protocols/components/PacketGlyph';
import IsometricGrid from '../../protocols/components/IsometricGrid';
import useTopologyPacketMotion from '../hooks/useTopologyPacketMotion';
import useObservedPacketMotion from '../../protocols/hooks/useObservedPacketMotion';
import { observationWire } from '../../protocols/model/observation';
import { packetTone } from '../../protocols/model/packetPresentation';
import '../styles/NetworkTopology.css';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function NetworkTopology({
  devices,
  links = [],
  selected,
  onSelect,
  onMove,
  onLinkSelect,
  selectedLink,
  packet,
  observation,
  stp = {},
  disabled = false,
  fit = false,
  fluid = false,
}) {
  const svgRef = useRef(null);
  const markerRef = useRef(null);
  const layerRef = useRef(null);
  const pathRef = useRef(null);
  const pulseRef = useRef(null);
  const crossRef = useRef(null);
  const drag = useRef(null);
  const fitCard = useCallback(() => {
    const tag = markerRef.current?.querySelector('[data-packet-card-scale]');
    if (tag) fitPacketGlyphTag(tag);
  }, []);
  const [viewport, setViewport] = useState({ width: 1000, height: 210 });
  // The editor keeps its authored coordinates. Practice diagrams fit positions
  // to the available pixels, keeping labels readable when the AI pane opens.
  const fitted = fit && !onMove;
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!fitted || !svg || typeof ResizeObserver === 'undefined') return undefined;
    const update = (width, height) => {
      const pixels = Math.floor(width);
      if (pixels > 0)
        setViewport((previous) =>
          previous.width === pixels && previous.height === height
            ? previous
            : { width: pixels, height: height || 210 }
        );
      fitCard();
    };
    // Fit before the first paint, rather than briefly shrinking a 1000px viewBox.
    update((svg.parentElement || svg).clientWidth, (svg.parentElement || svg).clientHeight);
    const observer = new ResizeObserver(([entry]) => {
      update(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(svg.parentElement || svg);
    return () => observer.disconnect();
  }, [fitted, fitCard]);
  const list = useMemo(
    () =>
      Array.isArray(devices)
        ? devices
        : Object.entries(devices || {}).map(([id, d]) => ({ ...d, id })),
    [devices]
  );
  const layout = useMemo(
    () => layoutTopology(list, links, viewport, fitted, { compact: fluid }),
    [list, links, viewport, fitted, fluid]
  );
  const { positions } = layout;
  const wires = useMemo(() => layoutLinks(list, links, layout, stp), [list, links, layout, stp]);
  const position = (id) => positions[id] || { x: 100, y: 100 };
  useTopologyPacketMotion({
    svgRef,
    layerRef,
    markerRef,
    pathRef,
    pulseRef,
    crossRef,
    packet: observation ? null : packet,
    enabled: !observation,
    layout,
    wires,
  });
  useObservedPacketMotion({
    observation,
    layout,
    wires,
    layerRef,
    markerRef,
    pathRef,
    pulseRef,
    crossRef,
    fitCard,
  });
  const observedEvent = observation?.model.events[observation.index];
  const observedLink = observationWire(wires, observedEvent)?.link.id;
  // Keep a permanent caption lane in CLI diagrams, including before the first probe.
  const captionSpace = fitted && observation ? 56 : 0;
  const sceneBottom = Math.max(
    140,
    ...list.map((device) => {
      const box = nodeBounds(device, position(device.id));
      return box.y + box.height + 12;
    }),
    ...wires.map(({ box }) => box.y + box.height + 12)
  );
  const viewBox = captionSpace
    ? `0 -${captionSpace} ${layout.width} ${(fluid ? sceneBottom : layout.height) + captionSpace}`
    : layout.viewBox;

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
      viewBox={viewBox}
      className={`network-topology network-diagram${fitted ? ' network-diagram--fit' : ''}${fluid ? ' network-diagram--fluid' : ''}${layout.linear ? ' network-diagram--linear' : ''}${observation ? ' packet-tone--' + packetTone(observedEvent) : ''}`}
      style={
        fitted
          ? {
              minWidth: fluid ? 0 : layout.minWidth,
              height: fluid ? '100%' : layout.height + captionSpace,
            }
          : undefined
      }
      role="group"
      aria-label="Sơ đồ mạng"
      onPointerMove={move}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <IsometricGrid y={-captionSpace} width={layout.width} height={layout.height + captionSpace} />
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
              className={`network-link ${stateClass} ${selectedLink === link.id ? 'selected' : ''} ${observedLink === link.id ? 'is-observed' : ''}`}
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
            className={`network-node ${selected === device.id ? 'selected' : ''} ${observedEvent?.actors.includes(device.id) ? 'is-observed' : ''}`}
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
              <g className="network-device-art">
                <NetworkDeviceGlyph type={device.deviceType || device.type} />
              </g>
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
            {observedEvent?.actors.includes(device.id) && (
              <text className="network-device-activity" y="-47" textAnchor="middle">
                {observedEvent.kind === 'frame'
                  ? observedEvent.from?.deviceId === device.id
                    ? 'Gửi'
                    : 'Nhận'
                  : observedEvent.failure
                    ? 'Dừng'
                    : 'Xử lý'}
              </text>
            )}
          </g>
        );
      })}
      <g
        ref={layerRef}
        className="network-traffic-layer"
        data-phase={observedEvent?.failure ? 'drop' : observedEvent?.phase || 'request'}
        data-observation={observation ? 'true' : undefined}
        visibility="hidden"
        pointerEvents="none"
        aria-hidden="true"
      >
        <path ref={pathRef} className="network-packet-route" pathLength="1" strokeDasharray="1" />
        <circle ref={pulseRef} className="network-packet-arrival" r="10" />
        {[3.2, 2.6, 2].map((r) => (
          <circle key={r} className="network-packet-trail" r={r} />
        ))}
        <g ref={markerRef} className="network-packet network-packet-gsap">
          {observedEvent ? (
            <PacketGlyph event={observedEvent} scale={1.2} clearance={72} />
          ) : (
            <>
              <circle className="network-packet-halo" r="12" />
              <circle className="network-packet-core" r="5" />
              <g className="network-packet-caption" transform="translate(0 -26)">
                <rect x="-78" y="-29" width="156" height="39" rx="6" />
                <text className="network-packet-title" textAnchor="middle" y="-13">
                  {observedEvent?.label}
                </text>
                <text className="network-packet-detail" textAnchor="middle" y="1">
                  {observedEvent?.phase === 'reply'
                    ? 'Chiều phản hồi'
                    : observation
                      ? 'Chiều yêu cầu'
                      : ''}
                </text>
              </g>
            </>
          )}
        </g>
        <g ref={crossRef} className="network-packet-cross">
          <circle r="12" />
          <path d="m-4-4 8 8m-8 0 8-8" />
        </g>
      </g>
    </svg>
  );
}
