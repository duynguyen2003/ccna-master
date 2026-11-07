import React, {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useLayoutEffect,
  useRef,
} from 'react';
import './styles/SlidingTabs.css';

const geometry = (tab) => ({
  tab,
  left: tab.offsetLeft,
  width: tab.offsetWidth,
  top: tab.offsetTop,
  height: tab.offsetHeight,
});

// Selection stays with the caller; this component only paints that selection.
export default function SlidingTabs({ value, children, className = '', role = 'group', ...props }) {
  const barRef = useRef(null);
  const pillRef = useRef(null);
  const measured = useRef(false);
  const clicked = useRef(null);
  const items = Children.toArray(children);
  const itemKeys = items.map((item) => item.key).join('|');
  const moveTo = useCallback((animate) => {
    const bar = barRef.current;
    const pill = pillRef.current;
    const active = bar?.querySelector(':scope > [data-active="true"]');
    if (!pill) return;
    const box = active
      ? animate && clicked.current?.tab === active
        ? clicked.current
        : geometry(active)
      : null;
    clicked.current = null;
    if (!box?.width || !box.height) {
      pill.style.visibility = 'hidden';
      measured.current = false;
      return;
    }
    const snap = !animate || !measured.current;
    const transition = pill.style.transition;
    if (snap) pill.style.transition = 'none';
    pill.style.left = `${box.left}px`;
    pill.style.width = `${box.width}px`;
    pill.style.top = `${box.top}px`;
    pill.style.height = `${box.height}px`;
    pill.style.visibility = 'visible';
    if (snap) {
      void pill.offsetWidth;
      pill.style.transition = transition;
    }
    measured.current = true;
    // Scroll this control only, without moving its surrounding page/terminal.
    if (bar.clientWidth && box.left < bar.scrollLeft) bar.scrollLeft = box.left;
    else if (bar.clientWidth && box.left + box.width > bar.scrollLeft + bar.clientWidth)
      bar.scrollLeft = box.left + box.width - bar.clientWidth;
  }, []);
  useLayoutEffect(() => {
    moveTo(true);
  }, [value, itemKeys, moveTo]);
  useLayoutEffect(() => {
    const bar = barRef.current;
    let cancelled = false;
    const measure = () => {
      if (!cancelled) moveTo(false);
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(bar);
    bar.querySelectorAll(':scope > .t-tab').forEach((tab) => observer?.observe(tab));
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure);
    return () => {
      cancelled = true;
      clicked.current = null;
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [itemKeys, moveTo]);
  return (
    <div
      {...props}
      role={role}
      ref={barRef}
      className={`sliding-tabs t-tabs ${className}`}
      onClickCapture={(event) => {
        const target = event.target.closest?.('.t-tab');
        if (
          target?.parentElement === barRef.current &&
          !target.disabled &&
          target.getAttribute('aria-disabled') !== 'true'
        )
          clicked.current = geometry(target);
      }}
      onKeyDown={(event) => {
        if (
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
        )
          return;
        const tabs = [
          ...barRef.current.querySelectorAll(
            ':scope > button.t-tab:not(:disabled):not([aria-disabled="true"])'
          ),
        ];
        const index = tabs.indexOf(event.target);
        if (index < 0 || !tabs.length) return;
        event.preventDefault();
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        tabs[next].focus();
        tabs[next].click();
      }}
    >
      <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
      {items.map((item) =>
        isValidElement(item)
          ? cloneElement(item, {
              className: `${item.props.className || ''} t-tab`.trim(),
              'data-active':
                item.props['aria-pressed'] === true ||
                item.props['aria-selected'] === true ||
                item.props['aria-current'] === 'page',
            })
          : item
      )}
    </div>
  );
}
