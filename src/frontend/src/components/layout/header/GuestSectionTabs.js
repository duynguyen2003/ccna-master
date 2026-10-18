import React, { useCallback, useLayoutEffect, useRef } from 'react';

const GuestSectionTabs = ({ items, activeSection, onSelect }) => {
  const barRef = useRef(null);
  const pillRef = useRef(null);
  const hasMeasured = useRef(false);

  const moveTo = useCallback((tab, animate) => {
    const pill = pillRef.current;
    if (!pill || !tab) return;
    const left = tab.offsetLeft;
    const width = tab.offsetWidth;
    if (!width) return;

    const snap = !animate || !hasMeasured.current;
    const previousTransition = pill.style.transition;
    if (snap) pill.style.transition = 'none';
    pill.style.left = `${left}px`;
    pill.style.width = `${width}px`;
    if (snap) {
      // Commit initial/resize geometry before restoring the CSS transition.
      void pill.offsetWidth;
      pill.style.transition = previousTransition;
    }
    hasMeasured.current = true;
  }, []);

  useLayoutEffect(() => {
    const bar = barRef.current;
    const active = bar?.querySelector('[aria-current="page"]') || bar?.querySelector('a');
    moveTo(active, true);
  }, [activeSection, moveTo]);

  useLayoutEffect(() => {
    const bar = barRef.current;
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const active = bar.querySelector('[aria-current="page"]') || bar.querySelector('a');
      moveTo(active, false);
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(bar);
    bar.querySelectorAll('a').forEach((tab) => observer?.observe(tab));
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure);

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [moveTo]);

  return (
    <div ref={barRef} className="notch-nav-links t-tabs" data-active={Boolean(activeSection)}>
      <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
      {items.map((item) => {
        const isCurrent = activeSection === item.id;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`header-notch-link t-tab${isCurrent ? ' active' : ''}`}
            aria-current={isCurrent ? 'page' : undefined}
            onClick={(event) => {
              moveTo(event.currentTarget, true);
              onSelect(event, item.id);
            }}
          >
            {item.shortLabel ? (
              <>
                <span className="notch-text-full">{item.label}</span>
                <span className="notch-text-short">{item.shortLabel}</span>
              </>
            ) : (
              item.label
            )}
          </a>
        );
      })}
    </div>
  );
};

export default GuestSectionTabs;
