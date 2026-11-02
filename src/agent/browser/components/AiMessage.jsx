import React, { useState } from 'react';
import AiIcon from './AiIcon.jsx';

const claims = {
  SUPPORTED_FINDING: 'Có căn cứ',
  HYPOTHESIS: 'Giả thuyết',
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

function Command({ command }) {
  const [status, setStatus] = useState('');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command.command);
      setStatus('Đã sao chép');
    } catch {
      setStatus('Không sao chép được. Hãy chọn lệnh để sao chép thủ công.');
    }
  };
  return (
    <div className="ai-lab-command">
      <div>
        <span>
          {command.deviceId} · {modeLabels[command.mode] || 'Cisco IOS'}
        </span>
        <button type="button" onClick={copy}>
          <AiIcon name="copy" size={14} /> Sao chép
        </button>
      </div>
      <pre tabIndex={0}>
        <code>{command.command}</code>
      </pre>
      <span role="status">{status}</span>
    </div>
  );
}

export default function AiMessage({
  message,
  currentRevision,
  feedback,
  onFeedback,
  onSelectDevice,
  onRecheck,
  canAsk,
  onMoreHint,
  onAddContext,
}) {
  const [negative, setNegative] = useState(false);
  const [reason, setReason] = useState('TOO_VAGUE');
  if (message.role === 'USER')
    return (
      <article className="ai-lab-message ai-lab-message--user" aria-label="Câu hỏi của bạn">
        <p>{intentLabels[message.content] || message.content}</p>
      </article>
    );
  const { result, responseMode, sourceRevision } = message;
  const stale = sourceRevision != null && sourceRevision !== currentRevision;
  return (
    <article
      className="ai-lab-message"
      aria-label={responseMode === 'LLM' ? 'Trả lời từ AI' : 'Gợi ý từ hệ thống'}
    >
      <div className="ai-lab-message__meta">
        <span className="ai-lab-avatar">
          <AiIcon name="assistant" size={17} />
        </span>
        <strong>{responseMode === 'LLM' ? 'Trợ lý AI' : 'Gợi ý từ hệ thống'}</strong>
        <span>{claims[result.answer.claimType]}</span>
      </div>
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
      {['INSUFFICIENT_CONTEXT', 'UNSUPPORTED'].includes(result.answer.claimType) && (
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
          <summary>Bằng chứng ({result.evidence.length})</summary>
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
                    command={result.commands.find((item) => item.commandId === step.commandId)}
                  />
                )}
              </li>
            ))}
          </ol>
        </>
      )}
      <div className="ai-lab-verification">
        <strong>Kiểm tra lại</strong>
        <p>{result.answer.verification}</p>
      </div>
      <p className="ai-lab-muted">
        Mức gợi ý {result.answer.hintLevel}/3
        {responseMode === 'LLM'
          ? ' · AI có thể sai; hãy đối chiếu với terminal và kết quả chấm.'
          : ''}
      </p>
      <div className="ai-lab-feedback" aria-label="Đánh giá câu trả lời">
        {result.answer.hintLevel < 3 && (
          <button type="button" disabled={!canAsk} onClick={onMoreHint}>
            Gợi ý chi tiết hơn
          </button>
        )}
        <button
          type="button"
          disabled={feedback?.pending}
          aria-pressed={feedback?.saved && feedback.helpful === true}
          onClick={() => {
            setNegative(false);
            onFeedback({ helpful: true, reasonCode: null });
          }}
        >
          Hữu ích
        </button>
        <button
          type="button"
          disabled={feedback?.pending}
          aria-pressed={negative || (feedback?.saved && feedback.helpful === false)}
          onClick={() => setNegative((value) => !value)}
        >
          Chưa hữu ích
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
              <select value={reason} onChange={(event) => setReason(event.target.value)}>
                {reasons.map(([id, label]) => (
                  <option value={id} key={id}>
                    {label}
                  </option>
                ))}
              </select>
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
