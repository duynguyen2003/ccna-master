import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeleteButton from './delete-button';

let mockReduced = false;
jest.mock('motion/react', () => ({
  ...jest.requireActual('motion/react'),
  useReducedMotion: () => mockReduced,
}));
beforeEach(() => {
  mockReduced = false;
});

test('requires confirmation and Escape restores the trigger without deleting', () => {
  const remove = jest.fn();
  render(<DeleteButton onConfirm={remove} />);
  const trigger = screen.getByRole('button', { name: 'Xóa' });
  fireEvent.click(trigger);
  expect(screen.getByRole('button', { name: 'Xác nhận xóa' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('button', { name: 'Xác nhận xóa' }), { key: 'Escape' });
  expect(remove).not.toHaveBeenCalled();
  expect(trigger).toHaveFocus();
});

test('locks repeated confirmations while an async deletion is pending', async () => {
  let finish;
  const remove = jest.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  render(<DeleteButton onConfirm={remove} />);
  fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
  const confirm = screen.getByRole('button', { name: 'Xác nhận xóa' });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(confirm).toBeDisabled();
  await act(async () => finish());
  expect(screen.getByRole('status')).toHaveTextContent('Đã xóa');
  expect(screen.getByRole('button', { name: 'Xóa' })).toHaveFocus();
});

test('does not cancel a deletion already in progress on Escape or outside click', async () => {
  let finish;
  const cancel = jest.fn();
  const remove = jest.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  render(<DeleteButton onConfirm={remove} onCancel={cancel} />);
  const trigger = screen.getByRole('button', { name: 'Xóa' });
  fireEvent.click(trigger);
  const confirm = screen.getByRole('button', { name: 'Xác nhận xóa' });
  fireEvent.click(confirm);
  fireEvent.keyDown(confirm, { key: 'Escape' });
  fireEvent.mouseDown(document.body);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: 'Hủy thao tác' })).toBeDisabled();
  expect(cancel).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('Đang xóa');
  await act(async () => finish());
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('announces failure and allows another confirmation without showing success', async () => {
  const remove = jest
    .fn()
    .mockRejectedValueOnce(new Error('Synthetic failure'))
    .mockResolvedValueOnce();
  render(<DeleteButton onConfirm={remove} />);
  const trigger = screen.getByRole('button', { name: 'Xóa' });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' }));
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('Không xóa được. Vui lòng thử lại.')
  );
  expect(screen.getByRole('status')).not.toHaveTextContent('Đã xóa');
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  const retry = await screen.findByRole('button', { name: 'Xác nhận xóa' });
  await waitFor(() => expect(retry).toBeEnabled());
  expect(retry).toHaveFocus();
  fireEvent.click(retry);
  expect(remove).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Đã xóa'));
});

test('explicit cancellation and outside click do not invoke deletion or bubble a parent action', () => {
  const remove = jest.fn(),
    cancel = jest.fn(),
    parent = jest.fn();
  render(
    <div onClick={parent}>
      <DeleteButton onConfirm={remove} onCancel={cancel} />
    </div>
  );
  const trigger = screen.getByRole('button', { name: 'Xóa' });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: 'Hủy thao tác' }));
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  fireEvent.mouseDown(document.body);
  expect(cancel).toHaveBeenCalledTimes(2);
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(remove).not.toHaveBeenCalled();
  expect(parent).not.toHaveBeenCalled();
});

test('a disabled control never opens its confirmation panel', () => {
  const remove = jest.fn();
  render(<DeleteButton disabled onConfirm={remove} />);
  fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
  expect(screen.queryByRole('group', { name: 'Xác nhận xóa' })).not.toBeInTheDocument();
  expect(remove).not.toHaveBeenCalled();
});

test('keeps confirmation and keyboard focus working with reduced motion', async () => {
  mockReduced = true;
  const remove = jest.fn().mockResolvedValue();
  render(<DeleteButton onConfirm={remove} />);
  const trigger = screen.getByRole('button', { name: 'Xóa' });
  fireEvent.click(trigger);
  const confirm = screen.getByRole('button', { name: 'Xác nhận xóa' });
  expect(confirm).toHaveFocus();
  fireEvent.click(confirm);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Đã xóa'));
  expect(remove).toHaveBeenCalledTimes(1);
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});
