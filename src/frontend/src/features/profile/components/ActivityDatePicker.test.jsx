import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActivityDatePicker from './ActivityDatePicker';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

test('custom calendar moves across leap day with the keyboard and restores focus after selecting', async () => {
  const change = jest.fn();
  render(
    <ActivityDatePicker value="2024-02-29" min="2024-02-01" max="2024-03-15" onChange={change} />
  );
  const trigger = screen.getByRole('button', { name: 'Chọn ngày hoạt động' });
  trigger.focus();
  fireEvent.click(trigger);
  const leap = screen.getByRole('button', { name: 'Chọn ngày 29/02/2024' });
  expect(leap).toHaveFocus();
  fireEvent.keyDown(leap, { key: 'ArrowRight' });
  const next = screen.getByRole('button', { name: 'Chọn ngày 01/03/2024' });
  expect(next).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Chọn ngày 16/03/2024' })).toBeDisabled();
  fireEvent.click(next);
  expect(change).toHaveBeenCalledWith('2024-03-01');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
});

test('month/year chooser respects range limits; cancelling leaves the chosen date unchanged', async () => {
  const change = jest.fn();
  render(
    <ActivityDatePicker value="2026-01-02" min="2025-10-29" max="2026-10-28" onChange={change} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Chọn ngày hoạt động' }));
  fireEvent.click(screen.getByRole('button', { name: 'Chọn tháng và năm' }));
  fireEvent.click(screen.getByRole('button', { name: 'Năm trước' }));
  const months = screen.getByRole('group', { name: 'Tháng trong năm 2025' });
  expect(within(months).getByRole('button', { name: 'Tháng 9', exact: true })).toBeDisabled();
  fireEvent.click(within(months).getByRole('button', { name: 'Tháng 10', exact: true }));
  expect(screen.getByRole('button', { name: 'Chọn ngày 28/10/2025' })).toBeDisabled();
  const dialog = screen.getByRole('dialog', { name: 'Chọn ngày hoạt động' });
  fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(change).not.toHaveBeenCalled();
});

test('reduced motion dismisses immediately without waiting for an exit transition', () => {
  const previous = window.matchMedia;
  window.matchMedia = jest.fn(() => ({
    matches: true,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
  try {
    render(
      <ActivityDatePicker
        value="2026-10-28"
        min="2026-10-01"
        max="2026-10-28"
        onChange={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Chọn ngày hoạt động' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chọn ngày 27/10/2026' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  } finally {
    window.matchMedia = previous;
  }
});
