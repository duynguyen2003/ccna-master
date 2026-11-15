import { useLayoutEffect, useRef } from 'react';
import { gsap } from '../../labs/utils/labMotion';
import { packetMotionPath } from '../../labs/utils/topologyGeometry';
import { observationWire } from '../model/observation';

// Visual track is a child of the observer's clock. It never starts its own playback.
export default function useObservedPacketMotion({
  observation,
  layout,
  wires,
  layerRef,
  markerRef,
  pathRef,
  pulseRef,
  crossRef,
  fitCard,
}) {
  const latest = useRef(null);
  latest.current = { observation, layout, wires };
  const register = observation?.registerRenderer;
  const key = observation?.model.key;
  // Polling replaces the state objects even when the visible topology is identical.
  const geometryKey = JSON.stringify([
    layout.viewBox,
    layout.positions,
    wires.map(({ link, stateClass, route }) => [link.id, link.a, link.b, stateClass, route]),
  ]);
  useLayoutEffect(() => {
    if (!register) return undefined;
    const layer = layerRef.current;
    const marker = markerRef.current;
    const path = pathRef.current;
    const pulse = pulseRef.current;
    const cross = crossRef.current;
    if (!layer || !marker || !path || !pulse || !cross) return undefined;
    const halo = marker.querySelector('.packet-visual__halo');
    const trails = [...layer.querySelectorAll('.network-packet-trail')];
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const hide = () => layer.setAttribute('visibility', 'hidden');
    let detach;
    const install = () => {
      detach?.();
      detach = register(key, (starts) => {
        const { observation: controller, layout: scene, wires: connections } = latest.current;
        const visual = gsap.timeline({ onUpdate: fitCard });
        if (!controller.model.events.length)
          visual.set(layer, { attr: { visibility: 'hidden' } }, 0);
        controller.model.events.forEach((event, index) => {
          const start = starts[index];
          visual.set([marker, path, pulse, cross, ...trails], { opacity: 0 }, start);
          const wire = observationWire(connections, event);
          const from = scene.positions[event.from?.deviceId];
          const to = scene.positions[event.to?.deviceId];
          const point = scene.positions[event.deviceId] || from;
          const isFrame = event.kind === 'frame';
          // Only a recorded FRAME on an unambiguous, active interface pair travels.
          const visible = isFrame ? wire?.stateClass === 'link-up' && from && to : point;
          visual.set(layer, { attr: { visibility: visible ? 'visible' : 'hidden' } }, start);
          if (!visible) return;
          const origin = isFrame ? from : point;
          const motionPath = isFrame
            ? {
                path: packetMotionPath([wire], scene.positions, {
                  from: event.from.deviceId,
                  to: event.to.deviceId,
                  fromInterface: event.from.interface,
                  toInterface: event.to.interface,
                }),
                autoRotate: false,
              }
            : null;
          visual.set(marker, { x: origin.x, y: origin.y, opacity: 1, scale: 1 }, start);
          if (media?.matches) {
            // Preserve the selected event without flight, pulse or exit animation.
            if (halo) visual.set(halo, { attr: { r: 13 } }, start);
            if (motionPath)
              visual.set(
                path,
                { attr: { d: motionPath.path, 'stroke-dashoffset': 0 }, opacity: 0.55 },
                start
              );
            if (event.failure)
              visual.set(cross, { x: point.x, y: point.y, opacity: 1, scale: 1 }, start);
            return;
          }
          // Animate the point, keeping captions fully readable when stepping/paused.
          if (halo)
            visual.fromTo(
              halo,
              { attr: { r: 8 } },
              { attr: { r: 13 }, duration: 0.16, ease: 'power1.out', immediateRender: false },
              start
            );
          if (event.kind === 'frame') {
            const duration = Math.min(
              1,
              Math.max(0.48, Math.hypot(to.x - from.x, to.y - from.y) / 300)
            );
            visual
              .to(marker, { motionPath, duration, ease: 'sine.inOut' }, start)
              .fromTo(
                path,
                { attr: { d: motionPath.path, 'stroke-dashoffset': 1 }, opacity: 0.55 },
                {
                  attr: { 'stroke-dashoffset': 0 },
                  duration,
                  ease: 'sine.inOut',
                  immediateRender: false,
                },
                start
              )
              .to(path, { opacity: 0, duration: 0.18 }, start + duration)
              .fromTo(
                pulse,
                { attr: { cx: to.x, cy: to.y, r: 10 }, opacity: 0.7 },
                {
                  attr: { r: 34 },
                  opacity: 0,
                  duration: 0.42,
                  ease: 'power1.out',
                  immediateRender: false,
                },
                start + duration - 0.03
              );
            trails.forEach((trail, i) => {
              const lag = (i + 1) * 0.035;
              visual
                .set(trail, { x: from.x, y: from.y, opacity: 0.32 - i * 0.08 }, start)
                .to(trail, { motionPath, duration, ease: 'sine.inOut' }, start + lag)
                .to(trail, { opacity: 0, duration: 0.08 }, start + duration + lag);
            });
          } else if (point) {
            visual.fromTo(
              pulse,
              { attr: { cx: point.x, cy: point.y, r: 10 }, opacity: 0.7 },
              {
                attr: { r: 34 },
                opacity: 0,
                duration: 0.42,
                ease: 'power1.out',
                immediateRender: false,
              },
              start
            );
            if (event.failure)
              visual
                .set(cross, { x: point.x, y: point.y, opacity: 1 }, start)
                .fromTo(
                  cross,
                  { scale: 0.5 },
                  { scale: 1, duration: 0.22, ease: 'back.out(1.5)', immediateRender: false },
                  start
                );
          }
          const exit = start + event.duration - 0.18;
          if (event.failure)
            visual.to(
              marker,
              { y: point.y + 14, opacity: 0, duration: 0.18, ease: 'power2.in' },
              exit
            );
          else visual.to(marker, { opacity: 0, duration: 0.18 }, exit);
          visual.to(cross, { opacity: 0, duration: 0.18 }, exit);
        });
        return visual;
      });
    };
    install();
    const motionChanged = () => {
      hide();
      install();
      fitCard?.();
    };
    media?.addEventListener?.('change', motionChanged);
    return () => {
      detach?.();
      hide();
      media?.removeEventListener?.('change', motionChanged);
    };
  }, [register, key, geometryKey, layerRef, markerRef, pathRef, pulseRef, crossRef, fitCard]);

  // A manual seek suppresses GSAP callbacks; still fit its newly selected caption.
  useLayoutEffect(() => {
    fitCard?.();
  }, [key, observation?.index, geometryKey, fitCard]);
}
