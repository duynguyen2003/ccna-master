import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import AiLabPanel from '@ccna/agent-ui/panel';
import DropdownSelect from '../../../components/ui/DropdownSelect';
import AnimatedCopyButton from '../../../components/ui/AnimatedCopyButton';
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
  CopyButton: AnimatedCopyButton,
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

test('server progress stays on the task device and composer Enter submits while Shift/IME do not', async () => {
  const pending = request('RUNNING', {
    progress: {
      streamVersion: 3,
      phase: 'ANALYZING',
      deviceId: 'R2',
      unitStatus: 'RESERVED',
      reasonCode: null,
      deadlineAt: new Date(Date.now() + 60000).toISOString(),
    },
  });
  api.create.mockResolvedValue(pending);
  render(<AiLabPanel {...props} api={api} />);
  const input = await screen.findByRole('textbox');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled());
  fireEvent.change(input, { target: { value: 'Giúp tôi hiểu bước này' } });
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  expect(api.create).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(await screen.findByText('Đang phân tích nhiệm vụ trên R2…')).toBeInTheDocument();
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(input.style.height).not.toBe('');
});

test('reset action closes options, focuses confirmation and preserves history until confirmed', async () => {
  api.capabilities.mockResolvedValue({ ...capabilities, conversationId: ids.conversation });
  api.reset = jest.fn().mockResolvedValue({});
  render(<AiLabPanel {...props} api={api} Select={DropdownSelect} />);
  const reset = await screen.findByRole('button', { name: 'Đặt lại hội thoại' });
  await waitFor(() => expect(reset).toBeEnabled());
  const options = screen.getByText('Tùy chọn');
  fireEvent.click(options);
  expect(reset).toBeVisible();
  fireEvent.click(reset);
  expect(reset).not.toBeVisible();
  expect(screen.getByRole('group', { name: 'Xác nhận đặt lại hội thoại' })).toBeVisible();
  const keep = screen.getByRole('button', { name: 'Giữ hội thoại' });
  expect(keep).toHaveFocus();
  expect(api.reset).not.toHaveBeenCalled();
  fireEvent.click(keep);
  expect(
    screen.queryByRole('group', { name: 'Xác nhận đặt lại hội thoại' })
  ).not.toBeInTheDocument();
  expect(options).toHaveFocus();
  expect(reset).not.toBeVisible();
  expect(api.reset).not.toHaveBeenCalled();
});

test('cancel stays enabled outside the disabled composer fields while a request is running', async () => {
  api.create.mockResolvedValue(request('RUNNING'));
  api.cancel.mockResolvedValue(request('CANCELLED'));
  render(<AiLabPanel {...props} api={api} Select={DropdownSelect} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
  const cancel = await screen.findByRole('button', { name: 'Hủy yêu cầu' });
  expect(cancel).toBeEnabled();
  expect(screen.getByRole('combobox', { name: 'Thiết bị' })).toBeDisabled();
  expect(screen.getByRole('combobox', { name: 'Cách trợ giúp' })).toBeDisabled();
  await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
  fireEvent.click(cancel);
  await waitFor(() =>
    expect(api.cancel).toHaveBeenCalledWith(ids.attempt, ids.request, expect.anything())
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled());
});

test('app dropdown adapter renders styled listboxes for intent, device, hints and feedback', async () => {
  api.create.mockResolvedValue(request('COMPLETED', { result }));
  render(<AiLabPanel {...props} api={api} Select={DropdownSelect} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled());
  expect(screen.getByRole('combobox', { name: 'Cách trợ giúp' }).textContent).toBe('Gợi ý');
  fireEvent.click(screen.getByRole('combobox', { name: 'Cách trợ giúp' }));
  const closeCalls = props.onClose.mock.calls.length;
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Cách trợ giúp' }), { key: 'Escape' });
  expect(props.onClose).toHaveBeenCalledTimes(closeCalls);
  fireEvent.click(screen.getByRole('combobox', { name: 'Cách trợ giúp' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Phân tích kết nối' }));
  fireEvent.click(screen.getByRole('combobox', { name: 'Thiết bị đích' }));
  fireEvent.click(await screen.findByRole('option', { name: 'PC1' }));
  expect(screen.getByRole('combobox', { name: 'Cách trợ giúp' }).textContent).toBe('Kết nối');
  expect(screen.queryByText('Đổi thiết bị · gợi ý mức 1')).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Thiết bị' })).toHaveAttribute(
    'aria-haspopup',
    'listbox'
  );
  fireEvent.click(screen.getByRole('combobox', { name: 'Mức gợi ý' }));
  fireEvent.click(await screen.findByRole('option', { name: '2 · Kiểm tra cụ thể' }));
  expect(screen.getByRole('combobox', { name: 'Mức gợi ý' }).textContent).toBe('Mức gợi ý 2/3');
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Chưa hữu ích' }));
  fireEvent.click(screen.getByRole('combobox', { name: 'Lý do đánh giá' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Nhầm thiết bị' }));
  fireEvent.click(screen.getByRole('button', { name: 'Gửi đánh giá' }));
  await waitFor(() =>
    expect(api.feedback).toHaveBeenCalledWith(
      ids.attempt,
      expect.any(String),
      { helpful: false, reasonCode: 'WRONG_DEVICE' },
      expect.anything()
    )
  );
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
  expect(within(screen.getByRole('log')).getByText('Đang gửi câu hỏi…')).toBeInTheDocument();
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
  fireEvent.change(screen.getByRole('combobox', { name: 'Cách trợ giúp' }), {
    target: { value: 'DIAGNOSE' },
  });
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
  fireEvent.change(screen.getByRole('combobox', { name: 'Cách trợ giúp' }), {
    target: { value: 'DIAGNOSE' },
  });
  fireEvent.change(screen.getByLabelText('Thiết bị đích'), { target: { value: 'PC1' } });
  fireEvent.change(screen.getByLabelText('Thiết bị'), { target: { value: 'PC1' } });
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
  const originalWidth = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  const change = jest.fn();
  render(<AiLabPanel {...props} api={api} onWidthChange={change} />);
  const separator = screen.getByRole('separator', { name: 'Chiều rộng trợ lý' });
  const before = Number(separator.getAttribute('aria-valuenow'));
  fireEvent.keyDown(separator, { key: 'ArrowLeft' });
  await waitFor(() => expect(change).toHaveBeenLastCalledWith(before + 24));
  expect(localStorage.getItem('ccna.ai.panel-width.v1')).toBe(String(before + 24));
  fireEvent.keyDown(separator, { key: 'Home' });
  expect(separator).toHaveAttribute('aria-valuenow', '320');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
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
  expect(screen.getByRole('combobox', { name: 'Cách trợ giúp' })).toHaveValue('DIAGNOSE');
  expect(screen.getByRole('textbox')).toHaveFocus();
  expect(api.create).toHaveBeenCalledTimes(1);
});

test('a smaller viewport constrains the panel without overwriting the preferred desktop width', async () => {
  const originalWidth = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  localStorage.setItem('ccna.ai.panel-width.v1', '560');
  render(<AiLabPanel {...props} api={api} />);
  const separator = screen.getByRole('separator', { name: 'Chiều rộng trợ lý' });
  expect(separator).toHaveAttribute('aria-valuenow', '480');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
  fireEvent(window, new Event('resize'));
  expect(separator).toHaveAttribute('aria-valuenow', '320');
  expect(localStorage.getItem('ccna.ai.panel-width.v1')).toBe('560');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  fireEvent(window, new Event('resize'));
  expect(separator).toHaveAttribute('aria-valuenow', '480');
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
});

test('assistant defaults to the current device and follows terminal selection without resending', async () => {
  const view = render(<AiLabPanel {...props} selectedDeviceId="" api={api} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled());
  expect(screen.getByRole('combobox', { name: 'Thiết bị' })).toHaveValue('R1');
  view.rerender(<AiLabPanel {...props} selectedDeviceId="PC1" api={api} />);
  expect(screen.getByRole('combobox', { name: 'Thiết bị' })).toHaveValue('PC1');
  expect(api.create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
  await waitFor(() =>
    expect(api.create).toHaveBeenCalledWith(
      props.attemptId,
      expect.objectContaining({ selectedDeviceId: 'PC1' }),
      expect.anything()
    )
  );
});

test('NEXT_STEP uses the task device, advances levels and cannot escalate an old task on a new device', async () => {
  const focused = {
    ...result,
    focus: {
      taskId: 'as-r2',
      deviceId: 'R2',
      title: 'R2: bật EIGRP AS 1',
      verification: 'Routing process trên R2 dùng AS 1.',
    },
    answer: { ...result.answer, hintLevel: 1, nextSteps: [] },
  };
  api.create.mockResolvedValue(request('COMPLETED', { result: focused }));
  const config = {
    ...props,
    devices: [{ id: 'R1' }, { id: 'R2' }],
    taskId: 'as-r2',
    taskDeviceId: 'R2',
    taskTitle: 'R2: bật EIGRP AS 1',
  };
  const view = render(<AiLabPanel {...config} api={api} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled());
  expect(screen.getByRole('combobox', { name: 'Thiết bị' })).toHaveValue('R2');
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
  const more = await screen.findByRole('button', { name: 'Gợi ý rõ hơn (mức 2)' });
  expect(api.create.mock.calls[0][1]).toMatchObject({
    taskId: 'as-r2',
    selectedDeviceId: 'R2',
    requestedHintLevel: 1,
  });
  fireEvent.click(more);
  await waitFor(() => expect(api.create).toHaveBeenCalledTimes(2));
  expect(api.create.mock.calls[1][1]).toMatchObject({
    taskId: 'as-r2',
    selectedDeviceId: 'R2',
    requestedHintLevel: 2,
  });
  view.rerender(
    <AiLabPanel
      {...config}
      taskId="as-r1"
      taskDeviceId="R1"
      taskTitle="R1: bật EIGRP AS 1"
      api={api}
    />
  );
  expect(screen.queryByRole('button', { name: 'Gợi ý rõ hơn (mức 2)' })).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Thiết bị' })).toHaveValue('R1');
  expect(screen.getByRole('combobox', { name: 'Mức gợi ý' })).toHaveValue('1');
});

test.each([false, true])(
  'command actions distinguish a complete command from a syntax template (%s)',
  async (template) => {
    const command = {
      commandId: 'cmd_test',
      deviceId: 'R2',
      mode: 'GLOBAL_CONFIG',
      command: template ? 'router eigrp <AS>' : 'router eigrp 1',
      ...(template ? { template: true } : {}),
    };
    const focused = {
      ...result,
      focus: {
        taskId: 'as-r2',
        deviceId: 'R2',
        title: 'R2: bật EIGRP AS 1',
        verification: 'R2 dùng AS 1.',
      },
      commands: [command],
      answer: {
        ...result.answer,
        hintLevel: template ? 2 : 3,
        nextSteps: template
          ? [{ text: 'Tạo routing process trên R2.', commandId: command.commandId }]
          : [],
      },
    };
    api.create.mockResolvedValue(request('COMPLETED', { result: focused }));
    render(<AiLabPanel {...props} taskId="as-r2" taskDeviceId="R2" api={api} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));
    await screen.findByText(command.command);
    expect(screen.queryByRole('button', { name: /Đưa vào terminal/ })).not.toBeInTheDocument();
    expect(Boolean(screen.queryByRole('button', { name: 'Sao chép' }))).toBe(!template);
  }
);
