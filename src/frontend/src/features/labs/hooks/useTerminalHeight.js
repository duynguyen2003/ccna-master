import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const MIN = 200;
export default function useTerminalHeight(enabled) {
  const pane = useRef(null);
  const drag = useRef(null);
  const [height, setHeight] = useState(260);
  const [max, setMax] = useState(640);
  const clamp = useCallback(
    (value, limit = max) => Math.round(Math.max(MIN, Math.min(limit, value))),
    [max]
  );
  useLayoutEffect(() => {
    if (!enabled || !pane.current || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const children = [...(pane.current.children || [])];
      const stage = children.find((node) => node.classList?.contains('cli-lab-topology-stage'));
      const fixedHeight = children
        .filter((node) => node !== stage && !node.classList?.contains('cli-lab-terminal-frame'))
        .reduce((total, node) => total + node.offsetHeight, 0);
      const reserved = stage
        ? fixedHeight + (parseFloat(getComputedStyle(stage).minHeight) || 190)
        : 280;
      const limit = Math.max(MIN, Math.min(640, pane.current.clientHeight - reserved));
      setMax(limit);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(pane.current);
    const watchChildren = () => {
      [...(pane.current.children || [])].forEach((node) => {
        if (!node.classList?.contains('cli-lab-terminal-frame')) observer.observe(node);
      });
      measure();
    };
    const changes =
      typeof MutationObserver === 'undefined' ? null : new MutationObserver(watchChildren);
    if (pane.current instanceof Element) changes?.observe(pane.current, { childList: true });
    watchChildren();
    measure();
    return () => {
      observer.disconnect();
      changes?.disconnect();
    };
  }, [enabled]);
  return {
    pane,
    height: clamp(height),
    separator: {
      role: 'separator',
      tabIndex: 0,
      'aria-label': 'Chiều cao terminal',
      'aria-orientation': 'horizontal',
      'aria-valuemin': MIN,
      'aria-valuemax': max,
      'aria-valuenow': clamp(height),
      'aria-valuetext': `${clamp(height)} pixel`,
      title: 'Kéo để đổi chiều cao terminal · phím ↑ ↓ để điều chỉnh',
      onPointerDown(event) {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        drag.current = { y: event.clientY, height: clamp(height) };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove(event) {
        if (drag.current) setHeight(clamp(drag.current.height + drag.current.y - event.clientY));
      },
      onPointerUp(event) {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      },
      onLostPointerCapture() {
        drag.current = null;
      },
      onKeyDown(event) {
        const next = {
          ArrowUp: clamp(height) + 24,
          ArrowDown: clamp(height) - 24,
          Home: MIN,
          End: max,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        setHeight(clamp(next));
      },
    },
  };
}
