import { useCallback, useEffect, useRef, useState } from 'react';

export const COPY_RESET_MS = 1400;
export const COPY_ERROR = 'Không thể sao chép. Hãy thử lại hoặc chọn nội dung để chép thủ công.';

// A late permission result must not change a newer click, value or unmounted UI.
export default function useClipboard(value, onError, onCopied) {
  const [feedback, setFeedback] = useState({ state: 'idle', sequence: 0, value });
  const generation = useRef(0);
  const timer = useRef(null);
  const alive = useRef(false);
  const invalidate = useCallback(() => {
    generation.current++;
    clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      invalidate();
    };
  }, [invalidate]);
  useEffect(() => {
    invalidate();
    setFeedback({ state: 'idle', sequence: generation.current, value });
  }, [value, invalidate]);

  const copy = async () => {
    const sequence = ++generation.current;
    clearTimeout(timer.current);
    setFeedback({ state: 'pending', sequence, value });
    try {
      if (!navigator.clipboard?.writeText) throw new Error('CLIPBOARD_UNAVAILABLE');
      await navigator.clipboard.writeText(String(value ?? ''));
    } catch {
      if (!alive.current || sequence !== generation.current) return;
      setFeedback({ state: 'error', sequence, value });
      onError?.(COPY_ERROR);
      return;
    }
    if (!alive.current || sequence !== generation.current) return;
    setFeedback({ state: 'copied', sequence, value });
    timer.current = setTimeout(() => {
      if (alive.current && sequence === generation.current)
        setFeedback({ state: 'idle', sequence, value });
    }, COPY_RESET_MS);
    onCopied?.();
  };
  const state = feedback.value === value ? feedback.state : 'idle';
  return {
    state,
    sequence: feedback.sequence,
    copy,
    status: state === 'copied' ? 'Đã sao chép.' : state === 'error' ? COPY_ERROR : '',
  };
}
