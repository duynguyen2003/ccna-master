import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import useClipboard from '@ccna/agent-ui/clipboard';
import AnimatedCopyButton from './AnimatedCopyButton';

let mockReduced = false;
jest.mock('motion/react', () => ({
  ...jest.requireActual('motion/react'),
  useReducedMotion: () => mockReduced,
}));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
let writeText;
beforeEach(() => {
  jest.useFakeTimers();
  mockReduced = false;
  writeText = jest.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

test('icon-only control keeps its size/name and only confirms after clipboard succeeds', async () => {
  const pending = deferred();
  writeText.mockReturnValue(pending.promise);
  const copied = jest.fn();
  render(<AnimatedCopyButton value="router eigrp 1" label="Chép lệnh R2" onCopied={copied} />);
  const button = screen.getByRole('button', { name: 'Chép lệnh R2' });
  expect(button).toHaveAttribute('type', 'button');
  expect(button).not.toHaveAttribute('title');
  expect(button).not.toHaveTextContent(/Sao chép|Copy/);
  expect(button).toHaveStyle({ width: '32px', height: '32px', padding: '0px' });
  fireEvent.click(button);
  expect(button).toHaveAttribute('data-state', 'pending');
  expect(button).toBeEnabled();
  expect(copied).not.toHaveBeenCalled();
  await act(async () => pending.resolve());
  expect(writeText).toHaveBeenCalledWith('router eigrp 1');
  expect(button).toHaveAttribute('data-state', 'copied');
  expect(copied).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('status')).toHaveTextContent('Đã sao chép.');
  expect(button).toHaveStyle({ width: '32px', height: '32px' });
  act(() => jest.advanceTimersByTime(1400));
  expect(button).toHaveAttribute('data-state', 'idle');
});

test('repeated successes restart the complete 1400ms interval and animation sequence', async () => {
  const { result } = renderHook(() => useClipboard('line 1\n line 2'));
  await act(async () => result.current.copy());
  const first = result.current.sequence;
  act(() => jest.advanceTimersByTime(1000));
  await act(async () => result.current.copy());
  expect(result.current.sequence).toBeGreaterThan(first);
  expect(writeText.mock.calls).toEqual([['line 1\n line 2'], ['line 1\n line 2']]);
  act(() => jest.advanceTimersByTime(400));
  expect(result.current.state).toBe('copied');
  act(() => jest.advanceTimersByTime(999));
  expect(result.current.state).toBe('copied');
  act(() => jest.advanceTimersByTime(1));
  expect(result.current.state).toBe('idle');
});

test('late completion of an older click cannot overwrite newer feedback or reset its timer', async () => {
  const first = deferred(),
    second = deferred();
  writeText.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const error = jest.fn();
  const { result } = renderHook(() => useClipboard('value', error));
  act(() => {
    void result.current.copy();
    void result.current.copy();
  });
  await act(async () => second.resolve());
  const sequence = result.current.sequence;
  act(() => jest.advanceTimersByTime(700));
  await act(async () => first.reject(new Error('permission')));
  expect(error).not.toHaveBeenCalled();
  expect(result.current.sequence).toBe(sequence);
  expect(result.current.state).toBe('copied');
  act(() => jest.advanceTimersByTime(700));
  expect(result.current.state).toBe('idle');
});

test('changing the value invalidates pending feedback without claiming the new value was copied', async () => {
  const pending = deferred();
  writeText.mockReturnValueOnce(pending.promise);
  const view = renderHook(({ value }) => useClipboard(value), { initialProps: { value: 'old' } });
  act(() => {
    void view.result.current.copy();
  });
  view.rerender({ value: 'new' });
  await act(async () => pending.resolve());
  expect(view.result.current.state).toBe('idle');
  await act(async () => view.result.current.copy());
  expect(writeText).toHaveBeenLastCalledWith('new');
  expect(view.result.current.state).toBe('copied');
});

test.each(['unavailable', 'rejected'])(
  'clipboard %s exposes failure without a success check',
  async (mode) => {
    if (mode === 'unavailable')
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    else writeText.mockRejectedValue(new Error('permission denied'));
    const error = jest.fn();
    render(<AnimatedCopyButton value="text" onError={error} />);
    const button = screen.getByRole('button', { name: 'Sao chép' });
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('data-state', 'error'));
    expect(screen.getByRole('status')).toHaveTextContent('Không thể sao chép.');
    expect(error).toHaveBeenCalledTimes(1);
  }
);

test('unmount clears the reset timer and ignores a late permission error', async () => {
  const { result: firstResult, unmount: unmountFirst } = renderHook(() => useClipboard('value'));
  await act(async () => firstResult.current.copy());
  expect(jest.getTimerCount()).toBe(1);
  unmountFirst();
  expect(jest.getTimerCount()).toBe(0);
  const pending = deferred();
  writeText.mockReturnValue(pending.promise);
  const error = jest.fn();
  const { result: secondResult, unmount: unmountSecond } = renderHook(() =>
    useClipboard('value', error)
  );
  act(() => {
    void secondResult.current.copy();
  });
  unmountSecond();
  await act(async () => pending.reject(new Error('permission')));
  expect(error).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test('reduced motion keeps copy feedback and an undefined value disables the action', async () => {
  mockReduced = true;
  const view = render(<AnimatedCopyButton value="zero motion" />);
  const button = screen.getByRole('button', { name: 'Sao chép' });
  fireEvent.click(button);
  await waitFor(() => expect(button).toHaveAttribute('data-state', 'copied'));
  view.rerender(<AnimatedCopyButton />);
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('data-state', 'idle');
});
