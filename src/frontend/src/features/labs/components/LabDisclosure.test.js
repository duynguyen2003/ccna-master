import React, { createRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import LabDisclosure from './LabDisclosure';
let media;
beforeEach(() => {
  jest.useFakeTimers();
  media = window.matchMedia;
  window.matchMedia = jest.fn(() => ({ matches: false }));
});
afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
  window.matchMedia = media;
});
test('rapid close and reopen cancels the old close and keeps hidden content inert', () => {
  render(
    <LabDisclosure summary="Mục tiêu" aria-label="Mục tiêu">
      <button>Việc con</button>
    </LabDisclosure>
  );
  const head = screen.getByText('Mục tiêu'),
    node = screen.getByRole('group', { name: 'Mục tiêu' });
  fireEvent.click(head);
  act(() => jest.advanceTimersByTime(20));
  expect(head).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(head);
  expect(node).toHaveAttribute('open');
  expect(screen.queryByRole('button', { name: 'Việc con' })).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(80));
  fireEvent.click(head);
  act(() => jest.advanceTimersByTime(300));
  expect(node).toHaveAttribute('open');
  expect(head).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(head);
  act(() => jest.advanceTimersByTime(251));
  expect(node).not.toHaveAttribute('open');
});
test('reduced motion closes immediately and reopening still works after an external completion closes details', () => {
  window.matchMedia = jest.fn(() => ({ matches: true }));
  const ref = createRef();
  render(
    <LabDisclosure ref={ref} summary="Cấu hình">
      <button>Việc con</button>
    </LabDisclosure>
  );
  const head = screen.getByText('Cấu hình');
  fireEvent.click(head);
  expect(head).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(head);
  expect(ref.current.open).toBe(false);
  fireEvent.click(head);
  act(() => {
    ref.current.open = false;
  });
  fireEvent(ref.current, new Event('toggle'));
  act(() => jest.advanceTimersByTime(1));
  expect(head).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(head);
  expect(ref.current.open).toBe(true);
  expect(head).toHaveAttribute('aria-expanded', 'true');
});
test('unmount cancels a pending closing transition', () => {
  const view = render(
    <LabDisclosure summary="Mở">
      <button>Việc con</button>
    </LabDisclosure>
  );
  const head = screen.getByText('Mở');
  fireEvent.click(head);
  act(() => jest.advanceTimersByTime(20));
  fireEvent.click(head);
  view.unmount();
  act(() => jest.advanceTimersByTime(300));
  expect(screen.queryByText('Việc con')).not.toBeInTheDocument();
});
