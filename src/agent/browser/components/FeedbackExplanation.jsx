import React, { useEffect, useRef, useState } from 'react';
import '../styles/FeedbackExplanation.css';

function errorMessage(error) {
  if (error.status === 429)
    return error.code === 'AI_QUOTA_EXHAUSTED'
      ? 'Bạn đã hết lượt giải thích. Hãy thử lại sau khi lượt được đặt lại.'
      : 'Bạn gửi quá nhanh. Hãy đợi một lát rồi thử lại.';
  if (error.status === 503) return 'AI tạm thời không khả dụng. Hãy thử lại sau.';
  if (error.status === 401) return 'Phiên đăng nhập đã hết hạn.';
  if (error.status === 403) return 'Trợ lý chưa được bật cho tài khoản hoặc bài lab này.';
  return 'Không kết nối được AI. Kiểm tra mạng rồi thử lại.';
}

function ExplanationScope({ load, disabled, quota }) {
  const [result, setResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(true);
  const pending = useRef(false);
  const active = useRef(true);
  const abort = useRef(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      abort.current?.abort();
    };
  }, []);
  const ask = async () => {
    if (result) {
      setOpen((value) => !value);
      return;
    }
    if (disabled || pending.current) return;
    pending.current = true;
    abort.current = new AbortController();
    setAiLoading(true);
    setError(null);
    try {
      const answer = await load(abort.current.signal);
      if (!active.current) return;
      if (answer.provider !== 'gemini' || !answer.explanation?.trim())
        throw Object.assign(new Error('AI_INVALID_RESPONSE'), { status: 503 });
      setResult(answer);
      setOpen(true);
    } catch (cause) {
      if (active.current) setError(cause);
    } finally {
      pending.current = false;
      if (active.current) setAiLoading(false);
    }
  };
  const remaining = result?.quota || quota;
  return (
    <div className="ai-feedback-explanation">
      <button
        type="button"
        disabled={disabled || aiLoading || (!result && remaining?.remaining === 0)}
        aria-busy={aiLoading}
        aria-expanded={Boolean(result && open)}
        onClick={ask}
      >
        {aiLoading
          ? 'Đang giải thích…'
          : result
            ? open
              ? 'Ẩn giải thích'
              : 'Xem giải thích'
            : 'Giải thích kết quả'}
      </button>
      {remaining && <p className="ai-feedback-explanation__meta">Còn {remaining.remaining} lượt</p>}
      <div aria-live="polite" aria-atomic="true">
        {error && (
          <p className="ai-feedback-explanation__error" role="alert">
            {errorMessage(error)}
          </p>
        )}
        {result && open && (
          <div className="ai-feedback-explanation__answer">
            <strong>Giải thích từ AI</strong>
            <p>{result.explanation}</p>
            <small>AI có thể sai, hãy đối chiếu với kết quả chấm điểm.</small>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FeedbackExplanation({ scope, ...props }) {
  return <ExplanationScope key={scope} {...props} />;
}
