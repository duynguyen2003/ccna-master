/* eslint-disable testing-library/no-node-access -- The aria-hidden pill's layout is the visual behavior under test. */
import React, { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import SlidingTabs from './SlidingTabs';

const options = ['R1', 'R2-long', 'disabled', 'R4'];
const originalObserver = global.ResizeObserver;
const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
let sizes;
let observers;
let snaps;

function Control({ label = 'Devices', selected, entries = options }) {
  const [value, setValue] = useState('R1');
  const current = selected ?? value;
  return (
    <SlidingTabs value={current} aria-label={label}>
      {entries.map((id) => (
        <button
          type="button"
          key={id}
          data-value={id}
          aria-pressed={id === current}
          disabled={id === 'disabled'}
          onClick={() => setValue(id)}
        >
          {id}
        </button>
      ))}
    </SlidingTabs>
  );
}

beforeEach(() => {
  sizes = {
    R1: { left: 3, width: 60 },
    'R2-long': { left: 66, width: 140 },
    disabled: { left: 209, width: 90 },
    R4: { left: 302, width: 70 },
  };
  observers = [];
  snaps = [];
  global.ResizeObserver = jest.fn(function (callback) {
    this.observe = jest.fn();
    this.disconnect = jest.fn();
    observers.push({ callback, observer: this });
  });
  jest.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function () {
    return sizes[this.dataset.value]?.left || 0;
  });
  jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function () {
    if (this.className === 't-tabs-pill') {
      snaps.push(this.style.transition);
      return Number.parseFloat(this.style.width) || 0;
    }
    return sizes[this.dataset.value]?.width || 0;
  });
  jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(36);
  jest.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(3);
  jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(150);
});
afterEach(() => {
  jest.restoreAllMocks();
  global.ResizeObserver = originalObserver;
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
  else delete document.fonts;
});

test('initial paint snaps; rapid clicks retarget the same pill and reveal the selected item inside the control', () => {
  render(<Control />);
  const bar = screen.getByRole('group', { name: 'Devices' });
  const pill = bar.querySelector('.t-tabs-pill');
  expect(pill).toHaveStyle({ left: '3px', width: '60px', height: '36px' });
  expect(snaps).toEqual(['none']);
  fireEvent.click(within(bar).getByRole('button', { name: 'R4' }));
  fireEvent.click(within(bar).getByRole('button', { name: 'R2-long' }));
  expect(bar.querySelectorAll('.t-tabs-pill')).toHaveLength(1);
  expect(pill).toHaveStyle({ left: '66px', width: '140px' });
  expect(pill.style.transition).toBe('');
  expect(within(bar).getByRole('button', { name: 'R2-long' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(bar.scrollLeft).toBe(66);
  expect(snaps).toEqual(['none']);
});

test('keyboard selection skips disabled buttons, moves focus and supports Home/End', () => {
  render(<Control />);
  const first = screen.getByRole('button', { name: 'R1' });
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  const second = screen.getByRole('button', { name: 'R2-long' });
  expect(second).toHaveFocus();
  fireEvent.keyDown(second, { key: 'ArrowRight' });
  expect(screen.getByRole('button', { name: 'R4' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('button', { name: 'R4' }), { key: 'Home' });
  expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: 'End' });
  expect(screen.getByRole('button', { name: 'R4' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'disabled' }));
  expect(screen.getByRole('button', { name: 'disabled' })).toHaveAttribute('aria-pressed', 'false');
});

test('external selection, resized labels and removed items stay aligned without recreating observers per selection', () => {
  const view = render(<Control selected="R1" />);
  const pill = screen.getByRole('group').querySelector('.t-tabs-pill');
  view.rerender(<Control selected="R2-long" />);
  expect(pill).toHaveStyle({ left: '66px', width: '140px' });
  expect(observers).toHaveLength(1);
  sizes['R2-long'] = { left: 76, width: 172 };
  act(() => observers[0].callback());
  expect(pill).toHaveStyle({ left: '76px', width: '172px' });
  expect(snaps).toEqual(['none', 'none']);
  view.rerender(<Control selected="R2-long" entries={['R1', 'R4']} />);
  expect(pill).toHaveStyle({ visibility: 'hidden' });
  expect(observers[0].observer.disconnect).toHaveBeenCalledTimes(1);
});

test('two controls do not move each other and late font callbacks are ignored after unmount', async () => {
  let ready;
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      ready: new Promise((resolve) => {
        ready = resolve;
      }),
    },
  });
  const view = render(
    <>
      <Control label="First" />
      <Control label="Second" />
    </>
  );
  const first = screen.getByRole('group', { name: 'First' });
  const second = screen.getByRole('group', { name: 'Second' });
  fireEvent.click(within(first).getByRole('button', { name: 'R4' }));
  expect(first.querySelector('.t-tabs-pill')).toHaveStyle({ left: '302px' });
  expect(second.querySelector('.t-tabs-pill')).toHaveStyle({ left: '3px' });
  view.unmount();
  const count = snaps.length;
  await act(async () => ready());
  expect(snaps).toHaveLength(count);
  observers.forEach(({ observer }) => expect(observer.disconnect).toHaveBeenCalledTimes(1));
});
