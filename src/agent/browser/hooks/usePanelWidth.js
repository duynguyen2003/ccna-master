import { useCallback, useEffect, useState } from 'react';

const storageKey = 'ccna.ai.panel-width.v1';
const limits = () => ({ min: 320, max: Math.max(320, Math.min(680, window.innerWidth - 400)) });
const clamp = (width) => Math.round(Math.max(limits().min, Math.min(limits().max, width)));
export default function usePanelWidth(mobile, onWidthChange) {
  const [preferredWidth, setPreferredWidth] = useState(() => {
    try {
      return Math.round(
        Math.max(320, Math.min(680, Number(localStorage.getItem(storageKey)) || 440))
      );
    } catch {
      return 440;
    }
  });
  const [viewport, setViewport] = useState(window.innerWidth);
  const width = Math.round(Math.min(preferredWidth, Math.max(320, Math.min(680, viewport - 400))));
  const change = useCallback((value) => setPreferredWidth(clamp(value)), []);
  useEffect(() => {
    const resize = () => setViewport(window.innerWidth);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    if (mobile) {
      onWidthChange?.(null);
      return;
    }
    onWidthChange?.(width);
  }, [width, mobile, onWidthChange]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(preferredWidth));
    } catch {}
  }, [preferredWidth]);
  const separator = {
    role: 'separator',
    tabIndex: 0,
    'aria-label': 'Chiều rộng trợ lý',
    'aria-orientation': 'vertical',
    'aria-valuemin': limits().min,
    'aria-valuemax': limits().max,
    'aria-valuenow': width,
    onKeyDown: (event) => {
      const next = {
        ArrowLeft: width + 24,
        ArrowRight: width - 24,
        Home: limits().min,
        End: limits().max,
      }[event.key];
      if (next !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        change(next);
      }
    },
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      const node = event.currentTarget;
      node.focus();
      node.setPointerCapture?.(event.pointerId);
      node.dataset.resizing = 'true';
    },
    onPointerMove: (event) => {
      if (event.currentTarget.dataset.resizing !== 'true') return;
      const right = event.currentTarget.parentElement.getBoundingClientRect().right;
      change(right - event.clientX);
    },
    onPointerUp: (event) => {
      delete event.currentTarget.dataset.resizing;
    },
    onLostPointerCapture: (event) => {
      delete event.currentTarget.dataset.resizing;
    },
  };
  return { width, change, separator };
}
