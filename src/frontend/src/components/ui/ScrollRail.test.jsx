import React, { useCallback, useRef } from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ScrollRail from './ScrollRail';

const originalObserver = global.ResizeObserver;
const originalPointer = window.PointerEvent;
let resize;
beforeEach(() => {
  global.ResizeObserver = jest.fn(function (callback) {
    resize = callback;
    this.observe = jest.fn();
    this.disconnect = jest.fn();
  });
  window.PointerEvent = class extends MouseEvent {
    constructor(type, options) {
      super(type, options);
      this.pointerId = options.pointerId || 1;
    }
  };
});
afterEach(() => {
  global.ResizeObserver = originalObserver;
  window.PointerEvent = originalPointer;
});

function Example({ dimensions }) {
  const viewport = useRef(null);
  const attach = useCallback(
    (element) => {
      viewport.current = element;
      if (!element) return;
      Object.defineProperties(element, {
        clientHeight: { configurable: true, get: () => dimensions.height },
        scrollHeight: { configurable: true, get: () => dimensions.content },
      });
    },
    [dimensions]
  );
  return (
    <div>
      <section ref={attach} id="event-details" aria-label="Nội dung" tabIndex={0}>
        <p>Chi tiết gói tin dài</p>
      </section>
      <ScrollRail viewportRef={viewport} label="Cuộn chi tiết" />
    </div>
  );
}

test('native scrolling and keyboard navigation keep the custom rail synchronized', () => {
  render(<Example dimensions={{ height: 200, content: 1000 }} />);
  const viewport = screen.getByRole('region', { name: 'Nội dung' });
  const scrollbar = screen.getByRole('scrollbar', { name: 'Cuộn chi tiết' });
  expect(scrollbar).toHaveAttribute('aria-controls', 'event-details');
  expect(scrollbar).toHaveAttribute('aria-orientation', 'vertical');
  expect(fireEvent.wheel(scrollbar, { deltaY: 80 })).toBe(false);
  expect(viewport.scrollTop).toBe(80);
  fireEvent.wheel(scrollbar, { deltaY: 2, deltaMode: 1 });
  expect(viewport.scrollTop).toBe(112);
  viewport.scrollTop = 400;
  fireEvent.scroll(viewport);
  expect(scrollbar).toHaveAttribute('aria-valuenow', '400');
  expect(scrollbar).toHaveAttribute('aria-valuetext', '50%');
  fireEvent.keyDown(scrollbar, { key: 'End' });
  expect(viewport.scrollTop).toBe(800);
  fireEvent.keyDown(scrollbar, { key: 'ArrowDown' });
  expect(viewport.scrollTop).toBe(800);
  fireEvent.keyDown(scrollbar, { key: 'PageUp' });
  expect(viewport.scrollTop).toBe(620);
  fireEvent.keyDown(scrollbar, { key: 'Home' });
  expect(viewport.scrollTop).toBe(0);
  fireEvent.keyDown(scrollbar, { key: 'PageDown' });
  fireEvent.keyDown(scrollbar, { key: 'ArrowUp' });
  expect(viewport.scrollTop).toBe(140);
});

test('dragging and clicking the track scroll content; cancelled pointers stop dragging', () => {
  render(<Example dimensions={{ height: 200, content: 1000 }} />);
  const viewport = screen.getByRole('region', { name: 'Nội dung' });
  const scrollbar = screen.getByRole('scrollbar', { name: 'Cuộn chi tiết' });
  fireEvent.pointerDown(scrollbar, { pointerId: 1, button: 0, clientY: 10 });
  fireEvent.pointerMove(scrollbar, { pointerId: 2, clientY: 90 });
  expect(viewport.scrollTop).toBe(0);
  fireEvent.pointerMove(scrollbar, { pointerId: 1, clientY: 110 });
  expect(viewport.scrollTop).toBeGreaterThan(500);
  expect(viewport.scrollTop).toBeLessThan(550);
  fireEvent.pointerCancel(scrollbar, { pointerId: 1 });
  const stopped = viewport.scrollTop;
  fireEvent.pointerMove(scrollbar, { pointerId: 1, clientY: 170 });
  expect(viewport.scrollTop).toBe(stopped);
  fireEvent.keyDown(scrollbar, { key: 'Home' });
  fireEvent.pointerDown(scrollbar, { pointerId: 1, button: 0, clientY: 150 });
  expect(viewport.scrollTop).toBeGreaterThan(700);
  fireEvent.pointerUp(scrollbar, { pointerId: 1 });
  expect(scrollbar).not.toHaveClass('is-dragging');
});

test('resize/content changes update the range and hide the rail when scrolling is unnecessary', () => {
  const dimensions = { height: 200, content: 1000 };
  render(<Example dimensions={dimensions} />);
  expect(screen.getByRole('scrollbar')).toHaveAttribute('aria-valuemax', '800');
  dimensions.content = 2000;
  act(() => resize());
  expect(screen.getByRole('scrollbar')).toHaveAttribute('aria-valuemax', '1800');
  dimensions.height = 600;
  act(() => resize());
  expect(screen.getByRole('scrollbar')).toHaveAttribute('aria-valuemax', '1400');
  dimensions.content = 400;
  act(() => resize());
  expect(screen.queryByRole('scrollbar')).not.toBeInTheDocument();
});
