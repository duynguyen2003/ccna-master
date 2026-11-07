import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import useAiLabAssistant from '../hooks/useAiLabAssistant.js';
import AiMessage from './AiMessage.jsx';
import AiIcon from './AiIcon.jsx';
import usePanelWidth from '../hooks/usePanelWidth.js';
import useMobile from '../hooks/useMobile.js';
import { AssistantClock } from './AssistantLoader.jsx';
import '../styles/AiLab.css';

const intents = [
  ['NEXT_STEP', 'Gợi ý bước tiếp theo', 'Gợi ý', 'next'],
  ['DIAGNOSE', 'Phân tích kết nối', 'Kết nối', 'diagnose'],
  ['EXPLAIN_CONCEPT', 'Giải thích khái niệm', 'Giải thích', 'concept'],
];
const errors = {
  AI_INVALID_REQUEST: 'Kiểm tra lại câu hỏi, thiết bị và mức gợi ý trước khi gửi.',
  AI_STALE_CONTEXT: 'Cấu hình đã thay đổi. Kiểm tra lựa chọn rồi gửi lại.',
  AI_CONVERSATION_CHANGED: 'Phiên trợ lý đã thay đổi. Hãy mở lại trợ lý.',
  AI_RECOVERY_RECONFIRM: 'Phiên phục hồi đã thay đổi. Xác nhận bắt đầu câu hỏi mới.',
  AI_IDEMPOTENCY_CONFLICT: 'Mã câu hỏi đã gắn với nội dung khác. Hãy bắt đầu câu hỏi mới.',
  AI_QUOTA_EXHAUSTED: 'Bạn đã dùng hết lượt trợ giúp.',
  AI_USER_RATE_LIMITED: 'Bạn gửi hơi nhanh. Hãy đợi rồi thử lại.',
  AI_CONCURRENT_LIMIT: 'Bạn có một câu hỏi đang được xử lý. Hãy đợi câu hỏi đó hoàn tất.',
  AI_NOT_ELIGIBLE: 'Trợ lý chưa được bật cho tài khoản hoặc bài lab này.',
  AI_DISABLED: 'Trợ lý hiện chưa sẵn sàng. Bạn vẫn có thể thực hành.',
  AI_CAPACITY_EXHAUSTED: 'Trợ lý đang bận. Bạn vẫn có thể thực hành.',
  AI_BUDGET_PAUSED: 'Trợ lý hiện tạm nghỉ. Bạn vẫn có thể thực hành.',
  AI_UNAUTHENTICATED: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.',
  AI_RESOURCE_NOT_FOUND: 'Không còn quyền truy cập hội thoại này. Hãy mở lại phiên lab.',
  AI_REQUEST_NOT_FOUND:
    'Chưa tìm thấy câu hỏi đã gửi. Thử tìm lại hoặc xác nhận bắt đầu câu hỏi mới.',
  AI_INVALID_RESPONSE: 'Phản hồi chưa đúng định dạng. Nội dung chưa được hiển thị.',
};

function AiLabPanelScope({
  baseUrl,
  token,
  userId,
  attemptId,
  revision,
  devices = [],
  selectedDeviceId = '',
  taskId,
  taskDeviceId,
  taskTitle,
  theme = 'dark',
  onClose,
  onSelectDevice,
  onWidthChange,
  onUnauthorized,
  Dialog,
  Select = 'select',
  CopyButton,
  api,
}) {
  const { state, controller } = useAiLabAssistant({
    baseUrl,
    token,
    userId,
    attemptId,
    onUnauthorized,
    api,
  });
  const mobile = useMobile();
  const sizing = usePanelWidth(mobile, onWidthChange);
  const titleId = useId();
  const [intent, setIntent] = useState('NEXT_STEP');
  const [message, setMessage] = useState('');
  const defaultSource = selectedDeviceId || devices[0]?.id || '';
  const deviceIds = devices.map((d) => d.id).join(',');
  const [source, setSource] = useState(defaultSource);
  const [target, setTarget] = useState('');
  const [level, setLevel] = useState(1);
  useEffect(() => {
    setLevel(1);
  }, [taskId, taskDeviceId]);
  const [validation, setValidation] = useState('');
  const [newMessages, setNewMessages] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const keepConversation = useRef(null);
  useEffect(() => {
    if (resetConfirm) keepConversation.current?.focus();
  }, [resetConfirm]);
  const question = useRef(null);
  useEffect(() => {
    if (state.request?.requestId) setMessage('');
  }, [state.request?.requestId]);
  const list = useRef(null);
  const panel = useRef(null);
  const stick = useRef(true);
  const anchor = useRef(null);
  const rootClass = `cli-lab-theme ai-lab-root cli-lab-stitch cli-lab-stitch--${theme}${mobile ? ' ai-lab-root--modal' : ''}`;
  const blocked = state.phase === 'blocked';
  const serviceBlocked = ['AI_DISABLED', 'AI_BUDGET_PAUSED', 'AI_CAPACITY_EXHAUSTED'].includes(
    state.error?.code
  );
  const quotaBlocked = state.quota?.remaining === 0 || state.error?.code === 'AI_QUOTA_EXHAUSTED';
  const canAsk =
    state.online &&
    state.capabilities?.eligible &&
    !state.pending &&
    !state.resetting &&
    !blocked &&
    !['AI_DISABLED', 'AI_BUDGET_PAUSED', 'AI_CAPACITY_EXHAUSTED'].includes(state.error?.code) &&
    !quotaBlocked &&
    state.phase !== 'loading';
  useEffect(() => {
    const trigger = document.activeElement;
    if (!mobile) panel.current?.querySelector('.ai-lab-close')?.focus();
    return () => {
      if (!mobile && trigger?.isConnected) trigger.focus();
    };
  }, [mobile]);
  useEffect(() => {
    setSource(defaultSource);
  }, [defaultSource, deviceIds]);
  useEffect(() => {
    if (target === source) setTarget('');
  }, [source, target]);
  useLayoutEffect(() => {
    const node = list.current;
    if (!node) return;
    if (anchor.current && state.loadingOlder) return;
    if (anchor.current) {
      node.scrollTop = anchor.current.top + node.scrollHeight - anchor.current.height;
      anchor.current = null;
    } else if (stick.current) node.scrollTop = node.scrollHeight;
    else setNewMessages(true);
  }, [
    state.messages,
    state.request?.result?.messageId,
    state.loadingOlder,
    state.optimisticQuestion,
    state.pending,
    state.request?.status,
  ]);
  const entries = [...state.messages];
  if (
    state.optimisticQuestion &&
    !entries.some(
      (item) => item.role === 'USER' && item.requestId === state.optimisticQuestion.requestId
    )
  )
    entries.push(state.optimisticQuestion);
  const request = state.request;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (state.pending) controller.markFeedbackVisible?.();
      if (request?.result) controller.markResultVisible?.(request.result.messageId);
    });
    return () => cancelAnimationFrame(frame);
  }, [controller, state.pending, request?.result]);
  useLayoutEffect(() => {
    const input = question.current;
    if (!input) return;
    const resize = () => {
      input.style.height = 'auto';
      input.style.height = `${Math.min(100, Math.max(24, input.scrollHeight))}px`;
    };
    resize();
    if (typeof ResizeObserver === 'undefined') return;
    let width = input.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const next = input.getBoundingClientRect().width;
      if (next !== width) {
        width = next;
        resize();
      }
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [message, intent, state.pending, mobile]);
  useEffect(() => {
    const node = list.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    let height = node.scrollHeight;
    const observer = new ResizeObserver(() => {
      if (anchor.current) return;
      const next = node.scrollHeight;
      if (stick.current) node.scrollTop = next;
      else if (next > height) setNewMessages(true);
      height = next;
    });
    observer.observe(node);
    for (const child of node.children) observer.observe(child);
    return () => observer.disconnect();
  }, [state.messages, state.request?.result?.messageId, state.pending]);
  const progress = request?.progress;
  const progressText = {
    QUEUED: 'Đã nhận câu hỏi. Đang chờ phân tích…',
    RUNNING: 'Đang xử lý câu hỏi…',
    PREPARING_CONTEXT: progress?.deviceId
      ? `Đang chuẩn bị ngữ cảnh cho ${progress.deviceId}…`
      : 'Đang chuẩn bị ngữ cảnh…',
    ANALYZING: progress?.deviceId
      ? `Đang phân tích nhiệm vụ trên ${progress.deviceId}…`
      : 'Đang phân tích câu hỏi…',
    FINALIZING: 'Đang hoàn tất kết quả…',
  }[progress?.phase];
  if (request?.result && !entries.some((item) => item.messageId === request.result.messageId))
    entries.push({
      role: 'ASSISTANT',
      messageId: request.result.messageId,
      result: request.result,
      responseMode: request.responseMode,
      sourceRevision: request.sourceRevision,
    });
  const send = (event) => {
    event.preventDefault();
    if (!canAsk) return;
    const input = { intent };
    if (message.trim()) input.message = message;
    if (intent === 'EXPLAIN_CONCEPT' && !message.trim()) {
      setValidation('Nhập khái niệm hoặc câu hỏi cần giải thích.');
      return;
    }
    if (intent === 'DIAGNOSE') {
      if (!source || !target) {
        setValidation('Chọn thiết bị nguồn và thiết bị đích.');
        return;
      }
      input.selectedDeviceId = source;
      input.target = { deviceId: target };
    } else if (intent === 'NEXT_STEP' && taskDeviceId) input.selectedDeviceId = taskDeviceId;
    else if (source) input.selectedDeviceId = source;
    if (intent !== 'EXPLAIN_CONCEPT') {
      input.requestedHintLevel = level;
      if (intent === 'NEXT_STEP' && taskId) input.taskId = taskId;
    }
    setValidation('');
    stick.current = true;
    void controller.send(input, revision);
  };
  const statusText =
    state.phase === 'loading'
      ? 'Đang tải trợ lý…'
      : !state.online
        ? 'Mất kết nối. Câu hỏi đang soạn được giữ trong tab này.'
        : state.phase === 'sending'
          ? 'Đang gửi câu hỏi…'
          : state.pending && !state.error
            ? progressText ||
              (request?.status === 'RUNNING'
                ? 'Đang phân tích. Bạn vẫn có thể dùng terminal.'
                : 'Đã nhận câu hỏi. Đang chờ phân tích…')
            : request?.status === 'CANCELLED'
              ? 'Đã hủy yêu cầu.'
              : request && ['FAILED', 'EXPIRED'].includes(request.status)
                ? 'Không thể hoàn tất câu hỏi này.'
                : request?.status === 'OUTCOME_UNKNOWN'
                  ? 'Chưa xác định được kết quả. Hệ thống sẽ không tự gửi lại câu hỏi.'
                  : entries.at(-1)?.role === 'USER' && !request
                    ? 'Chưa có phản hồi cho câu hỏi gần nhất. Bạn có thể gửi câu hỏi mới.'
                    : '';
  const statusMoving =
    state.phase === 'sending' || Boolean(state.pending && !state.error && state.online);

  const content = (
    <aside
      className={rootClass}
      data-theme={theme}
      data-ai-panel="true"
      style={mobile ? undefined : { '--ai-lab-panel-width': `${sizing.width}px` }}
      aria-labelledby={titleId}
      ref={panel}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      {!mobile && <div className="ai-lab-resize" {...sizing.separator} />}
      <header className="ai-lab-header">
        <div className="ai-lab-heading">
          <span className="ai-lab-avatar">
            <AiIcon name="assistant" size={22} />
          </span>
          <h2 id={titleId}>Trợ lý AI</h2>
        </div>
        <div className="ai-lab-info">
          <details className="ai-lab-tools">
            <summary>Tùy chọn</summary>
            <div>
              <details
                open={privacyOpen}
                onToggle={(event) => setPrivacyOpen(event.currentTarget.open)}
              >
                <summary>AI đang xem gì</summary>
                <p>
                  Câu hỏi và cấu hình lab đã lọc được gửi tới dịch vụ AI. Hội thoại riêng của bạn.
                  Trợ lý không tự chạy lệnh; hãy đối chiếu câu trả lời trong terminal.
                </p>
              </details>

              {!mobile && (
                <div className="ai-lab-width-controls" aria-label="Điều chỉnh chiều rộng">
                  <button type="button" onClick={() => sizing.change(sizing.width - 40)}>
                    Thu hẹp
                  </button>
                  <button type="button" onClick={() => sizing.change(sizing.width + 40)}>
                    Mở rộng
                  </button>
                  <button type="button" onClick={() => sizing.change(440)}>
                    Mặc định
                  </button>
                </div>
              )}
              <button
                type="button"
                disabled={!state.capabilities?.conversationId || !state.online || state.resetting}
                onClick={(event) => {
                  const menu = event.currentTarget.closest('.ai-lab-tools');
                  if (menu) menu.open = false;
                  setResetConfirm(true);
                }}
              >
                Đặt lại hội thoại
              </button>
            </div>
          </details>
        </div>
        {!mobile && (
          <button
            type="button"
            className="ai-lab-close"
            aria-label="Đóng trợ lý AI"
            onClick={onClose}
          >
            <AiIcon name="close" size={20} />
          </button>
        )}
      </header>
      {resetConfirm && (
        <div className="ai-lab-reset-confirm" role="group" aria-label="Xác nhận đặt lại hội thoại">
          <p>
            Xóa câu hỏi và câu trả lời trong hội thoại này? Câu hỏi đang xử lý sẽ dừng hiển thị kết
            quả.
          </p>
          <button
            type="button"
            disabled={state.resetting}
            aria-busy={Boolean(state.resetting)}
            onClick={async () => {
              if (await controller.resetConversation()) {
                setResetConfirm(false);
                requestAnimationFrame(() => question.current?.focus());
              }
            }}
          >
            Xóa và bắt đầu lại
          </button>
          <button
            ref={keepConversation}
            type="button"
            disabled={state.resetting}
            onClick={() => {
              setResetConfirm(false);
              panel.current?.querySelector('.ai-lab-tools > summary')?.focus();
            }}
          >
            Giữ hội thoại
          </button>
        </div>
      )}
      <div
        className="ai-lab-history"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={Boolean(state.pending) || state.loadingOlder || state.phase === 'loading'}
        tabIndex={0}
        aria-label="Lịch sử trợ lý AI"
        ref={list}
        onScroll={() => {
          const node = list.current;
          stick.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
          if (stick.current) setNewMessages(false);
        }}
      >
        {state.nextCursor && (
          <button
            type="button"
            disabled={state.loadingOlder}
            onClick={() => {
              anchor.current = { height: list.current.scrollHeight, top: list.current.scrollTop };
              void controller.loadOlder();
            }}
          >
            Câu hỏi trước
          </button>
        )}
        {state.phase === 'loading' && <AssistantClock />}
        {state.historyError && (
          <p role="alert">
            Chưa tải được lịch sử.{' '}
            <button
              type="button"
              onClick={() => {
                void controller.reloadHistory();
              }}
            >
              Tải lại lịch sử
            </button>
          </p>
        )}
        {!entries.length && state.phase !== 'loading' && !blocked && !state.pending && (
          <div className="ai-lab-empty">
            <h3>Bạn đang vướng ở đâu?</h3>
            <p>Hỏi về bước đang làm hoặc kết nối giữa các thiết bị.</p>
            <div className="ai-lab-suggestions">
              {intents
                .filter(([id]) => state.capabilities?.intents.includes(id))
                .map(([id, label, , icon]) => (
                  <button
                    type="button"
                    key={id}
                    aria-label={`Bắt đầu: ${label}`}
                    disabled={!canAsk}
                    onClick={() => {
                      setIntent(id);
                      setValidation('');
                      question.current?.focus();
                    }}
                  >
                    <AiIcon name={icon} />
                    <span>{label}</span>
                    <AiIcon name="next" size={16} />
                  </button>
                ))}
            </div>
          </div>
        )}
        {entries.map((entry) => (
          <AiMessage
            CopyButton={CopyButton}
            Select={Select}
            key={entry.messageId}
            message={entry}
            currentRevision={Math.max(revision, request?.currentRevision ?? revision)}
            feedback={state.feedback[entry.result?.messageId]}
            onFeedback={(input) => {
              void controller.feedback(entry.result.messageId, input);
            }}
            onSelectDevice={onSelectDevice}
            canMoreHint={Boolean(
              entry.result?.focus &&
              entry.result.focus.taskId === taskId &&
              entry.result.focus.deviceId === (taskDeviceId || source) &&
              entry.sourceRevision === revision
            )}
            onRecheck={() => {
              void controller.send(
                {
                  intent: 'NEXT_STEP',
                  requestedHintLevel: level,
                  ...(taskDeviceId || source ? { selectedDeviceId: taskDeviceId || source } : {}),
                  ...(taskId ? { taskId } : {}),
                },
                revision
              );
            }}
            onMoreHint={() => {
              const next = Math.min(3, entry.result.answer.hintLevel + 1);
              setLevel(next);
              void controller.send(
                {
                  intent: 'NEXT_STEP',
                  requestedHintLevel: next,
                  ...(entry.result.focus?.deviceId
                    ? { selectedDeviceId: entry.result.focus.deviceId }
                    : {}),
                  ...(entry.result.focus?.taskId ? { taskId: entry.result.focus.taskId } : {}),
                },
                revision
              );
            }}
            onAddContext={() => {
              setIntent('DIAGNOSE');
              question.current?.focus();
            }}
            canAsk={canAsk}
          />
        ))}
        <div
          className={
            state.phase === 'loading'
              ? 'ai-assistant-loading-status'
              : `ai-lab-status${statusMoving ? ' ai-lab-status--working' : ''}`
          }
          role="status"
          aria-live="polite"
        >
          {statusText && (
            <span
              key={progress?.phase || state.phase}
              className={statusMoving ? 't-shimmer' : undefined}
              data-text={statusMoving ? statusText : undefined}
            >
              {statusText}
            </span>
          )}
        </div>
      </div>
      {newMessages && (
        <button
          type="button"
          className="ai-lab-new"
          onClick={() => {
            stick.current = true;
            setNewMessages(false);
            list.current.scrollTop = list.current.scrollHeight;
          }}
        >
          Tin mới ↓
        </button>
      )}
      {state.error && (
        <div className="ai-lab-error" role="alert">
          <p>
            {state.pending &&
            state.phase === 'uncertain' &&
            ['AI_NETWORK_ERROR', 'AI_HTTP_ERROR'].includes(state.error.code)
              ? 'Chưa xác nhận được câu hỏi. Đang tìm yêu cầu đã gửi.'
              : errors[state.error.code] || 'Chưa kết nối được trợ lý. Hãy thử lại.'}
          </p>
          {!blocked && state.online && (
            <button
              type="button"
              className="ai-lab-icon-button"
              aria-label="Thử lại"
              title="Thử lại"
              onClick={() => {
                void controller.retry();
              }}
            >
              <AiIcon name="replay" />
            </button>
          )}
          {state.pending &&
            ['AI_RECOVERY_RECONFIRM', 'AI_IDEMPOTENCY_CONFLICT', 'AI_REQUEST_NOT_FOUND'].includes(
              state.error.code
            ) && (
              <button
                type="button"
                onClick={() => {
                  void controller.newQuestion();
                }}
              >
                Xác nhận câu hỏi mới
              </button>
            )}
        </div>
      )}
      {quotaBlocked && (
        <p className="ai-lab-muted">
          Hết lượt trợ giúp. Đặt lại lúc{' '}
          {new Date(state.error?.resetAt || state.quota.resetAt).toLocaleString('vi-VN')}.
        </p>
      )}
      {blocked && !state.error && (
        <p className="ai-lab-muted">Trợ lý chưa được bật cho phiên này.</p>
      )}
      {!blocked && (!serviceBlocked || state.pending) && (
        <form
          className={`ai-lab-composer${intent === 'DIAGNOSE' ? ' ai-lab-composer--diagnose' : ''}`}
          onSubmit={send}
          aria-label="Gửi câu hỏi cho trợ lý"
        >
          <fieldset disabled={!canAsk}>
            <legend className="ai-lab-sr-only">Cách trợ giúp</legend>
            {intent === 'NEXT_STEP' && taskTitle && (
              <p id={`${titleId}-task`} className="ai-lab-sr-only">
                {taskTitle}
              </p>
            )}
            <div className="ai-lab-composer-surface">
              <label className="ai-lab-prompt">
                <span className="ai-lab-sr-only">
                  {intent === 'EXPLAIN_CONCEPT' ? 'Khái niệm cần giải thích' : 'Câu hỏi của bạn'}
                </span>
                <textarea
                  ref={question}
                  value={message}
                  maxLength={2000}
                  rows={1}
                  placeholder={
                    intent === 'EXPLAIN_CONCEPT'
                      ? 'Ví dụ: Khi nào cần dùng default gateway?'
                      : intent === 'DIAGNOSE'
                        ? 'Ví dụ: Vì sao PC1 chưa ping được R1?'
                        : 'Mô tả chỗ bạn đang gặp khó…'
                  }
                  aria-invalid={Boolean(validation)}
                  aria-describedby={
                    [
                      intent === 'NEXT_STEP' && taskTitle ? `${titleId}-task` : null,
                      validation ? `${titleId}-validation` : null,
                    ]
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                  onChange={(event) => {
                    setMessage(event.target.value);
                    setValidation('');
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing &&
                      event.keyCode !== 229
                    ) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
              </label>
              <div className="ai-lab-composer-controls">
                {devices.length > 0 && (
                  <label className="ai-lab-composer-choice ai-lab-composer-choice--device">
                    <span className="ai-lab-sr-only">Thiết bị</span>
                    <span className="ai-lab-composer-choice__icon">
                      <AiIcon name="device" size={15} />
                    </span>
                    <Select
                      disabled={!canAsk}
                      aria-label="Thiết bị"
                      title={intent === 'NEXT_STEP' && taskTitle ? taskTitle : undefined}
                      {...(typeof Select === 'string'
                        ? {}
                        : {
                            displayLabel:
                              (intent === 'NEXT_STEP' ? taskDeviceId || source : source) || 'Lab',
                          })}
                      value={intent === 'NEXT_STEP' ? taskDeviceId || source : source}
                      onChange={(event) => {
                        setSource(event.target.value);
                        setValidation('');
                        if (intent === 'NEXT_STEP' && event.target.value)
                          onSelectDevice?.(event.target.value);
                      }}
                    >
                      <option value="">Toàn bộ lab</option>
                      {devices.map((device) => (
                        <option key={device.id} value={device.id}>
                          {device.name || device.id}
                        </option>
                      ))}
                    </Select>
                  </label>
                )}
                <label className="ai-lab-composer-choice ai-lab-composer-choice--intent">
                  <span className="ai-lab-sr-only">Cách trợ giúp</span>
                  <span className="ai-lab-composer-choice__icon">
                    <AiIcon name={intents.find(([id]) => id === intent)?.[3]} size={15} />
                  </span>
                  <Select
                    disabled={!canAsk}
                    aria-label="Cách trợ giúp"
                    {...(typeof Select === 'string'
                      ? {}
                      : {
                          displayLabel: intents.find(([id]) => id === intent)?.[2],
                        })}
                    value={intent}
                    onChange={(event) => {
                      setIntent(event.target.value);
                      setValidation('');
                    }}
                  >
                    {intents
                      .filter(
                        ([id]) => !state.capabilities || state.capabilities.intents.includes(id)
                      )
                      .map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                  </Select>
                </label>
              </div>
            </div>
            {intent === 'DIAGNOSE' && (
              <div className="ai-lab-device-fields">
                <label>
                  Thiết bị đích
                  <Select
                    disabled={!canAsk}
                    aria-label="Thiết bị đích"
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                  >
                    <option value="">Chọn đích</option>
                    {devices
                      .filter((device) => device.id !== source)
                      .map((device) => (
                        <option key={device.id} value={device.id}>
                          {device.name || device.id}
                        </option>
                      ))}
                  </Select>
                </label>
              </div>
            )}
            <div className="ai-lab-hint-budget">
              {intent !== 'EXPLAIN_CONCEPT' && (
                <label className="ai-lab-hint-level">
                  <span className="ai-lab-sr-only">Mức gợi ý</span>
                  <Select
                    disabled={!canAsk}
                    aria-label="Mức gợi ý"
                    {...(typeof Select === 'string'
                      ? {}
                      : { displayLabel: `Mức gợi ý ${level}/3` })}
                    value={level}
                    onChange={(event) => setLevel(Number(event.target.value))}
                  >
                    <option value={1}>1 · Định hướng</option>
                    <option value={2}>
                      {intent === 'NEXT_STEP' ? '2 · Cú pháp lệnh' : '2 · Kiểm tra cụ thể'}
                    </option>
                    <option value={3}>
                      {intent === 'NEXT_STEP' ? '3 · Lệnh đầy đủ' : '3 · Chi tiết hơn'}
                    </option>
                  </Select>
                </label>
              )}
              {message.length > 1800 && (
                <span className="ai-lab-character-count">{Array.from(message).length}/2000</span>
              )}
              {state.quota && (
                <span className="ai-lab-remaining">Còn {state.quota.remaining} lượt</span>
              )}
            </div>
          </fieldset>
          {validation && (
            <p id={`${titleId}-validation`} className="ai-lab-validation" role="alert">
              {validation}
            </p>
          )}
          <div className="ai-lab-composer__actions">
            {state.pending ? (
              <button
                type="button"
                className="ai-lab-stop"
                aria-label="Hủy yêu cầu"
                title="Hủy yêu cầu"
                aria-busy={state.phase === 'sending'}
                disabled={!state.online}
                onClick={() => {
                  void controller.cancel();
                }}
              >
                <AiIcon name="stop" size={16} />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Gửi câu hỏi"
                className="ai-lab-send"
                disabled={!canAsk}
                aria-busy={Boolean(state.pending)}
              >
                <AiIcon name="send" size={20} />
              </button>
            )}
          </div>
        </form>
      )}
    </aside>
  );
  return mobile && Dialog ? (
    <Dialog
      title="Trợ lý AI"
      className={`ai-lab-dialog cli-lab-editor cli-lab-stitch cli-lab-stitch--${theme}${theme === 'dark' ? ' is-dark' : ''}`}
      onClose={onClose}
    >
      {content}
    </Dialog>
  ) : (
    content
  );
}

export default function AiLabPanel(props) {
  return <AiLabPanelScope key={`${props.token}:${props.userId}:${props.attemptId}`} {...props} />;
}
