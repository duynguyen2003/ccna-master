import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActivityCalendar from './ActivityCalendar';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../services/Api';

jest.mock('../../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../services/Api', () => ({ api: { getActivityCalendar: jest.fn() } }));
const data = {
  from: '2026-10-26',
  to: '2026-10-28',
  total: 3,
  activeDays: 1,
  historyCompleteness: 'unknown',
  levels: [0, 1, 3, 5, 8],
  availableYears: [2026, 2025],
  days: [{ date: '2026-10-28', lesson: 2, lab: 1, count: 3 }],
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
beforeEach(() => {
  jest.resetAllMocks();
  useAuth.mockReturnValue({ token: 'account-a' });
  api.getActivityCalendar.mockResolvedValue(data);
});

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

test('keeps a single calendar Tab stop and supports arrows plus accessible date selection', async () => {
  render(<ActivityCalendar />);
  const grid = await screen.findByRole('group', { name: 'Lịch hoạt động theo ngày' });
  const days = within(grid).getAllByRole('button');
  expect(days.filter((day) => day.tabIndex === 0)).toHaveLength(1);
  expect(days[0]).toHaveAttribute('data-level', 'unknown');
  act(() => days[2].focus());
  fireEvent.keyDown(days[2], { key: 'ArrowUp' });
  expect(days[1]).toHaveFocus();
  fireEvent.keyDown(days[1], { key: 'ArrowLeft' });
  expect(days[0]).toHaveFocus();
  fireEvent.keyDown(days[0], { key: 'End' });
  expect(days[2]).toHaveFocus();
  fireEvent.click(screen.getByText('Xem theo ngày'));
  fireEvent.click(screen.getByRole('button', { name: 'Chọn ngày hoạt động', exact: true }));
  fireEvent.click(
    within(screen.getByRole('dialog', { name: 'Chọn ngày hoạt động' })).getByRole('button', {
      name: 'Chọn ngày 27/10/2026',
      exact: true,
    })
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(days[1]).toHaveAttribute('tabindex', '0');
  expect(screen.getAllByText(/27\/10\/2026: chưa ghi nhận/).length).toBeGreaterThan(0);
});

test('daily disclosure keeps the history to five entries per page and hides controls when collapsed', async () => {
  const days = Array.from({ length: 8 }, (_, i) => ({
    date: `2026-10-${21 + i}`,
    count: 1,
    lesson: 1,
    lab: 0,
  }));
  api.getActivityCalendar.mockResolvedValue({
    ...data,
    from: '2026-10-21',
    days,
    total: 8,
    activeDays: 8,
  });
  render(<ActivityCalendar />);
  await screen.findByRole('group', { name: 'Lịch hoạt động theo ngày' });
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
  const trigger = screen.getByRole('button', { name: 'Xem theo ngày' });
  fireEvent.click(trigger);
  expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(5);
  expect(screen.getByText('Trang 1 / 2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Trang hoạt động sau' }));
  expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(3);
  expect(screen.getByText('Trang 2 / 2')).toBeInTheDocument();
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('button', { name: 'Chọn ngày hoạt động' })).not.toBeInTheDocument();
});

test('retries an error independently and does not present failure as an empty history', async () => {
  api.getActivityCalendar.mockRejectedValueOnce(new Error('offline'));
  render(<ActivityCalendar />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được lịch hoạt động');
  expect(screen.queryByText(/Chưa có lượt hoàn thành được ghi nhận/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại lịch hoạt động' }));
  expect(
    await screen.findByRole('group', { name: 'Lịch hoạt động theo ngày' })
  ).toBeInTheDocument();
});

test('late results from a previous account are discarded and the old request is aborted', async () => {
  const first = deferred();
  const second = deferred();
  api.getActivityCalendar.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const view = render(<ActivityCalendar />);
  useAuth.mockReturnValue({ token: 'account-b' });
  view.rerender(<ActivityCalendar />);
  expect(api.getActivityCalendar.mock.calls[0][2].signal.aborted).toBe(true);
  await act(async () => first.resolve({ ...data, total: 999 }));
  expect(screen.queryByText('999')).not.toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'Lịch hoạt động theo ngày' })).not.toBeInTheDocument();
  await act(async () => second.resolve({ ...data, total: 0, activeDays: 0, days: [] }));
  expect(
    await screen.findByText('Chưa có lượt hoàn thành được ghi nhận trong khoảng này.')
  ).toBeInTheDocument();
  expect(screen.queryByText('999')).not.toBeInTheDocument();
});

test('late results from a previous filter do not replace the current period', async () => {
  const old = deferred();
  api.getActivityCalendar
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce({ ...data, total: 1 });
  render(<ActivityCalendar />);
  fireEvent.click(screen.getByRole('combobox', { name: 'Loại hoạt động' }));
  fireEvent.click(screen.getByRole('option', { name: 'Lab thực hành' }));
  await waitFor(() =>
    expect(api.getActivityCalendar.mock.calls[1][1]).toEqual({ range: 'last365', type: 'lab' })
  );
  await screen.findByRole('group', { name: 'Lịch hoạt động theo ngày' });
  await act(async () => old.resolve({ ...data, total: 999 }));
  expect(screen.queryByText('999')).not.toBeInTheDocument();
});
