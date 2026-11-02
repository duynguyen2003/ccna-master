import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  useId,
} from 'react';

// Keep native details semantics; leave it open until the closing transition ends.
const LabDisclosure = forwardRef(function LabDisclosure(
  { summary, children, className = '', collapse = false, defaultOpen = false, ...props },
  ref
) {
  const node = useRef(null),
    target = useRef(defaultOpen && !collapse),
    timer = useRef(null),
    frame = useRef(null);
  const [expanded, setExpanded] = useState(defaultOpen && !collapse);
  const initiallyOpen = useRef(defaultOpen && !collapse);
  const id = useId();
  useImperativeHandle(ref, () => node.current, []);
  useLayoutEffect(() => {
    if (initiallyOpen.current) node.current.open = true;
  }, []);
  const clear = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    timer.current = null;
    frame.current = null;
  }, []);
  useEffect(() => () => clear(), [clear]);
  const toggle = useCallback(() => {
    clear();
    const next = !node.current.open || !target.current;
    target.current = next;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (next) {
      node.current.open = true;
      if (reduced) setExpanded(true);
      else {
        void node.current.offsetHeight;
        frame.current = window.requestAnimationFrame(() => {
          frame.current = null;
          setExpanded(true);
        });
      }
    } else {
      setExpanded(false);
      const value = getComputedStyle(node.current).getPropertyValue('--acc-collapse').trim();
      const ms = reduced ? 0 : value ? parseFloat(value) * (value.endsWith('ms') ? 1 : 1000) : 250;
      if (!ms) node.current.open = false;
      else
        timer.current = window.setTimeout(() => {
          timer.current = null;
          if (!target.current && node.current) node.current.open = false;
        }, ms);
    }
  }, [clear]);
  useEffect(() => {
    if (collapse && node.current?.open && target.current) toggle();
  }, [collapse, toggle]);
  return (
    <details
      {...props}
      ref={node}
      className={`t-acc ${className}`}
      data-open={expanded ? 'true' : 'false'}
      onToggle={(event) => {
        if (!event.currentTarget.open) {
          clear();
          target.current = false;
          setExpanded(false);
        } else if (!target.current && timer.current === null) {
          target.current = true;
          setExpanded(true);
        }
      }}
    >
      <summary
        aria-expanded={expanded}
        aria-controls={id}
        onClick={(event) => {
          event.preventDefault();
          toggle();
        }}
      >
        {summary}
      </summary>
      <div
        className="t-acc-panel"
        id={id}
        aria-hidden={!expanded}
        inert={expanded ? undefined : ''}
      >
        <div className="t-acc-panel-inner">{children}</div>
      </div>
    </details>
  );
});
export default LabDisclosure;
