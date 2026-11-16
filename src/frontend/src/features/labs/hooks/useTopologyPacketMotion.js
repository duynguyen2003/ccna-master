import { useLayoutEffect, useRef } from 'react';
import { gsap } from '../utils/labMotion';
import { packetAnimationKey, packetAnimationSteps } from '../utils/topologyPackets';
import { packetMotionPath, packetWire } from '../utils/topologyGeometry';

export default function useTopologyPacketMotion({
  svgRef,
  layerRef,
  markerRef,
  pathRef,
  pulseRef,
  crossRef,
  packet,
  layout,
  wires,
  enabled = true,
}) {
  const animatedKey = useRef('');
  const animationId = packetAnimationKey(packet);
  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const layer = layerRef.current;
    const marker = markerRef.current;
    const path = pathRef.current;
    const pulse = pulseRef.current;
    const cross = crossRef.current;
    if (!layer || !marker || !path || !pulse || !cross) return undefined;
    const trails = [...layer.querySelectorAll('.network-packet-trail')];
    const art = [...svgRef.current.querySelectorAll('.network-device-art')];
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let timeline;
    const hide = () => {
      layer.setAttribute('visibility', 'hidden');
      timeline?.kill();
      gsap.set(art, { clearProps: 'transform' });
    };
    const motionChanged = (event) => {
      if (event.matches) hide();
    };
    media?.addEventListener?.('change', motionChanged);
    const steps = packetAnimationSteps(packet).filter((step) =>
      step.kind === 'hop'
        ? layout.positions[step.from] &&
          layout.positions[step.to] &&
          packetWire(wires, step)?.stateClass === 'link-up'
        : layout.positions[step.deviceId]
    );

    if (animationId && animatedKey.current !== animationId && steps.length && !media?.matches) {
      animatedKey.current = animationId;
      layer.setAttribute('visibility', 'visible');
      gsap.set([marker, path, pulse, cross, ...trails], { opacity: 0 });
      const title = layer.querySelector('.network-packet-title');
      const detail = layer.querySelector('.network-packet-detail');
      timeline = gsap.timeline({ paused: true, onComplete: hide });
      let time = 0;
      const caption = (step) => {
        layer.dataset.phase = step.phase;
        title.textContent = step.label;
        detail.textContent = step.detail;
      };
      const receive = (deviceId, start) => {
        const p = layout.positions[deviceId];
        timeline.fromTo(
          pulse,
          { attr: { cx: p.x, cy: p.y, r: 10 }, opacity: 0.7 },
          {
            attr: { r: 34 },
            opacity: 0,
            duration: 0.42,
            ease: 'power1.out',
            immediateRender: false,
          },
          start
        );
        const target = [...svgRef.current.querySelectorAll('[data-device-id]')]
          .find((node) => node.dataset.deviceId === deviceId)
          ?.querySelector('.network-device-art');
        if (target)
          timeline.to(
            target,
            { y: -3, duration: 0.12, repeat: 1, yoyo: true, ease: 'sine.out' },
            start
          );
      };
      steps.forEach((step) => {
        timeline.call(() => caption(step), [], time);
        if (step.kind === 'hop') {
          const from = layout.positions[step.from];
          const to = layout.positions[step.to];
          const duration = Math.min(
            1,
            Math.max(0.48, Math.hypot(to.x - from.x, to.y - from.y) / 300)
          );
          const motionPath = {
            path: packetMotionPath(wires, layout.positions, step),
            autoRotate: false,
          };
          timeline
            .set(marker, { x: from.x, y: from.y, opacity: 1 }, time)
            .to(marker, { motionPath, duration, ease: 'sine.inOut' }, time)
            .fromTo(
              path,
              { attr: { d: motionPath.path, 'stroke-dashoffset': 1 }, opacity: 0.55 },
              {
                attr: { 'stroke-dashoffset': 0 },
                duration,
                ease: 'sine.inOut',
                immediateRender: false,
              },
              time
            )
            .to(path, { opacity: 0, duration: 0.18 }, time + duration);
          trails.forEach((trail, i) => {
            const lag = (i + 1) * 0.035;
            timeline
              .set(trail, { x: from.x, y: from.y, opacity: 0.32 - i * 0.08 }, time)
              .to(trail, { motionPath, duration, ease: 'sine.inOut' }, time + lag)
              .to(trail, { opacity: 0, duration: 0.08 }, time + duration + lag);
          });
          receive(step.to, time + duration - 0.03);
          time += duration + 0.22;
        } else {
          const p = layout.positions[step.deviceId];
          timeline.set(marker, { x: p.x, y: p.y, opacity: 1 }, time);
          receive(step.deviceId, time);
          if (step.kind === 'drop') {
            timeline
              .set(cross, { x: p.x, y: p.y, opacity: 1 }, time)
              .fromTo(
                cross,
                { scale: 0.5 },
                { scale: 1, duration: 0.22, ease: 'back.out(1.5)', immediateRender: false },
                time
              )
              .to(cross, { opacity: 0, duration: 0.25 }, time + 0.9);
          }
          const hold = step.kind === 'drop' ? 1.2 : 0.48;
          timeline.to(marker, { opacity: 0, duration: 0.12 }, time + hold - 0.12);
          time += hold;
        }
      });
      timeline.to(marker, { opacity: 0, duration: 0.18 }, time).play();
    } else layer.setAttribute('visibility', 'hidden');

    return () => {
      hide();
      media?.removeEventListener?.('change', motionChanged);
      if (animatedKey.current === animationId) animatedKey.current = '';
    };
    // A poll may replace packet, devices and links with equivalent objects.
    // Restart only for a new probe signature or changed display geometry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationId, layout.viewBox, enabled]);
}
