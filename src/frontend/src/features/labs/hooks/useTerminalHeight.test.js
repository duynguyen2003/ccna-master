import { act, renderHook } from '@testing-library/react';
import useTerminalHeight from './useTerminalHeight';

test('pointer resize captures the handle, respects bounds and stops after release', () => {
  const view = renderHook(() => useTerminalHeight(false));
  const handle = {
    focus: jest.fn(),
    setPointerCapture: jest.fn(),
    hasPointerCapture: () => true,
    releasePointerCapture: jest.fn(),
  };
  act(() =>
    view.result.current.separator.onPointerDown({
      button: 0,
      clientY: 400,
      pointerId: 1,
      currentTarget: handle,
      preventDefault: jest.fn(),
    })
  );
  act(() => view.result.current.separator.onPointerMove({ clientY: 320.25 }));
  expect(view.result.current.height).toBe(340);
  act(() => view.result.current.separator.onPointerUp({ currentTarget: handle, pointerId: 1 }));
  act(() => view.result.current.separator.onPointerMove({ clientY: 100 }));
  expect(view.result.current.height).toBe(340);
  expect(handle.setPointerCapture).toHaveBeenCalledWith(1);
  expect(handle.releasePointerCapture).toHaveBeenCalledWith(1);
});

test('terminal responds to keyboard, bounds and container changes after the attempt loads', () => {
  const original = global.ResizeObserver;
  let measure;
  const disconnect = jest.fn();
  global.ResizeObserver = class {
    constructor(callback) {
      measure = callback;
    }
    observe() {}
    disconnect = disconnect;
  };
  try {
    const view = renderHook(({ enabled }) => useTerminalHeight(enabled), {
      initialProps: { enabled: false },
    });
    view.result.current.pane.current = { clientHeight: 700 };
    view.rerender({ enabled: true });
    expect(view.result.current.height).toBe(260);
    const key = (value) =>
      act(() => view.result.current.separator.onKeyDown({ key: value, preventDefault: jest.fn() }));
    key('ArrowUp');
    expect(view.result.current.height).toBe(284);
    key('End');
    expect(view.result.current.height).toBe(420);
    key('ArrowUp');
    expect(view.result.current.height).toBe(420);
    view.result.current.pane.current.clientHeight = 500;
    act(() => measure());
    expect(view.result.current.height).toBe(220);
    key('Home');
    key('ArrowDown');
    expect(view.result.current.height).toBe(200);
    view.unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  } finally {
    global.ResizeObserver = original;
  }
});
