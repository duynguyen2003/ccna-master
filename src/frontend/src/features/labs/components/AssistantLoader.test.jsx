import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AssistantLoader from '@ccna/agent-ui/loader';

const pending = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const moduleOf = (text) => ({ default: () => <div>{text}</div> });
const show = (load, onClose = jest.fn()) =>
  render(
    <AssistantLoader load={load} onClose={onClose}>
      {(Panel) => <Panel />}
    </AssistantLoader>
  );

afterEach(() => jest.useRealTimers());

test('loader exposes status and close during chunk loading, then shows the loaded panel', async () => {
  const chunk = pending();
  const onClose = jest.fn();
  show(() => chunk.promise, onClose);
  expect(screen.getByRole('status')).toHaveTextContent('Đang tải trợ lý');
  fireEvent.click(screen.getByRole('button', { name: 'Đóng trợ lý AI' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => chunk.resolve(moduleOf('AI đã mở')));
  expect(screen.getByText('AI đã mở')).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('chunk timeout offers retry and ignores the previous attempt arriving late', async () => {
  jest.useFakeTimers();
  const old = pending();
  const next = pending();
  const load = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  show(load);
  await act(async () => jest.advanceTimersByTime(12000));
  expect(screen.getByRole('alert')).toHaveTextContent('Chưa tải được trợ lý');
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  await act(async () => next.resolve(moduleOf('Lần mới')));
  await act(async () => old.resolve(moduleOf('Lần cũ')));
  expect(screen.getByText('Lần mới')).toBeInTheDocument();
  expect(screen.queryByText('Lần cũ')).not.toBeInTheDocument();
  expect(load).toHaveBeenCalledTimes(2);
});

test('rejected import can be retried without reloading the workspace', async () => {
  const load = jest
    .fn()
    .mockRejectedValueOnce(new Error('chunk failed'))
    .mockResolvedValue(moduleOf('Đã khôi phục'));
  show(load);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('Đã khôi phục')).toBeInTheDocument();
});

test('render error is contained and retry remounts only the assistant', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const load = jest
      .fn()
      .mockResolvedValueOnce({
        default: () => {
          throw new Error('broken panel');
        },
      })
      .mockResolvedValueOnce(moduleOf('Trợ lý phục hồi'));
    show(load);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Trợ lý phục hồi')).toBeInTheDocument();
  } finally {
    log.mockRestore();
  }
});

test('unmounted loader ignores a late import', async () => {
  const chunk = pending();
  const view = show(() => chunk.promise);
  view.unmount();
  await act(async () => chunk.resolve(moduleOf('Không hiển thị')));
  expect(screen.queryByText('Không hiển thị')).not.toBeInTheDocument();
});

test('mobile loading and error use the provided dialog outside the hidden CLI surface', async () => {
  const original = window.matchMedia;
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  try {
    const Dialog = ({ children, title }) => (
      <dialog open aria-label={title}>
        {children}
      </dialog>
    );
    render(
      <AssistantLoader
        load={() => Promise.reject(new Error('offline'))}
        Dialog={Dialog}
        onClose={jest.fn()}
      >
        {(Panel) => <Panel />}
      </AssistantLoader>
    );
    expect(screen.getByRole('dialog', { name: 'Trợ lý AI' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  } finally {
    window.matchMedia = original;
  }
});
