import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Dialog from './Dialog';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

function Example() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Mở lịch sử</button>
      {open && (
        <Dialog title="Lịch sử thi" onClose={() => setOpen(false)}>
          <button>Chi tiết lần thi</button>
        </Dialog>
      )}
    </>
  );
}

test('names the dialog, contains keyboard focus and restores focus on dismissal', () => {
  render(<Example />);
  const trigger = screen.getByRole('button', { name: 'Mở lịch sử' });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Lịch sử thi' });
  const close = screen.getByRole('button', { name: 'Đóng hộp thoại' });
  expect(close).toHaveFocus();
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: 'Chi tiết lần thi' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('button', { name: 'Chi tiết lần thi' }), { key: 'Tab' });
  expect(close).toHaveFocus();
  fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

test('opt-in exit keeps the modal until its own animation ends and closes only once', () => {
  jest.useFakeTimers();
  try {
    const close = jest.fn();
    render(
      <Dialog title="Ghi chú" onClose={close} animateExit>
        <button>Nội dung</button>
      </Dialog>
    );
    const dialog = screen.getByRole('dialog', { name: 'Ghi chú' });
    dialog.style.setProperty('--dialog-exit-duration', '150ms');
    fireEvent.click(screen.getByRole('button', { name: 'Đóng hộp thoại' }));
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAttribute('data-closing', 'true');
    expect(screen.getByRole('button', { name: 'Đóng hộp thoại' })).toBeDisabled();
    expect(close).not.toHaveBeenCalled();
    fireEvent.animationEnd(screen.getByRole('button', { name: 'Nội dung' }));
    expect(close).not.toHaveBeenCalled();
    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }));
    fireEvent.animationEnd(dialog);
    act(() => jest.advanceTimersByTime(500));
    expect(close).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

test('exit falls back to the CSS duration if no animation event arrives', () => {
  jest.useFakeTimers();
  try {
    const close = jest.fn();
    render(
      <Dialog title="Nội dung chương" onClose={close} animateExit>
        Nội dung
      </Dialog>
    );
    const dialog = screen.getByRole('dialog');
    dialog.style.setProperty('--dialog-exit-duration', '0.15s');
    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }));
    act(() => jest.advanceTimersByTime(199));
    expect(close).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(close).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

test('reduced motion skips the optional exit wait', () => {
  const previous = window.matchMedia;
  window.matchMedia = jest.fn(() => ({
    matches: true,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
  try {
    const close = jest.fn();
    render(
      <Dialog title="Ghi chú" onClose={close} animateExit>
        Nội dung
      </Dialog>
    );
    screen.getByRole('dialog').style.setProperty('--dialog-exit-duration', '150ms');
    fireEvent.click(screen.getByRole('button', { name: 'Đóng hộp thoại' }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).not.toHaveAttribute('data-closing');
  } finally {
    window.matchMedia = previous;
  }
});
