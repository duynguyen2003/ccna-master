import AppIcon from '../../../components/ui/AppIcon';
import Dialog from '../../../components/ui/Dialog';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../styles/ExamFlow.css';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../components/ui/Toast';

import { api } from '../../../services/Api';
import HeartbeatLoader from '../../../components/ui/HeartbeatLoader';

// ─── Timer Hook ────────────────────────────────────────────────
const useTimer = (deadline, clockOffset) => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const timeLeft = deadline
    ? Math.max(0, Math.ceil((new Date(deadline).getTime() - now - clockOffset) / 1000))
    : 0;
  const h = Math.floor(timeLeft / 3600),
    m = Math.floor((timeLeft % 3600) / 60),
    sec = timeLeft % 60;
  return {
    timeLeft,
    isWarning: timeLeft > 0 && timeLeft < 300,
    formatted: deadline ? [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':') : '--:--:--',
  };
};

// ─── Component ────────────────────────────────────────────────
const TakeExamSession = () => {
  const navigate = useNavigate();
  const { examId } = useParams();
  const { isAuthenticated, loading, token, user } = useAuth();
  const { showToast, ToastComponent } = useToast();

  const STORAGE_KEY = `ccna_exam_session_${user?.id}_${examId}`;

  // Khôi phục session từ localStorage
  const getSavedSession = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  };

  const savedSession = getSavedSession();
  const initialQ = savedSession?.currentQ ?? 0;
  const initialAnswers = savedSession?.userAnswers || {};
  const initialFlags = savedSession?.flagged ? new Set(savedSession.flagged) : new Set();

  const [questions, setQuestions] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [currentQ, setCurrentQ] = useState(initialQ);
  const [userAnswers, setUserAnswers] = useState(initialAnswers);
  const [flagged, setFlagged] = useState(initialFlags);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [attempt, setAttempt] = useState(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [loadError, setLoadError] = useState('');
  const active = React.useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const fetchAttempt = async () => {
      try {
        const saved = getSavedSession();
        let data;
        if (saved?.attemptId) {
          try {
            data = await api.getExamAttempt(token, examId, saved.attemptId);
          } catch (error) {
            if (error.status !== 404) throw error;
          }
        }
        if (!data) data = await api.startExamAttempt(token, examId);
        if (cancelled) return;
        if (data.resultId) {
          localStorage.removeItem(STORAGE_KEY);
          navigate('/exam/result/' + data.resultId);
          return;
        }
        setAttempt(data);
        setClockOffset(new Date(data.serverTime).getTime() - Date.now());
        setQuestions(data.exam.questions);
        if (saved?.attemptId !== data.id) {
          setUserAnswers({});
          setFlagged(new Set());
          setCurrentQ(0);
        } else setCurrentQ(Math.min(saved?.currentQ || 0, data.exam.questions.length - 1));
      } catch (error) {
        if (!cancelled)
          setLoadError(error.message || 'Không tải được phiên thi. Vui lòng thử lại.');
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };
    if (token) fetchAttempt();
    else if (!loading) setLoadingData(false);
    return () => {
      cancelled = true;
    };
    // The component is keyed by account and exam; changes create a fresh session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, token, loading]);
  const { timeLeft, isWarning, formatted } = useTimer(attempt?.expiresAt, clockOffset);

  // Lưu session vào localStorage
  useEffect(() => {
    if (!attempt || loadingData) return;
    const sessionData = {
      attemptId: attempt.id,
      currentQ,
      userAnswers,
      flagged: Array.from(flagged),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    } catch {}
  }, [currentQ, userAnswers, flagged, STORAGE_KEY, attempt, loadingData]);

  const question = questions[currentQ];
  const totalQ = questions.length;

  const selectAnswer = useCallback(
    (index) => {
      if (!question || timeLeft <= 0) return;
      // [BUG-01 FIX] index luôn là NUMBER — nhất quán giữa click chuột và phím tắt
      setUserAnswers((prev) => {
        const currentAnswers = prev[question.id] || [];
        // [BUG-03 FIX] Dùng answerCount thay vì correctAnswer để không lộ đáp án
        const isMultiple = (question.answerCount ?? 1) > 1;

        if (isMultiple) {
          const next = currentAnswers.includes(index)
            ? currentAnswers.filter((i) => i !== index)
            : [...currentAnswers, index];
          return { ...prev, [question.id]: next };
        } else {
          return { ...prev, [question.id]: [index] };
        }
      });
    },
    [question, timeLeft]
  );

  const toggleFlag = useCallback(() => {
    if (!question) return;
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(question.id)) next.delete(question.id);
      else next.add(question.id);
      return next;
    });
  }, [question]);

  // Phím tắt Keyboard
  useEffect(() => {
    if (showConfirm) return;

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight' && currentQ < totalQ - 1) {
        setCurrentQ((q) => q + 1);
      } else if (e.key === 'ArrowLeft' && currentQ > 0) {
        setCurrentQ((q) => q - 1);
      } else if (['a', 'b', 'c', 'd'].includes(e.key.toLowerCase())) {
        // [BUG-01 FIX] Dùng index số thay vì string key ('A','B','C','D')
        const keyMap = { a: 0, b: 1, c: 2, d: 3 };
        const idx = keyMap[e.key.toLowerCase()];
        if (idx < (question?.options?.length ?? 0)) selectAnswer(idx);
      } else if (e.key.toLowerCase() === 'f') {
        toggleFlag();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQ, totalQ, question?.options, selectAnswer, toggleFlag, showConfirm]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting || !attempt) return;

    setIsSubmitting(true);
    setShowConfirm(false);

    try {
      const res = await api.submitExam(token, examId, attempt.id, userAnswers);
      if (!active.current) return;

      if (res && res.resultId) {
        localStorage.removeItem(STORAGE_KEY);
        navigate(`/exam/result/${res.resultId}`);
      } else {
        showToast('Nộp bài thành công nhưng không lấy được ID kết quả.', 'warning');
        navigate('/exam/testing-center');
      }
    } catch (err) {
      console.error('>>> [FRONTEND] Lỗi khi nộp bài:', err);
      if (!active.current) return;
      showToast(err.message || 'Có lỗi xảy ra khi nộp bài. Vui lòng thử lại!', 'error');
      setIsSubmitting(false);
    }
  }, [navigate, examId, userAnswers, attempt, token, isSubmitting, showToast, STORAGE_KEY]);

  const autoSubmitted = React.useRef(false);
  useEffect(() => {
    if (attempt && timeLeft <= 1 && !loadingData && !autoSubmitted.current) {
      autoSubmitted.current = true;
      if (Date.now() + clockOffset < new Date(attempt.expiresAt).getTime()) handleSubmit();
    }
  }, [attempt, timeLeft, loadingData, handleSubmit, clockOffset]);

  const getQDotClass = (index) => {
    const q = questions[index];
    if (index === currentQ) return 'take-exam__q-dot take-exam__q-dot--active';
    if (flagged.has(q.id)) return 'take-exam__q-dot take-exam__q-dot--flagged';
    if (userAnswers[q.id] && userAnswers[q.id].length > 0)
      return 'take-exam__q-dot take-exam__q-dot--answered';
    return 'take-exam__q-dot take-exam__q-dot--unanswered';
  };

  const expired =
    attempt && timeLeft === 0 && Date.now() + clockOffset >= new Date(attempt.expiresAt).getTime();
  if (loadError || (expired && !isSubmitting))
    return (
      <div className="take-exam-page">
        <p role="alert">{loadError || 'Phiên thi đã hết thời gian nộp bài.'}</p>
        <button
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY);
            window.location.reload();
          }}
        >
          Thử lại / Bắt đầu lượt mới
        </button>
        {ToastComponent}
      </div>
    );

  if (loading || loadingData) {
    return (
      <div
        className="take-exam-page"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <HeartbeatLoader label="Đang tải bài thi..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        className="take-exam-page"
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <div
          style={{
            maxWidth: 560,
            width: '100%',
            background: 'var(--color-surface)',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center',
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--color-foreground)' }}>
            Đăng nhập để làm bài kiểm tra
          </h1>
          <p style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--color-muted-foreground)' }}>
            Bạn có thể xem thông tin tại Trung tâm Kiểm tra, nhưng cần đăng nhập để bắt đầu bài thi.
          </p>
          <div
            style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <button
              type="button"
              className="btn btn-prev"
              onClick={() => navigate('/exam/testing-center', { replace: true })}
            >
              Quay lại trung tâm
            </button>
            <button type="button" className="btn btn-submit" onClick={() => navigate('/login')}>
              Đăng nhập để làm bài
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!question || questions.length === 0) {
    return (
      <div
        className="take-exam-page"
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <div
          style={{
            maxWidth: 560,
            width: '100%',
            background: 'var(--color-surface)',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--color-foreground)' }}>
            Không có dữ liệu câu hỏi
          </h2>
          <p
            style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--color-muted-foreground)' }}
          >
            Bài thi này hiện tại chưa có câu hỏi nào. Vui lòng quay lại sau.
          </p>
          <button
            type="button"
            className="btn btn-prev"
            onClick={() => navigate('/exam/testing-center', { replace: true })}
          >
            Quay lại trung tâm
          </button>
        </div>
      </div>
    );
  }

  // [BUG-03 FIX] Dùng answerCount thay vì correctAnswer trong render
  const isMultipleAnswer = (question.answerCount ?? 1) > 1;

  return (
    <div className="take-exam-page">
      <h1 className="sr-only">Làm bài kiểm tra</h1>
      <div className="take-exam-mobile-status">
        <div role="timer" aria-live="off" aria-label="Thời gian còn lại">
          <small>Thời gian</small>
          <strong>{formatted}</strong>
        </div>
        <details className="take-exam-mobile-map">
          <summary>
            Chọn câu {currentQ + 1}/{totalQ}
          </summary>
          <div className="take-exam__q-grid">
            {questions.map((item, index) => (
              <button
                type="button"
                key={item.id}
                className={getQDotClass(index)}
                aria-label={`Đi đến câu ${index + 1}`}
                aria-current={currentQ === index ? 'step' : undefined}
                onClick={(event) => {
                  setCurrentQ(index);
                  event.currentTarget.closest('details').open = false;
                }}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </details>
        <button
          type="button"
          className="ui-button ui-button--secondary"
          onClick={() => setShowConfirm(true)}
        >
          Nộp bài
        </button>
      </div>
      <div className="take-exam__body">
        {/* ── Question Card ── */}
        <div className="take-exam__question-card">
          <div className="take-exam__question-meta">
            <span className="take-exam__q-tag">CÂU HỎI {currentQ + 1}</span>
            <button
              className="take-exam__bookmark-btn"
              aria-pressed={flagged.has(question.id)}
              onClick={toggleFlag}
            >
              <span aria-hidden="true">{flagged.has(question.id) ? '🚩' : '⚑'}</span> ĐÁNH DẤU XEM
              LẠI
            </button>
          </div>

          {question.imageUrl && (
            <div className="take-exam__q-image">
              <img
                src={question.imageUrl}
                alt="Exam topology"
                style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                width={640}
                height={360}
                loading="lazy"
                decoding="async"
              />
            </div>
          )}

          <div
            className="take-exam__q-content"
            dangerouslySetInnerHTML={{ __html: question.question }}
          />

          <div className="take-exam__options">
            <div
              style={{
                fontSize: '12px',
                color: 'var(--color-primary)',
                marginBottom: '10px',
                fontWeight: 600,
              }}
            >
              {isMultipleAnswer ? '(Chọn nhiều đáp án)' : '(Chọn 1 đáp án đúng)'}
            </div>
            {question.options.map((opt, idx) => {
              const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
              const isSelected =
                Array.isArray(userAnswers[question.id]) && userAnswers[question.id].includes(idx);
              return (
                <button
                  key={idx}
                  className={`take-exam__option ${isSelected ? 'take-exam__option--selected' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => selectAnswer(idx)}
                >
                  <span className="take-exam__option-badge">{OPTION_LABELS[idx]}</span>
                  <span className="take-exam__option-text">{opt}</span>
                </button>
              );
            })}
          </div>

          <div className="take-exam__nav">
            <button
              className="btn btn-prev"
              disabled={currentQ === 0}
              onClick={() => setCurrentQ((q) => q - 1)}
            >
              ← Câu trước
            </button>
            <span className="take-exam__nav-info">
              CÂU {currentQ + 1} TRÊN {totalQ}
            </span>
            {currentQ < totalQ - 1 ? (
              <button className="btn btn-next" onClick={() => setCurrentQ((q) => q + 1)}>
                Câu kế tiếp →
              </button>
            ) : (
              <button className="btn btn-submit" onClick={() => setShowConfirm(true)}>
                Nộp bài thi ✓
              </button>
            )}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="take-exam__sidebar">
          <div
            className="take-exam__sidebar-card"
            style={{
              marginBottom: '1.5rem',
              textAlign: 'center',
              background: isWarning ? 'var(--color-danger-bg)' : 'var(--color-surface)',
              border: isWarning ? '1px solid #fecaca' : '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: isWarning ? 'var(--color-danger)' : 'var(--color-muted-foreground)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '0.5rem',
              }}
            >
              Chế độ thi: Đang diễn ra
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontSize: '2rem',
                fontWeight: 700,
                color: isWarning ? 'var(--color-danger)' : 'var(--color-foreground)',
              }}
            >
              <AppIcon name={'timer'} className="app-icon" style={{ fontSize: '2rem' }} />
              {formatted}
            </div>
            {isWarning && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-danger)',
                  fontWeight: 600,
                  marginTop: '0.5rem',
                }}
              >
                Sắp hết giờ! Nhanh tay lên!
              </div>
            )}
          </div>

          <div className="take-exam__sidebar-card">
            <div className="take-exam__sidebar-title">
              <span>Bản đồ câu hỏi</span>
              <span style={{ fontWeight: 400 }}>{totalQ} CÂU</span>
            </div>
            <div className="take-exam__q-grid">
              {questions.map((_, index) => (
                <button
                  key={index}
                  className={getQDotClass(index)}
                  onClick={() => setCurrentQ(index)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <div className="take-exam__legend">
              <div className="take-exam__legend-item">
                <div
                  className="take-exam__legend-dot"
                  style={{ background: 'var(--color-primary)', borderRadius: '2px' }}
                ></div>
                <span>Đã trả lời</span>
              </div>
              <div className="take-exam__legend-item">
                <div
                  className="take-exam__legend-dot"
                  style={{
                    background: 'var(--color-muted)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '2px',
                  }}
                ></div>
                <span>Hiện tại</span>
              </div>
              <div className="take-exam__legend-item">
                <div
                  className="take-exam__legend-dot"
                  style={{
                    background: 'var(--color-muted)',
                    border: '2px solid #386298',
                    borderRadius: '2px',
                  }}
                ></div>
                <span>Còn lại</span>
              </div>
              <div className="take-exam__legend-item">
                <div
                  className="take-exam__legend-dot"
                  style={{
                    background: 'var(--color-muted)',
                    border: '1px solid #dc2626',
                    borderRadius: '2px',
                    position: 'relative',
                  }}
                ></div>
                <span>Xem lại sau</span>
              </div>
            </div>
          </div>

          <button className="take-exam__submit-btn" onClick={() => setShowConfirm(true)}>
            Nộp bài thi
          </button>
        </div>
      </div>

      {/* ── Confirm Submit Modal ── */}
      {showConfirm && (
        <Dialog
          className="exam-dialog"
          title="Xác nhận nộp bài?"
          onClose={() => {
            if (!isSubmitting) setShowConfirm(false);
          }}
        >
          <p className="exam-confirm-copy">
            Bạn đã trả lời{' '}
            <strong>
              {Object.keys(userAnswers).length}/{totalQ}
            </strong>{' '}
            câu hỏi.
            {totalQ - Object.keys(userAnswers).length > 0 &&
              ` Còn ${totalQ - Object.keys(userAnswers).length} câu chưa trả lời.`}
          </p>
          <div className="exam-confirm-actions">
            <button
              type="button"
              className="ui-button ui-button--secondary"
              disabled={isSubmitting}
              onClick={() => setShowConfirm(false)}
            >
              Làm tiếp
            </button>
            <button
              type="button"
              className="ui-button"
              disabled={isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? 'Đang nộp...' : 'Nộp bài ✓'}
            </button>
          </div>
        </Dialog>
      )}
      {ToastComponent}
    </div>
  );
};

const TakeExam = () => {
  const { user } = useAuth();
  const { examId } = useParams();
  return <TakeExamSession key={String(user?.id) + ':' + examId} />;
};
export default TakeExam;
