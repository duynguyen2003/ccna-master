import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import useAiLabAssistant from '../hooks/useAiLabAssistant.js';
import AiMessage from './AiMessage.jsx';
import AiIcon from './AiIcon.jsx';
import usePanelWidth from '../hooks/usePanelWidth.js';
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

function useMobile() {
  const [mobile, setMobile] = useState(
    () => window.matchMedia?.('(max-width: 768px)').matches || false
  );
  useEffect(() => {
    const query = window.matchMedia?.('(max-width: 768px)');
    const update = () => setMobile(query.matches);
    query?.addEventListener?.('change', update);
    return () => query?.removeEventListener?.('change', update);
  }, []);
  return mobile;
}

function AiLabPanelScope({
  baseUrl,
  token,
  userId,
  attemptId,
  revision,
  devices = [],
  selectedDeviceId = '',
  taskId,
  theme = 'dark',
  onClose,
  onSelectDevice,
  onWidthChange,
  onUnauthorized,
  Dialog,
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
  const [source, setSource] = useState(selectedDeviceId);
  const [target, setTarget] = useState('');
  const [level, setLevel] = useState(1);
  const [validation, setValidation] = useState('');
  const [newMessages, setNewMessages] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const question = useRef(null);
  useEffect(() => {
    if (state.request?.requestId) setMessage('');
  }, [state.request?.requestId]);
  const list = useRef(null);
  const panel = useRef(null);
  const stick = useRef(true);
  const anchor = useRef(null);
  const rootClass = `cli-lab-theme ai-lab-root${mobile ? ' ai-lab-root--modal' : ''}`;
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
    if (!mobile) panel.current?.querySelector('button')?.focus();
    return () => {
      if (!mobile && trigger?.isConnected) trigger.focus();
    };
  }, [mobile]);
  useEffect(() => {
    setSource(selectedDeviceId);
  }, [selectedDeviceId]);
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
    } else if (source) input.selectedDeviceId = source;
    if (intent !== 'EXPLAIN_CONCEPT') {
      input.requestedHintLevel = level;
      if (taskId) input.taskId = taskId;
    }
    setValidation('');
    stick.current = true;
    void controller.send(input, revision);
  };
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
        {state.quota && <span className="ai-lab-quota">Còn {state.quota.remaining} lượt</span>}
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
      <div className="ai-lab-info">
        <details open={privacyOpen} onToggle={(event) => setPrivacyOpen(event.currentTarget.open)}>
          <summary>Dữ liệu dùng để trợ giúp</summary>
          <p>
            Câu hỏi và cấu hình lab đã lọc được gửi tới dịch vụ AI. Hội thoại riêng của bạn. Trợ lý
            không tự chạy lệnh; hãy đối chiếu câu trả lời trong terminal.
          </p>
        </details>
        <details className="ai-lab-tools">
          <summary>Tùy chọn hội thoại</summary>
          <div>
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
              onClick={() => setResetConfirm(true)}
            >
              Đặt lại hội thoại
            </button>
          </div>
        </details>
      </div>
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
          <button type="button" disabled={state.resetting} onClick={() => setResetConfirm(false)}>
            Giữ hội thoại
          </button>
        </div>
      )}
      <div
        className="ai-lab-history"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={state.loadingOlder || state.phase === 'loading'}
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
            <span className="ai-lab-empty__icon">
              <AiIcon name="assistant" size={28} />
            </span>
            <h3>Bạn đang vướng ở đâu?</h3>
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
            key={entry.messageId}
            message={entry}
            currentRevision={Math.max(revision, request?.currentRevision ?? revision)}
            feedback={state.feedback[entry.result?.messageId]}
            onFeedback={(input) => {
              void controller.feedback(entry.result.messageId, input);
            }}
            onSelectDevice={onSelectDevice}
            onRecheck={() => {
              void controller.send(
                {
                  intent: 'NEXT_STEP',
                  requestedHintLevel: level,
                  ...(source ? { selectedDeviceId: source } : {}),
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
                  ...(source ? { selectedDeviceId: source } : {}),
                  ...(taskId ? { taskId } : {}),
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
      <div className="ai-lab-status" role="status" aria-live="polite">
        {state.phase === 'loading'
          ? 'Đang tải trợ lý…'
          : !state.online
            ? 'Mất kết nối. Câu hỏi đang soạn được giữ trong tab này.'
            : state.phase === 'sending'
              ? 'Đang gửi câu hỏi…'
              : state.pending && !state.error
                ? request?.status === 'RUNNING'
                  ? 'Đang phân tích. Bạn vẫn có thể dùng terminal.'
                  : 'Đã nhận câu hỏi. Đang chờ phân tích…'
                : request?.status === 'CANCELLED'
                  ? 'Đã hủy yêu cầu.'
                  : request && ['FAILED', 'EXPIRED'].includes(request.status)
                    ? 'Không thể hoàn tất câu hỏi này.'
                    : request?.status === 'OUTCOME_UNKNOWN'
                      ? 'Chưa xác định được kết quả. Hệ thống sẽ không tự gửi lại câu hỏi.'
                      : ''}
      </div>
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
              onClick={() => {
                void controller.retry();
              }}
            >
              Thử lại
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
        <form className="ai-lab-composer" onSubmit={send} aria-label="Gửi câu hỏi cho trợ lý">
          <fieldset disabled={!canAsk}>
            <legend className="ai-lab-sr-only">Cách trợ giúp</legend>
            <div className="ai-lab-intents">
              {intents
                .filter(([id]) => !state.capabilities || state.capabilities.intents.includes(id))
                .map(([id, label, shortLabel, icon]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={intent === id}
                    aria-label={label}
                    onClick={() => {
                      setIntent(id);
                      setValidation('');
                    }}
                  >
                    <AiIcon name={icon} size={16} />
                    {shortLabel}
                  </button>
                ))}
            </div>
            <label>
              {intent === 'EXPLAIN_CONCEPT' ? 'Khái niệm cần giải thích' : 'Câu hỏi của bạn'}
              <textarea
                ref={question}
                value={message}
                maxLength={2000}
                rows={3}
                placeholder={
                  intent === 'EXPLAIN_CONCEPT'
                    ? 'Ví dụ: Khi nào cần dùng default gateway?'
                    : intent === 'DIAGNOSE'
                      ? 'Ví dụ: Vì sao PC1 chưa ping được R1?'
                      : 'Mô tả chỗ bạn đang gặp khó…'
                }
                aria-invalid={Boolean(validation)}
                aria-describedby={validation ? `${titleId}-validation` : undefined}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setValidation('');
                }}
              />
            </label>
            {intent === 'DIAGNOSE' && (
              <div className="ai-lab-device-fields">
                <label>
                  Thiết bị nguồn
                  <select value={source} onChange={(event) => setSource(event.target.value)}>
                    <option value="">Chọn nguồn</option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name || device.id}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Thiết bị đích
                  <select value={target} onChange={(event) => setTarget(event.target.value)}>
                    <option value="">Chọn đích</option>
                    {devices
                      .filter((device) => device.id !== source)
                      .map((device) => (
                        <option key={device.id} value={device.id}>
                          {device.name || device.id}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            )}
            {intent !== 'EXPLAIN_CONCEPT' && (
              <details className="ai-lab-advanced">
                <summary>Thiết bị và mức gợi ý</summary>
                <div className="ai-lab-options">
                  {intent === 'NEXT_STEP' && devices.length > 0 && (
                    <label>
                      Thiết bị
                      <select value={source} onChange={(event) => setSource(event.target.value)}>
                        <option value="">Toàn bộ lab</option>
                        {devices.map((device) => (
                          <option key={device.id} value={device.id}>
                            {device.name || device.id}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="ai-lab-hint-level">
                    Mức gợi ý
                    <select
                      value={level}
                      onChange={(event) => setLevel(Number(event.target.value))}
                    >
                      <option value={1}>1 · Định hướng</option>
                      <option value={2}>2 · Kiểm tra cụ thể</option>
                      <option value={3}>3 · Chi tiết hơn</option>
                    </select>
                  </label>
                </div>
              </details>
            )}
          </fieldset>
          {validation && (
            <p id={`${titleId}-validation`} className="ai-lab-validation" role="alert">
              {validation}
            </p>
          )}
          <div className="ai-lab-composer__actions">
            <span>{Array.from(message).length}/2000</span>
            {state.pending ? (
              <button
                type="button"
                aria-busy={state.phase === 'sending'}
                disabled={!state.online}
                onClick={() => {
                  void controller.cancel();
                }}
              >
                Hủy yêu cầu
              </button>
            ) : (
              <button
                type="submit"
                className="ai-lab-send"
                disabled={!canAsk}
                aria-busy={Boolean(state.pending)}
              >
                Gửi câu hỏi <AiIcon name="send" size={18} />
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
      className={`ai-lab-dialog cli-lab-editor${theme === 'dark' ? ' is-dark' : ''}`}
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
