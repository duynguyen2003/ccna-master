import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import NetworkDeviceGlyph from '../../../components/ui/NetworkDeviceGlyph';
import PacketGlyph, { fitPacketGlyphTag } from './PacketGlyph';
import IsometricGrid from './IsometricGrid';
import {
  compactLessonPositions,
  lessonCamera,
  lessonFlight,
  lessonLinks,
} from '../model/lessonScene';
import { packetTone } from '../model/packetPresentation';
import scene from '../data/lessons/scene.json';
import { deviceNames } from '../model/lessonPresentation';

const names = {
  client: 'Máy khách',
  router: 'Router',
  internet: 'Internet',
  dns: 'DNS resolver',
  web: 'Máy chủ',
  root: 'DNS root',
  tld: 'DNS .com',
  auth: 'DNS thẩm quyền',
  mx: 'Máy chủ thư',
};
const type = (id) =>
  id === 'client'
    ? 'PC'
    : ['router', 'isp', 'transit', 'hosting', 'remote'].includes(id)
      ? 'ROUTER'
      : id === 'peer'
        ? 'PC'
        : id === 'switch'
          ? 'SWITCH'
          : id === 'cam'
            ? 'CAMERA'
            : id === 'stb'
              ? 'TV_BOX'
              : id === 'internet'
                ? 'CLOUD'
                : ['dns', 'root', 'tld', 'auth'].includes(id)
                  ? 'DNS'
                  : 'SERVER';

export default function LessonNetworkView({ lesson, playback, layout }) {
  const svg = useRef(null);
  const flights = useRef(new Map());
  const fitCards = useCallback(() => {
    svg.current?.querySelectorAll('[data-packet-card-scale]').forEach((tag) => {
      if (tag.closest('.protocol-flight')?.style.visibility !== 'hidden') fitPacketGlyphTag(tag);
    });
  }, []);
  const [compact, setCompact] = useState(false);
  useLayoutEffect(() => {
    const measure = () => {
      setCompact((svg.current?.clientWidth || 1000) < 540);
      fitCards();
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(svg.current);
    return () => observer.disconnect();
  }, [fitCards]);
  const [reduced, setReduced] = useState(() =>
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  );
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(Boolean(media?.matches));
    media?.addEventListener?.('change', change);
    return () => media?.removeEventListener?.('change', change);
  }, []);
  const { model, index, registerRenderer } = playback;
  const selected = model.events[index];
  const visibleKey = (selected?.visible || lesson.nodes).join('|');
  const positions = useMemo(
    () =>
      compact
        ? compactLessonPositions(visibleKey.split('|'))
        : layout?.positions || scene.positions,
    [compact, visibleKey, layout]
  );
  const links = lessonLinks(lesson);

  useLayoutEffect(
    () =>
      registerRenderer(model.key, (starts) => {
        const timeline = gsap.timeline({ onUpdate: fitCards });
        if (reduced) return timeline;
        model.events.forEach((event, i) => {
          const start = starts[i];
          const group = flights.current.get(event.id);
          if (!group) return;
          const core = group.querySelector('.protocol-flight__head');
          const trail = [...group.querySelectorAll('.protocol-flight__trail')];
          const pulse = group.querySelector('.protocol-flight__pulse');
          const cross = group.querySelector('.protocol-flight__cross');
          const flight = lessonFlight(event.raw, positions, lesson);
          const timing = event.duration / flight.duration;
          if (!flight.segments.length) return;
          const first = flight.segments[0].a;
          const last = flight.segments[flight.segments.length - 1].b;
          timeline
            .set(group, { autoAlpha: 0 }, 0)
            .set(group, { autoAlpha: 1 }, start)
            .set([pulse, cross], { autoAlpha: 0 }, start)
            .set(core, { x: first[0], y: first[1], scale: 0.55, autoAlpha: 1 }, start)
            .to(
              core,
              { scale: 1, duration: event.raw.quick ? 0.14 : 0.22, ease: 'back.out(1.4)' },
              start
            );
          trail.forEach((dot, j) =>
            timeline.set(dot, { x: first[0], y: first[1], opacity: 0.42 - j * 0.1 }, start)
          );
          flight.segments.forEach((segment) => {
            timeline.to(
              core,
              {
                x: segment.b[0],
                y: segment.b[1],
                duration: segment.duration * timing,
                ease: 'none',
              },
              start + segment.start * timing
            );
            trail.forEach((dot, j) =>
              timeline.to(
                dot,
                {
                  x: segment.b[0],
                  y: segment.b[1],
                  duration: segment.duration * timing,
                  ease: 'none',
                },
                start + segment.start * timing + (j + 1) * 0.035
              )
            );
          });
          const arrival = start + flight.arrival * timing;
          if (event.failure) {
            timeline
              .set(cross, { x: last[0], y: last[1], autoAlpha: 1, scale: 0.5 }, arrival)
              .to(cross, { scale: 1, duration: 0.22, ease: 'back.out(1.4)' }, arrival)
              .to(
                core,
                { y: last[1] + 26, scale: 0.6, opacity: 0, duration: 0.52, ease: 'power2.in' },
                arrival
              );
          } else {
            timeline
              .fromTo(
                pulse,
                { attr: { cx: last[0], cy: last[1], r: 10 }, autoAlpha: 0.7 },
                {
                  attr: { r: 48 },
                  autoAlpha: 0,
                  duration: 0.33,
                  ease: 'power1.out',
                  immediateRender: false,
                },
                arrival
              )
              .to(core, { scale: 0.3, autoAlpha: 0, duration: 0.18, ease: 'power2.in' }, arrival);
          }
          timeline
            .to(trail, { opacity: 0, duration: 0.18 }, arrival)
            .set(group, { autoAlpha: 0 }, start + event.duration);
        });
        return timeline;
      }),
    [model, registerRenderer, reduced, positions, lesson, fitCards]
  );
  // Seeking suppresses timeline callbacks; fit the selected card after the seek.
  useLayoutEffect(fitCards, [index, positions, reduced, fitCards]);

  const activeFlight =
    selected?.kind === 'frame' ? lessonFlight(selected.raw, positions, lesson) : null;
  return (
    <div
      className={`protocol-lesson__network ${compact ? 'is-compact' : ''}`}
      tabIndex={0}
      role="region"
      aria-label="Sơ đồ mạng minh họa"
    >
      <svg
        ref={svg}
        viewBox={
          !compact && layout?.viewBox
            ? layout.viewBox
            : lessonCamera(undefined, selected?.visible || lesson.nodes, positions)
        }
        preserveAspectRatio="xMidYMid meet"
        aria-label={lesson.name + ': ' + (selected?.label || '')}
      >
        <IsometricGrid x="-500" y="-500" width="2500" height="2000" />
        {links
          .filter((edge) => edge.split('>').every((id) => selected?.visible.includes(id)))
          .map((edge) => {
            const [a, b] = edge.split('>').map((id) => positions[id]);
            return (
              <line
                key={edge}
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                className="protocol-lesson__wire"
              />
            );
          })}
        {lesson.nodes.map((id) => (
          <g key={id} transform={'translate(' + positions[id].join(' ') + ')'}>
            <g data-scene-node={id} opacity={selected?.visible.includes(id) ? 1 : 0}>
              {selected?.actors.includes(id) && (
                <>
                  <circle r="61" className="protocol-lesson__node-ring" />
                  <text y="-72" textAnchor="middle" className="protocol-lesson__node-message">
                    {selected.kind === 'frame'
                      ? selected.from?.deviceId === id
                        ? 'Gửi'
                        : 'Nhận'
                      : 'Đang theo dõi'}
                  </text>
                </>
              )}
              <g transform="scale(1.65)">
                <NetworkDeviceGlyph type={type(id)} />
              </g>
              <text y="76" textAnchor="middle">
                {selected?.nodeLabels?.[id]?.[0] || deviceNames[id] || names[id]}
              </text>
              <text y="96" textAnchor="middle" className="protocol-lesson__address">
                {selected?.nodeLabels?.[id]?.[1] ??
                  lesson.labels?.[id]?.[1] ??
                  scene.labels[id]?.[1]}
              </text>
            </g>
          </g>
        ))}
        {activeFlight?.segments.length > 0 && (
          <g aria-hidden="true">
            <polyline
              className="protocol-lesson__active-wire"
              points={[
                activeFlight.segments[0].a,
                ...activeFlight.segments.map((segment) => segment.b),
              ]
                .map((point) => point.join(','))
                .join(' ')}
            />
            {activeFlight.segments.slice(-1).map((segment) => (
              <path
                key="tip"
                className="protocol-lesson__arrow-tip"
                d="M0 0L-10-5L-10 5Z"
                transform={
                  'translate(' +
                  segment.b.join(' ') +
                  ') rotate(' +
                  (Math.atan2(segment.b[1] - segment.a[1], segment.b[0] - segment.a[0]) * 180) /
                    Math.PI +
                  ')'
                }
              />
            ))}
          </g>
        )}
        {!reduced &&
          model.events
            .filter((event) => event.kind === 'frame')
            .map((event) => {
              const flight = lessonFlight(event.raw, positions, lesson);
              const points = flight.segments.length
                ? [flight.segments[0].a, ...flight.segments.map((s) => s.b)]
                : [];
              return (
                <g
                  key={event.id}
                  ref={(el) =>
                    el ? flights.current.set(event.id, el) : flights.current.delete(event.id)
                  }
                  data-flight-id={event.id}
                  className={'protocol-flight packet-tone--' + packetTone(event)}
                  style={{ visibility: 'hidden' }}
                  aria-hidden="true"
                  pointerEvents="none"
                >
                  <polyline
                    className="protocol-flight__path"
                    points={points.map((p) => p.join(',')).join(' ')}
                  />
                  {[3.6, 2.6, 1.6].map((r) => (
                    <circle key={r} r={r} className="protocol-flight__trail" />
                  ))}
                  <circle className="protocol-flight__pulse" />
                  <g className="protocol-flight__head">
                    <PacketGlyph event={event} scale={compact ? 1.5 : 1.25} />
                  </g>
                  <g className="protocol-flight__cross">
                    <circle r="13" />
                    <path d="M-5-5L5 5M5-5L-5 5" />
                  </g>
                </g>
              );
            })}
        {reduced && activeFlight?.segments.length > 0 && (
          <g aria-hidden="true" className={'protocol-flight packet-tone--' + packetTone(selected)}>
            <polyline
              className="protocol-flight__path"
              points={[activeFlight.segments[0].a, ...activeFlight.segments.map((s) => s.b)]
                .map((p) => p.join(','))
                .join(' ')}
            />
            <g transform={'translate(' + activeFlight.segments[0].a.join(' ') + ')'}>
              <PacketGlyph event={selected} scale={compact ? 1.5 : 1.25} />
            </g>
          </g>
        )}
      </svg>
      {selected?.failure && <span className="protocol-lesson__loss">Gói tin bị mất</span>}
    </div>
  );
}
