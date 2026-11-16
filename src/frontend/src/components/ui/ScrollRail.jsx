import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import './ScrollRail.css';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Content keeps native wheel/touch/keyboard scrolling; this rail owns its visuals.
export default function ScrollRail({ viewportRef, label, className = '' }) {
  const rail = useRef(null);
  const drag = useRef(null);
  const geometry = useRef({ range: 0, length: 0, size: 0, top: 0 });
  const [metrics, setMetrics] = useState(geometry.current);
  const [dragging, setDragging] = useState(false);
  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const length = rail.current?.clientHeight || Math.max(0, viewport.clientHeight - 16);
    const next = {
      range: Math.max(0, viewport.scrollHeight - viewport.clientHeight),
      length,
      size: Math.min(
        length,
        Math.max(32, (length * viewport.clientHeight) / Math.max(1, viewport.scrollHeight))
      ),
      top: Math.max(0, viewport.scrollTop),
    };
    next.top = Math.min(next.top, next.range);
    geometry.current = next;
    setMetrics((previous) =>
      Object.keys(next).every((key) => previous[key] === next[key]) ? previous : next
    );
  }, [viewportRef]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    const observeContent = () => {
      observer?.disconnect();
      observer?.observe(viewport);
      if (rail.current) observer?.observe(rail.current);
      for (const child of viewport.children) observer?.observe(child);
      measure();
    };
    const mutations = new MutationObserver(observeContent);
    mutations.observe(viewport, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    const element = rail.current;
    const wheel = (event) => {
      if (!event.deltaY) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
      viewport.scrollTop = clamp(
        viewport.scrollTop + event.deltaY * unit,
        0,
        geometry.current.range
      );
      event.preventDefault();
      measure();
    };
    viewport.addEventListener('scroll', measure, { passive: true });
    element?.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('resize', measure);
    observeContent();
    return () => {
      observer?.disconnect();
      mutations.disconnect();
      viewport.removeEventListener('scroll', measure);
      element?.removeEventListener('wheel', wheel);
      window.removeEventListener('resize', measure);
      drag.current = null;
    };
  }, [measure, viewportRef]);

  const scrollTo = (top) => {
    if (!viewportRef.current) return;
    viewportRef.current.scrollTop = clamp(top, 0, geometry.current.range);
    measure();
  };
  const stopDragging = (event) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const travel = metrics.length - metrics.size;
  const offset = metrics.range ? (metrics.top / metrics.range) * travel : 0;
  return (
    <div
      ref={rail}
      className={`ui-scroll-rail ${className}${dragging ? ' is-dragging' : ''}`}
      hidden={metrics.range <= 1 || metrics.length <= 0}
      role="scrollbar"
      aria-label={label}
      aria-orientation="vertical"
      aria-controls={viewportRef.current?.id}
      aria-valuemin={0}
      aria-valuemax={Math.ceil(metrics.range)}
      aria-valuenow={Math.round(metrics.top)}
      aria-valuetext={`${metrics.range ? Math.round((metrics.top / metrics.range) * 100) : 0}%`}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0 || event.isPrimary === false) return;
        const current = geometry.current;
        const distance = current.length - current.size;
        if (!current.range || distance <= 0) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        const pointer = event.clientY - event.currentTarget.getBoundingClientRect().top;
        const thumbTop = (current.top / current.range) * distance;
        if (pointer < thumbTop || pointer > thumbTop + current.size)
          scrollTo(((pointer - current.size / 2) / distance) * current.range);
        drag.current = {
          pointerId: event.pointerId,
          y: event.clientY,
          top: viewportRef.current.scrollTop,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (!drag.current || drag.current.pointerId !== event.pointerId) return;
        const { range, length, size } = geometry.current;
        if (length <= size) return;
        scrollTo(drag.current.top + ((event.clientY - drag.current.y) / (length - size)) * range);
      }}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onLostPointerCapture={stopDragging}
      onKeyDown={(event) => {
        const page = (viewportRef.current?.clientHeight || 0) * 0.9;
        const targets = {
          ArrowDown: metrics.top + 40,
          ArrowUp: metrics.top - 40,
          PageDown: metrics.top + page,
          PageUp: metrics.top - page,
          Home: 0,
          End: metrics.range,
          ' ': metrics.top + (event.shiftKey ? -page : page),
        };
        if (!(event.key in targets)) return;
        event.preventDefault();
        scrollTo(targets[event.key]);
      }}
    >
      <span
        className="ui-scroll-rail__thumb"
        aria-hidden="true"
        style={{ height: metrics.size, transform: `translateY(${offset}px)` }}
      />
    </div>
  );
}
