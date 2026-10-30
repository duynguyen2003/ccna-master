import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import AiLabPanel from '@ccna/agent-ui/panel';
import { capabilities, ids, quota, request, result } from '@ccna/agent-ui/fixtures';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
let api;
const props = {
  baseUrl: '/api',
  token: 'synthetic',
  userId: 1,
  attemptId: ids.attempt,
  revision: 3,
  devices: [{ id: 'R1' }, { id: 'PC1' }],
  selectedDeviceId: 'R1',
  onClose: jest.fn(),
};
beforeEach(() => {
  Object.defineProperty(window, 'crypto', {
    configurable: true,
    value: { randomUUID: () => ids.client },
  });
  sessionStorage.clear();
  api = {
    capabilities: jest.fn().mockResolvedValue(capabilities),
    quota: jest.fn().mockResolvedValue({ quota }),
    history: jest.fn().mockResolvedValue({
      conversationId: ids.conversation,
      conversationEpoch: 0,
      items: [],
      nextCursor: null,
    }),
    create: jest.fn().mockResolvedValue(request()),
    recover: jest.fn(),
    read: jest.fn(),
    cancel: jest.fn(),
    feedback: jest
      .fn()
      .mockImplementation(async (_, messageId, input) => ({ messageId, helpful: input.helpful })),
  };
});

test('empty → independent pending → safe answer, copy and feedback; no AI command execution', async () => {
  const answer = JSON.parse(JSON.stringify(result));
  answer.answer.summary =
    '<img src="https://evil.invalid/a" onerror="alert(1)"><script>alert(2)</script> [x](javascript:alert(3))';
  const pending = deferred();
  api.create.mockReturnValue(pending.promise);
  const writeText = jest.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(
    <>
      <button>Terminal độc lập</button>
      <AiLabPanel {...props} api={api} />
    </>
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
  expect(screen.getByRole('button', { name: 'Terminal độc lập' })).toBeEnabled();
  expect(await screen.findByText('Đang gửi câu hỏi…')).toBeInTheDocument();
  expect(screen.getByRole('article', { name: 'Câu hỏi của bạn' })).toHaveTextContent(
    'Gợi ý bước tiếp theo'
  );
  await act(async () => pending.resolve(request('COMPLETED', { result: answer })));
  const message = await screen.findByRole('article', { name: 'Gợi ý từ hệ thống' });
  expect(within(message).getByText(answer.answer.summary)).toBeInTheDocument();
  // Security assertion also inspects elements which have no accessible role.
  // eslint-disable-next-line testing-library/no-node-access
  expect(message.querySelector('script, img, a[href^="javascript:"]')).toBeNull();
  expect(within(message).queryByRole('button', { name: 'Chạy' })).not.toBeInTheDocument();
  fireEvent.click(within(message).getByRole('button', { name: 'Sao chép' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('show ip interface brief'));
  fireEvent.click(within(message).getByRole('button', { name: 'Hữu ích' }));
  expect(await within(message).findByText('Đã lưu đánh giá.')).toBeInTheDocument();
});

test('live revision changes mark answer stale without automatically asking again', async () => {
  const view = render(<AiLabPanel {...props} api={api} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
  await screen.findByRole('article', { name: 'Gợi ý từ hệ thống' });
  view.rerender(<AiLabPanel {...props} revision={4} api={api} />);
  expect(screen.getByText(/Dựa trên cấu hình trước đó. Lab đã thay đổi/)).toBeInTheDocument();
  expect(api.create).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại', exact: true }));
  await waitFor(() => expect(api.create).toHaveBeenCalledTimes(2));
  expect(api.create.mock.calls[1][1].expectedRevision).toBe(4);
});

test('diagnose needs a source and target and concept needs a question', async () => {
  render(<AiLabPanel {...props} api={api} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Phân tích kết nối' }));
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Chọn thiết bị nguồn');
  expect(api.create).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Thiết bị đích'), { target: { value: 'PC1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
  await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
  expect(api.create.mock.calls[0][1]).toMatchObject({
    intent: 'DIAGNOSE',
    selectedDeviceId: 'R1',
    target: { deviceId: 'PC1' },
  });
});

test('new auth/attempt scope has no old content before late network responses settle', async () => {
  const late = deferred();
  api.create.mockReturnValue(late.promise);
  const view = render(<AiLabPanel {...props} api={api} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled());
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'PRIVATE_DRAFT_A' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
  const other = { ...api, capabilities: jest.fn().mockResolvedValue(capabilities) };
  view.rerender(<AiLabPanel {...props} userId={2} token="second" api={other} />);
  await act(async () => late.resolve(request()));
  expect(screen.queryByText(result.answer.summary)).not.toBeInTheDocument();
  expect(screen.getByRole('textbox')).toHaveValue('');
});

test('empty-state action focuses the question and concept validation clears on input', async () => {
  render(<AiLabPanel {...props} api={api} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Bắt đầu: Giải thích khái niệm' }));
  const question = screen.getByRole('textbox', { name: 'Khái niệm cần giải thích' });
  expect(question).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
  expect(question).toHaveAttribute('aria-invalid', 'true');
  expect(api.create).not.toHaveBeenCalled();
  fireEvent.change(question, { target: { value: 'Default gateway là gì?' } });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
  await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
  expect(api.create.mock.calls[0][1]).toMatchObject({
    intent: 'EXPLAIN_CONCEPT',
    message: 'Default gateway là gì?',
  });
});

test('changing the source clears a diagnosis target that is now the same device', async () => {
  render(<AiLabPanel {...props} api={api} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Phân tích kết nối', exact: true }));
  fireEvent.change(screen.getByLabelText('Thiết bị đích'), { target: { value: 'PC1' } });
  fireEvent.change(screen.getByLabelText('Thiết bị nguồn'), { target: { value: 'PC1' } });
  expect(screen.getByLabelText('Thiết bị đích')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
  expect(api.create).not.toHaveBeenCalled();
});

test('offline keeps draft, and incoming answers never scroll away from older reading', async () => {
  const late = deferred();
  api.create.mockReturnValue(late.promise);
  render(<AiLabPanel {...props} api={api} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled());
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Draft in this tab' } });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  fireEvent(window, new Event('offline'));
  expect(screen.getByRole('textbox')).toHaveValue('Draft in this tab');
  expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeDisabled();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  fireEvent(window, new Event('online'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled());
  const history = screen.getByLabelText('Lịch sử trợ lý AI');
  Object.defineProperties(history, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 100 },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
  history.scrollTop = 200;
  fireEvent.scroll(history);
  await act(async () => late.resolve(request()));
  expect(history.scrollTop).toBe(200);
  expect(screen.getByRole('button', { name: 'Tin mới ↓' })).toBeInTheDocument();
});

test('quota/disabled states cannot send; Escape closes the assistant', async () => {
  api.quota.mockResolvedValue({ quota: { ...quota, remaining: 0 } });
  const close = jest.fn();
  render(<AiLabPanel {...props} api={api} onClose={close} />);
  await screen.findByText(/Hết lượt trợ giúp/);
  expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole('complementary'), { key: 'Escape' });
  expect(close).toHaveBeenCalledTimes(1);
  expect(api.create).not.toHaveBeenCalled();
});

test('panel width supports keyboard controls and persists only a numeric preference', async () => {
  const change = jest.fn();
  render(<AiLabPanel {...props} api={api} onWidthChange={change} />);
  const separator = screen.getByRole('separator', { name: 'Chiều rộng trợ lý' });
  const before = Number(separator.getAttribute('aria-valuenow'));
  fireEvent.keyDown(separator, { key: 'ArrowLeft' });
  await waitFor(() => expect(change).toHaveBeenLastCalledWith(before + 24));
  expect(localStorage.getItem('ccna.ai.panel-width.v1')).toBe(String(before + 24));
  fireEvent.keyDown(separator, { key: 'Home' });
  expect(separator).toHaveAttribute('aria-valuenow', '320');
});

test('insufficient context offers a specific action without another model call', async () => {
  api.create.mockResolvedValue(
    request('COMPLETED', {
      result: { ...result, answer: { ...result.answer, claimType: 'INSUFFICIENT_CONTEXT' } },
    })
  );
  render(<AiLabPanel {...props} api={api} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Bổ sung thông tin' }));
  expect(screen.getByRole('button', { name: 'Phân tích kết nối', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(screen.getByRole('textbox')).toHaveFocus();
  expect(api.create).toHaveBeenCalledTimes(1);
});

test('a smaller viewport constrains the panel without overwriting the preferred desktop width', async () => {
  const originalWidth = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  localStorage.setItem('ccna.ai.panel-width.v1', '560');
  render(<AiLabPanel {...props} api={api} />);
  const separator = screen.getByRole('separator', { name: 'Chiều rộng trợ lý' });
  expect(separator).toHaveAttribute('aria-valuenow', '560');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
  fireEvent(window, new Event('resize'));
  expect(separator).toHaveAttribute('aria-valuenow', '320');
  expect(localStorage.getItem('ccna.ai.panel-width.v1')).toBe('560');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  fireEvent(window, new Event('resize'));
  expect(separator).toHaveAttribute('aria-valuenow', '560');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
});
