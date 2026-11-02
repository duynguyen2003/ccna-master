import React, { useState } from 'react';
import AiIcon from './AiIcon.jsx';
import useClipboard, { COPY_ERROR } from '../hooks/useClipboard.js';

const claims = {
  SUPPORTED_FINDING: 'Có căn cứ',
  HYPOTHESIS: 'Gợi ý tham khảo',
  NO_ISSUE_OBSERVED: 'Chưa thấy lỗi trong phép kiểm tra',
  INSUFFICIENT_CONTEXT: 'Thiếu dữ liệu',
  UNSUPPORTED: 'Chưa hỗ trợ',
};
const intentLabels = {
  NEXT_STEP: 'Gợi ý bước tiếp theo',
  DIAGNOSE: 'Phân tích kết nối',
  EXPLAIN_CONCEPT: 'Giải thích khái niệm',
  LAB_REVIEW: 'Giải thích kết quả chấm',
};
const modeLabels = {
  USER_EXEC: 'EXEC',
  PRIVILEGED_EXEC: 'EXEC đặc quyền',
  GLOBAL_CONFIG: 'Cấu hình chung',
  INTERFACE_CONFIG: 'Cấu hình cổng',
  ROUTER_CONFIG: 'Cấu hình định tuyến',
};
const reasons = [
  ['TOO_VAGUE', 'Chưa rõ cách làm'],
  ['WRONG_FACT', 'Thông tin chưa đúng'],
  ['WRONG_DEVICE', 'Nhầm thiết bị'],
  ['UNSUPPORTED_COMMAND', 'Lệnh chưa hỗ trợ'],
  ['TOO_MUCH_SOLUTION', 'Lộ quá nhiều lời giải'],
  ['STALE', 'Cấu hình đã cũ'],
  ['SLOW', 'Phản hồi chậm'],
  ['OTHER', 'Lý do khác'],
];

// Standalone consumers may supply their own renderer, like Select/Dialog.
// The application supplies its shared Lucide/Motion button.
function NativeCopyButton({ value, label = 'Sao chép', onError, onCopied }) {
  const { state, copy, status } = useClipboard(value, onError, onCopied);
  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={state === 'pending'}
      onClick={copy}
      data-state={state}
      style={{ width: 32, height: 32, minWidth: 32, padding: 0 }}
    >
      <span aria-hidden="true" style={{ color: state === 'copied' ? '#4ade80' : undefined }}>
        <AiIcon name={state === 'copied' ? 'check' : 'copy'} size={16} />
      </span>
      <span role="status" className="ai-lab-sr-only">
        {status}
      </span>
    </button>
  );
}

function Command({ command, CopyButton }) {
  const [status, setStatus] = useState('');
  return (
    <div className="ai-lab-command">
      <div>
        <span>
          <span className="ai-lab-device-chip">{command.deviceId}</span> ·{' '}
          {modeLabels[command.mode] || 'Cisco IOS'}
          {command.interface ? ` · ${command.interface}` : ''}
        </span>
        {!command.template && (
          <CopyButton
            value={command.command}
            label="Sao chép"
            tone="inverse"
            onError={setStatus}
            onCopied={() => setStatus((current) => (current === COPY_ERROR ? '' : current))}
          />
        )}
      </div>
      <pre tabIndex={0}>
        <code>{command.command}</code>
      </pre>
      {command.template && (
        <p className="ai-lab-muted">
          {command.command.includes('<')
            ? 'Cú pháp: tự điền các phần trong dấu < >.'
            : 'Cú pháp lệnh quan sát.'}
        </p>
      )}
      <span role="status">{status}</span>
    </div>
  );
}

export default function AiMessage({
  CopyButton = NativeCopyButton,
  Select = 'select',
  message,
  currentRevision,
  feedback,
  onFeedback,
  onSelectDevice,
  onRecheck,
  canAsk,
  onMoreHint,
  onAddContext,
  canMoreHint,
}) {
  const [negative, setNegative] = useState(false);
  const [reason, setReason] = useState('TOO_VAGUE');
  if (message.role === 'USER')
    return (
      <article
        className={`ai-lab-message ai-lab-message--user${intentLabels[message.content] ? ' ai-lab-message--quick' : ''}`}
        aria-label="Câu hỏi của bạn"
      >
        <p>{intentLabels[message.content] || message.content}</p>
      </article>
    );
  const { result, responseMode, sourceRevision } = message;
  const stale = sourceRevision != null && sourceRevision !== currentRevision;
  return (
    <article
      className="ai-lab-message"
      data-response-state="complete"
      aria-label={responseMode === 'LLM' ? 'Trả lời từ AI' : 'Gợi ý từ hệ thống'}
    >
      <div className="ai-lab-message__meta">
        <span className="ai-lab-avatar">
          <AiIcon name="assistant" size={17} />
        </span>
        <strong>{responseMode === 'LLM' ? 'Trợ lý AI' : 'Gợi ý từ hệ thống'}</strong>
        <span>{claims[result.answer.claimType]}</span>
      </div>
      {result.focus && (
        <p className="ai-lab-answer-focus">
          <span className="ai-lab-device-chip">{result.focus.deviceId}</span>
          {result.focus.title}
        </p>
      )}
      {stale && (
        <div className="ai-lab-stale">
          <span>Dựa trên cấu hình trước đó. Lab đã thay đổi từ lúc bạn hỏi.</span>
          <button type="button" disabled={!canAsk} onClick={onRecheck}>
            Kiểm tra lại
          </button>
        </div>
      )}
      {sourceRevision === null && (
        <p className="ai-lab-muted">Kết quả cũ chưa có thông tin phiên bản cấu hình.</p>
      )}
      <p className="ai-lab-prose">{result.answer.summary}</p>
      {!result.focus &&
        ['INSUFFICIENT_CONTEXT', 'UNSUPPORTED'].includes(result.answer.claimType) && (
          <div className="ai-lab-context-help">
            <p>
              {result.answer.claimType === 'UNSUPPORTED'
                ? 'Phép kiểm tra này chưa được hỗ trợ. Bạn có thể chọn hai thiết bị để kiểm tra kết nối.'
                : 'Chọn thiết bị nguồn, thiết bị đích và mô tả kết quả bạn mong đợi để bổ sung ngữ cảnh.'}
            </p>
            <button type="button" disabled={!canAsk} onClick={onAddContext}>
              Bổ sung thông tin
            </button>
          </div>
        )}
      {result.evidence.length > 0 && (
        <details className="ai-lab-evidence">
          <summary>
            Dựa trên: {result.evidence[0].deviceId ? `${result.evidence[0].deviceId} · ` : ''}
            {result.evidence[0].observation}
            {result.evidence.length > 1 && (
              <span className="ai-lab-source-count">{result.evidence.length} nguồn</span>
            )}
          </summary>
          <ul>
            {result.evidence.map((entry) => (
              <li key={entry.evidenceId}>
                {entry.deviceId && (
                  <button type="button" onClick={() => onSelectDevice?.(entry.deviceId)}>
                    Chọn {entry.deviceId}
                  </button>
                )}
                <span>
                  {entry.interface ? `${entry.interface} · ` : ''}
                  {entry.observation}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {result.answer.nextSteps.length > 0 && (
        <>
          <p className="ai-lab-steps-title">
            <strong>Bước tiếp theo</strong>
          </p>
          <ol className="ai-lab-steps">
            {result.answer.nextSteps.map((step, i) => (
              <li key={i}>
                <p>{step.text}</p>
                {step.commandId && (
                  <Command
                    CopyButton={CopyButton}
                    command={result.commands.find((item) => item.commandId === step.commandId)}
                  />
                )}
              </li>
            ))}
          </ol>
        </>
      )}
      {result.focus &&
        result.commands
          .filter(
            (command) =>
              !result.answer.nextSteps.some((step) => step.commandId === command.commandId)
          )
          .map((command) => (
            <Command CopyButton={CopyButton} key={command.commandId} command={command} />
          ))}
      <div className="ai-lab-verification">
        <strong>Kiểm tra lại</strong>
        <p>{result.focus?.verification || result.answer.verification}</p>
      </div>
      <p className="ai-lab-muted">
        Mức gợi ý {result.answer.hintLevel}/3
        {responseMode === 'LLM'
          ? ' · AI có thể sai; hãy đối chiếu với terminal và kết quả chấm.'
          : ''}
      </p>
      <div className="ai-lab-feedback" aria-label="Đánh giá câu trả lời">
        {result.answer.hintLevel < 3 && canMoreHint && !stale && (
          <button type="button" disabled={!canAsk} onClick={onMoreHint}>
            Gợi ý rõ hơn (mức {result.answer.hintLevel + 1})
          </button>
        )}
        <button
          type="button"
          className="ai-lab-icon-button"
          aria-label="Hữu ích"
          title="Hữu ích"
          disabled={feedback?.pending}
          aria-pressed={Boolean(feedback?.saved && feedback.helpful === true)}
          onClick={() => {
            setNegative(false);
            onFeedback({ helpful: true, reasonCode: null });
          }}
        >
          <AiIcon name="like" />
        </button>
        <button
          type="button"
          className="ai-lab-icon-button"
          aria-label="Chưa hữu ích"
          title="Chưa hữu ích"
          disabled={feedback?.pending}
          aria-pressed={negative || (feedback?.saved && feedback.helpful === false)}
          onClick={() => setNegative((value) => !value)}
        >
          <AiIcon name="dislike" />
        </button>
        {negative && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onFeedback({ helpful: false, reasonCode: reason });
            }}
          >
            <label>
              Lý do
              <Select
                aria-label="Lý do đánh giá"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={feedback?.pending}
              >
                {reasons.map(([id, label]) => (
                  <option value={id} key={id}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <button type="submit" disabled={feedback?.pending}>
              Gửi đánh giá
            </button>
          </form>
        )}
        <span role="status">
          {feedback?.pending
            ? 'Đang lưu…'
            : feedback?.saved
              ? 'Đã lưu đánh giá.'
              : feedback?.error
                ? 'Chưa lưu được. Bạn có thể thử lại.'
                : ''}
        </span>
      </div>
    </article>
  );
}
