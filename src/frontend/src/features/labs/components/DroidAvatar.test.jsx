import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DroidAvatar, { assistantIsWorking } from '@ccna/agent-ui/avatar';

const mockPoke = jest.fn();
jest.mock('bot-avatars', () => {
  const React = require('react');
  return {
    BotAvatar: React.forwardRef(function MockAvatar(
      { interactive, paused, state, type, shading, onClick },
      ref
    ) {
      return (
        <canvas
          ref={ref}
          data-testid="avatar-canvas"
          data-interactive={String(interactive)}
          data-paused={String(paused)}
          data-state={state}
          data-body={type}
          data-material={shading}
          onClick={(event) => {
            if (interactive && !paused) mockPoke();
            onClick?.(event);
          }}
        />
      );
    }),
  };
});

test('the green flower uses the same lifecycle gating without changing the droid default', () => {
  enableCanvas();
  const view = render(<DroidAvatar appearance="flower" busy />);
  const avatar = screen.getByRole('img');
  expect(avatar).toHaveAttribute('data-appearance', 'flower');
  expect(screen.getByTestId('avatar-canvas')).toHaveAttribute('data-body', 'flower');
  expect(screen.getByTestId('avatar-canvas')).toHaveAttribute('data-material', 'fabric');
  expect(avatar).toHaveAttribute('data-state', 'working');
  view.rerender(<DroidAvatar appearance="flower" visible={false} />);
  expect(avatar).toHaveAttribute('data-paused', 'true');
  expect(avatar).toHaveAttribute('data-state', 'default');
  view.rerender(<DroidAvatar />);
  expect(avatar).toHaveAttribute('data-appearance', 'droid');
  expect(screen.getByTestId('avatar-canvas')).toHaveAttribute('data-body', 'droid');
  expect(screen.getByTestId('avatar-canvas')).toHaveAttribute('data-material', 'crisp');
});
const originalCanvas = Object.getOwnPropertyDescriptor(window, 'CanvasRenderingContext2D');
const enableCanvas = () =>
  Object.defineProperty(window, 'CanvasRenderingContext2D', {
    configurable: true,
    value: function CanvasStub() {},
  });
beforeEach(() => mockPoke.mockClear());
afterEach(() => {
  if (originalCanvas) Object.defineProperty(window, 'CanvasRenderingContext2D', originalCanvas);
  else delete window.CanvasRenderingContext2D;
});

test.each([false, true])('pointer and keyboard react once with greeting=%s', (greeting) => {
  enableCanvas();
  const open = jest.fn();
  render(
    <button onClick={open} aria-label="Trợ lý AI">
      <DroidAvatar decorative greeting={greeting} />
    </button>
  );
  const control = screen.getByRole('button', { name: 'Trợ lý AI' });
  const canvas = screen.getByTestId('avatar-canvas');
  expect(canvas).toHaveAttribute('data-interactive', 'true');
  fireEvent.click(control);
  expect(mockPoke).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledTimes(1);
  fireEvent.click(canvas);
  expect(mockPoke).toHaveBeenCalledTimes(2);
  expect(open).toHaveBeenCalledTimes(2);
  control.focus();
  userEvent.keyboard('{Enter}');
  expect(mockPoke).toHaveBeenCalledTimes(3);
  expect(open).toHaveBeenCalledTimes(3);
  userEvent.keyboard(' ');
  expect(mockPoke).toHaveBeenCalledTimes(4);
  expect(open).toHaveBeenCalledTimes(4);
  expect(canvas).toHaveAttribute('data-state', 'default');
});

test.each([{ visible: false }, { animate: false }])(
  'hidden/static avatars do not react (%j)',
  (options) => {
    enableCanvas();
    const open = jest.fn();
    render(
      <button onClick={open} aria-label="Trợ lý AI">
        <DroidAvatar busy decorative {...options} />
      </button>
    );
    const canvas = screen.getByTestId('avatar-canvas');
    fireEvent.click(screen.getByRole('button', { name: 'Trợ lý AI' }));
    expect(canvas).toHaveAttribute('data-interactive', 'false');
    expect(canvas).toHaveAttribute('data-state', 'working');
    expect(mockPoke).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
  }
);

test('removing an avatar detaches its button listener', () => {
  enableCanvas();
  const open = jest.fn();
  const view = render(
    <button onClick={open} aria-label="Trợ lý AI">
      <DroidAvatar decorative />
    </button>
  );
  const canvas = screen.getByTestId('avatar-canvas');
  const click = jest.spyOn(canvas, 'click');
  view.rerender(<button onClick={open} aria-label="Trợ lý AI" />);
  fireEvent.click(screen.getByRole('button', { name: 'Trợ lý AI' }));
  expect(click).not.toHaveBeenCalled();
  expect(open).toHaveBeenCalledTimes(1);
});

test.each([false, true])('reduced motion detaches reactions with greeting=%s', (greeting) => {
  enableCanvas();
  const oldMedia = window.matchMedia;
  let changed;
  const media = {
    matches: false,
    addEventListener: (_, callback) => {
      changed = callback;
    },
    removeEventListener: jest.fn(),
  };
  window.matchMedia = () => media;
  try {
    const open = jest.fn();
    render(
      <button onClick={open} aria-label="Trợ lý AI">
        <DroidAvatar decorative greeting={greeting} />
      </button>
    );
    const control = screen.getByRole('button', { name: 'Trợ lý AI' });
    fireEvent.click(control);
    expect(mockPoke).toHaveBeenCalledTimes(1);
    act(() => {
      media.matches = true;
      changed();
    });
    fireEvent.click(control);
    expect(mockPoke).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('avatar-canvas')).toHaveAttribute('data-interactive', 'false');
    expect(open).toHaveBeenCalledTimes(2);
  } finally {
    window.matchMedia = oldMedia;
  }
});

test('working follows actual request state and clears after completion, failure or disconnection', () => {
  expect(assistantIsWorking({ online: true, phase: 'sending' })).toBe(true);
  for (const status of ['QUEUED', 'RUNNING'])
    expect(assistantIsWorking({ online: true, pending: {}, request: { status } })).toBe(true);
  for (const status of ['COMPLETED', 'FAILED', 'CANCELLED'])
    expect(assistantIsWorking({ online: true, request: { status } })).toBe(false);
  expect(
    assistantIsWorking({
      online: true,
      pending: {},
      request: { status: 'RUNNING' },
      error: { code: 'AI_NETWORK_ERROR' },
    })
  ).toBe(false);
  expect(assistantIsWorking({ online: false, phase: 'sending' })).toBe(false);
});

test('avatar freezes when hidden or reduced motion is enabled without faking working', () => {
  const original = window.matchMedia;
  let update;
  const media = {
    matches: false,
    addEventListener: (_, callback) => {
      update = callback;
    },
    removeEventListener: jest.fn(),
  };
  window.matchMedia = () => media;
  try {
    const { rerender, unmount } = render(<DroidAvatar />);
    expect(screen.getByRole('img')).toHaveAttribute('data-state', 'default');
    rerender(<DroidAvatar busy />);
    expect(screen.getByRole('img')).toHaveAccessibleName('Trợ lý AI đang xử lý');
    act(() => {
      media.matches = true;
      update();
    });
    expect(screen.getByRole('img')).toHaveAttribute('data-paused', 'true');
    rerender(<DroidAvatar visible={false} />);
    expect(screen.getByRole('img')).toHaveAttribute('data-state', 'default');
    expect(screen.getByRole('img')).toHaveAttribute('data-paused', 'true');
    unmount();
    expect(media.removeEventListener).toHaveBeenCalled();
  } finally {
    window.matchMedia = original;
  }
});
