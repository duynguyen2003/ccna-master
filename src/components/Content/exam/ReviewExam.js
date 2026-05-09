import React, { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import '../../../css/ExamFlow.css';

// ─── Mock Questions (giống TakeExam) ──────────────────────────
// Gỡ bỏ MOCK_QUESTIONS và sử dụng dữ liệu truyền vào từ state

// ─── Component ────────────────────────────────────────────────
const ReviewExam = () => {
  const navigate = useNavigate();
  const { examId } = useParams();
  const { state } = useLocation();

  const result = state || {
    score: 850,
    correct: 2,
    wrong: 1,
    total: 3,
    pass: true,
    timeUsed: '45:12',
    userAnswers: {},
    questions: [],
  };

  // Nếu state có userAnswers thật thì dùng, fallback thì dùng demo
  const userAnswers = (result.userAnswers && Object.keys(result.userAnswers).length)
    ? result.userAnswers
    : { 1: 'A', 2: 'C', 3: 'B' };

  const questions = result.questions || [];
  const [currentQ, setCurrentQ] = useState(0);
  const question = questions[currentQ];
  const userAns = Array.isArray(userAnswers[question?.id]) ? userAnswers[question.id] : [];
  const correctAns = Array.isArray(question?.correctAnswer) ? question.correctAnswer : [question?.correctAnswer];
  
  const isCorrect = userAns.length === correctAns.length && userAns.every(val => correctAns.includes(val));

  // Xác định class cho mỗi option
  const getOptionClass = (idx) => {
    let cls = 'take-exam__option';
    const isAnsCorrect = correctAns.includes(idx);
    const isAnsUser = userAns.includes(idx);

    if (isAnsCorrect) return cls + ' take-exam__option--correct';
    if (isAnsUser && !isAnsCorrect) return cls + ' take-exam__option--wrong';
    return cls;
  };

  const answeredCorrect = questions.filter(q => {
    const ua = Array.isArray(userAnswers[q.id]) ? userAnswers[q.id] : [];
    const ca = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
    return ua.length === ca.length && ua.every(val => ca.includes(val));
  }).length;
  const reviewPct = questions.length > 0 ? Math.round((currentQ + 1) / questions.length * 100) : 0;

  return (
    <div className="review-exam-page">

      {/* Không dùng top navbar tĩnh, các chức năng được chuyển dời vào sidebar */}

      {/* Body */}
      <div className="take-exam__body">
        {!question ? (
          <div className="take-exam__question-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <h2>Không có dữ liệu câu hỏi để xem lại</h2>
            <button className="btn btn-primary" onClick={() => navigate('/exam/testing-center')}>
              Quay lại trang chủ
            </button>
          </div>
        ) : (
          /* ── Question Card (Review Mode) ── */
          <div className="take-exam__question-card">
          {/* Meta */}
          <div className="take-exam__question-meta">
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span
                className="take-exam__q-tag"
                style={{ background: isCorrect ? '#dcfce7' : '#fee2e2', color: isCorrect ? '#166534' : '#991b1b' }}
              >
                {isCorrect ? '✓ CÂU HỎI ' : '✕ CÂU HỎI '}{currentQ + 1}: {isCorrect ? 'ĐÚNG' : 'SAI'}
              </span>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Lĩnh vực: {question.domain}</span>
            </div>
          </div>

          {/* Image (nếu có) */}
          {question.imageUrl && (
            <div className="take-exam__q-image">
              <img src={question.imageUrl} alt="Exam topology" style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
            </div>
          )}

          {/* Question Text */}
          <div className="take-exam__q-content" dangerouslySetInnerHTML={{ __html: question.question }} />

          {/* Options (READ ONLY mode - pointer-events: none) */}
          <div className="take-exam__options" style={{ pointerEvents: 'none' }}>
            {question.options.map((opt, idx) => {
              const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
              const isAnsCorrect = correctAns.includes(idx);
              const isAnsUser = userAns.includes(idx);
              return (
                <div key={idx} className={getOptionClass(idx)}>
                  <span className="take-exam__option-badge">{OPTION_LABELS[idx]}</span>
                  <span className="take-exam__option-text">
                    {opt}
                    {isAnsCorrect && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: '#16a34a', fontWeight: 600 }}>← Đáp án đúng</span>
                    )}
                    {isAnsUser && !isAnsCorrect && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>← Lựa chọn của bạn (Sai)</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── Explanation Callout ── */}
          <div className="review-exam__explanation">
            <div className="review-exam__explanation-title">
              <span>💡</span> Giải thích chi tiết
            </div>
            <div className="review-exam__explanation-body">
              <div 
                style={{ margin: '0 0 0.75rem', lineHeight: '1.6' }} 
                dangerouslySetInnerHTML={{ __html: question.explanation }} 
              />
              {question.explanationBullets && (
                <ul>
                  {question.explanationBullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              )}
            </div>
          </div>

          {/* Nav */}
          <div className="take-exam__nav">
            <button
              className="btn btn-prev"
              disabled={currentQ === 0}
              onClick={() => setCurrentQ(q => q - 1)}
            >
              ← Câu trước
            </button>
            <span className="take-exam__nav-info">CÂU {currentQ + 1} TRÊN {questions.length}</span>
            <button
              className="btn btn-next"
              disabled={currentQ === questions.length - 1}
              onClick={() => setCurrentQ(q => q + 1)}
            >
              Câu tiếp theo →
            </button>
          </div>
        </div>
      )}

      {/* ── Sidebar ── */}
        <div className="take-exam__sidebar">
          {/* Nút Quay lại và Thống kê */}
          <div className="take-exam__sidebar-card" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             <button
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '0.5rem',
                  padding: '0.75rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', width: '100%', color: '#1e293b'
                }}
                onClick={() => navigate(`/exam/result/${examId}`, { state: result })}
             >
                ← Quay lại trang kết quả
             </button>
             <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
               <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.3rem' }}>Chế độ xem lại bài</div>
               <div style={{ fontSize: '1.2rem', fontWeight: 700, color: result.pass ? '#16a34a' : '#dc2626' }}>
                 Điểm: {result.score}/1000
               </div>
               <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.3rem' }}>{answeredCorrect} / {questions.length} câu đúng</div>
             </div>
             
             {/* Thanh tiến độ xem lại */}
             <div style={{ marginTop: '0.5rem' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: 600 }}>
                    <span>Tiến độ: {reviewPct}%</span>
                    <span>{currentQ + 1}/{questions.length}</span>
                 </div>
                 <div className="take-exam__progress-bar" style={{ height: '6px', background: '#e2e8f0' }}>
                   <div className="take-exam__progress-fill" style={{ width: `${reviewPct}%`, background: '#2563eb' }} />
                 </div>
             </div>
          </div>

          {/* Question Map */}
          <div className="take-exam__sidebar-card">
            <div className="take-exam__sidebar-title">
              <span>Bản đồ câu hỏi</span>
            </div>
            <div className="take-exam__q-grid">
              {questions.map((q, index) => {
                const ua = Array.isArray(userAnswers[q.id]) ? userAnswers[q.id] : [];
                const ca = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
                const isRightAnswer = ua.length === ca.length && ua.every(val => ca.includes(val));
                let bg = '#f1f5f9', color = '#64748b', border = 'none';
                if (index === currentQ) { bg = 'white'; color = '#2563eb'; border = '2px solid #2563eb'; }
                else if (ua.length === 0) { bg = '#f1f5f9'; color = '#94a3b8'; }
                else if (isRightAnswer) { bg = '#dcfce7'; color = '#16a34a'; }
                else { bg = '#fee2e2'; color = '#dc2626'; }
                return (
                  <button
                    key={index}
                    className="take-exam__q-dot"
                    style={{ background: bg, color, border }}
                    onClick={() => setCurrentQ(index)}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
            <div className="take-exam__legend">
              <div className="take-exam__legend-item">
                <div className="take-exam__legend-dot" style={{ background: '#dcfce7', border: '1px solid #16a34a' }}></div>
                <span>Đáp án đúng</span>
              </div>
              <div className="take-exam__legend-item">
                <div className="take-exam__legend-dot" style={{ background: '#fee2e2', border: '1px solid #dc2626' }}></div>
                <span>Đáp án sai</span>
              </div>
              <div className="take-exam__legend-item">
                <div className="take-exam__legend-dot" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}></div>
                <span>Chưa xem lại</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewExam;
