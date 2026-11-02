import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FeedbackExplanation from '@ccna/agent-ui/feedback';

const answer = {
  provider: 'gemini',
  explanation: 'Kiểm tra đường về sau khi đối chiếu bảng định tuyến.',
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test('isolated loading, one pending call, cached result and optional server quota', async () => {
  const pending = deferred();
  const load = jest.fn().mockReturnValue(pending.promise);
  render(<FeedbackExplanation scope="owner:attempt:submission" load={load} />);
  fireEvent.click(screen.getByRole('button', { name: 'Giải thích kết quả' }));
  const button = screen.getByRole('button', { name: 'Đang giải thích…' });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
  fireEvent.click(button);
  expect(load).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve({ ...answer, quota: { remaining: 7 } }));
  expect(screen.getByText('Còn 7 lượt')).toBeInTheDocument();
  expect(screen.getByText(/AI có thể sai/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Ẩn giải thích' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xem giải thích' }));
  expect(screen.getByText(answer.explanation)).toBeInTheDocument();
  expect(load).toHaveBeenCalledTimes(1);
});

test('attempt, account or submission changes clear cached content and ignore late responses', async () => {
  const pending = deferred();
  const load = jest.fn().mockReturnValue(pending.promise);
  const view = render(<FeedbackExplanation scope="owner:A:1" load={load} />);
  fireEvent.click(screen.getByRole('button', { name: 'Giải thích kết quả' }));
  view.rerender(<FeedbackExplanation scope="owner:B:1" load={load} />);
  await act(async () => pending.resolve(answer));
  expect(screen.queryByText(answer.explanation)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Giải thích kết quả' })).toBeEnabled();
  load.mockResolvedValue(answer);
  fireEvent.click(screen.getByRole('button', { name: 'Giải thích kết quả' }));
  await screen.findByText(answer.explanation);
  view.rerender(<FeedbackExplanation scope="owner:B:2" load={load} />);
  expect(screen.queryByText(answer.explanation)).not.toBeInTheDocument();
  view.rerender(<FeedbackExplanation scope="other:B:2" load={load} />);
  expect(screen.queryByText(answer.explanation)).not.toBeInTheDocument();
});

test.each([
  [{ status: 429, code: 'AI_QUOTA_EXHAUSTED' }, /hết lượt/],
  [{ status: 429 }, /gửi quá nhanh/],
  [{ status: 503 }, /tạm thời không khả dụng/],
  [{}, /Kiểm tra mạng/],
])('failed explanation reports %j and allows a deliberate retry', async (failure, message) => {
  const load = jest.fn().mockRejectedValueOnce(failure).mockResolvedValue(answer);
  render(<FeedbackExplanation scope="owner:A:1" load={load} />);
  fireEvent.click(screen.getByRole('button', { name: 'Giải thích kết quả' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(message);
  expect(screen.getByRole('button', { name: 'Giải thích kết quả' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Giải thích kết quả' }));
  await screen.findByText(answer.explanation);
  expect(load).toHaveBeenCalledTimes(2);
});

test('non-Gemini fallback cannot be displayed as an AI answer', async () => {
  render(
    <FeedbackExplanation
      scope="x"
      load={async () => ({ provider: 'deterministic', explanation: 'SYNTHETIC_FALLBACK' })}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Giải thích kết quả' }));
  await screen.findByRole('alert');
  expect(screen.queryByText('SYNTHETIC_FALLBACK')).not.toBeInTheDocument();
});
