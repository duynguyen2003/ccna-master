import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../services/Api';
import '../../../css/ExamFlow.css';

const ExamResult = () => {
  const navigate = useNavigate();
  const { resultId } = useParams();
  const { token } = useAuth();
  
  const [resultData, setResultData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const data = await api.getExamResult(token, resultId);
        if (data) {
          setResultData(data);
        }
      } catch (err) {
        console.error('Lỗi khi lấy kết quả thi:', err);
      } finally {
        setLoading(false);
      }
    };
    if (resultId && token) {
      fetchResult();
    }
  }, [resultId, token]);

  if (loading) {
    return (
      <div className="exam-result-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Đang tải kết quả...</p>
      </div>
    );
  }

  if (!resultData) {
    return (
      <div className="exam-result-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '2rem', background: '#fff', borderRadius: '16px' }}>
          <h2>Không tìm thấy kết quả</h2>
          <p>Có thể dữ liệu đã bị xóa hoặc đường dẫn không đúng.</p>
          <button className="er-btn-secondary" onClick={() => navigate('/exam/testing-center')} style={{ marginTop: '1rem' }}>Quay về trung tâm</button>
        </div>
      </div>
    );
  }

  const { exam, score, totalQuestions, isPassed, timeSpent, percentage, answers } = resultData;
  const examId = exam?.id;
  
  const correctCount = Math.round((Number(percentage) / 100) * totalQuestions);
  const wrongCount = totalQuestions - correctCount;
  
  const elapsedMin = Math.floor(timeSpent / 60);
  const elapsedSec = timeSpent % 60;
  const timeUsedStr = `${String(elapsedMin).padStart(2,'0')}:${String(elapsedSec).padStart(2,'0')}`;

  const targetScore = exam?.passingScore ? exam.passingScore * 10 : 700;
  const durationStr = exam?.durationMinutes ? `${exam.durationMinutes}:00` : '90:00';

  const today = new Date(resultData.takenAt || Date.now()).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' });

  // Dữ liệu dùng để truyền cho ReviewExam (nếu có bấm xem lại)
  const reviewState = {
    score,
    correct: correctCount,
    wrong: wrongCount,
    total: totalQuestions,
    pass: isPassed,
    timeUsed: timeUsedStr,
    examTitle: exam?.title || `CCNA Exam ${examId}`,
    userAnswers: answers,
    questions: exam?.questions || [],
    examId
  };

  return (
    <div className="exam-result-page">
      <div className="exam-result-container">

        {/* ── Hero Section ── */}
        <div className="er-hero">
          {/* Score Ring */}
          <div className="er-score-ring-wrapper">
            <div className="er-score-ring" style={{ borderColor: isPassed ? '#16a34a' : '#dc2626', boxShadow: `0 0 0 6px ${isPassed ? '#dcfce7' : '#fee2e2'}` }}>
              <span className="er-score-ring__icon">{isPassed ? '🏆' : '📋'}</span>
              <span className="er-score-ring__value">{score}</span>
              <span className="er-score-ring__denom">/ 1000 ĐIỂM</span>
            </div>
          </div>

          {/* Info */}
          <div className="er-hero-info">
            <span className={isPassed ? 'er-pass-badge' : 'er-fail-badge'}>
              {isPassed ? 'CHÚC MỪNG: PASS ✓' : 'KẾT QUẢ: FAIL ✕'}
            </span>
            <h1>Kết Quả Thi {exam?.title || 'CCNA 200-301'}</h1>
            <p>
              {isPassed
                ? 'Bạn đã hoàn thành xuất sắc bài kiểm tra mô phỏng chứng chỉ quốc tế.'
                : 'Bạn chưa đạt ngưỡng điểm tối thiểu. Hãy ôn luyện thêm và thử lại nhé!'}
            </p>
            <div className="er-meta-tags">
              <div className="er-meta-tag">🏁 Điểm đạt: {targetScore}</div>
              <div className="er-meta-tag">📅 {today}</div>
            </div>
          </div>
        </div>

        {/* ── Stats Grid ── */}
        <div className="er-stats">
          <div className="er-stat-card">
            <div className="er-stat-card__label"><span>⏱</span> THỜI GIAN</div>
            <div className="er-stat-card__value">{timeUsedStr}</div>
            <div className="er-stat-card__sub">Giới hạn {durationStr}</div>
          </div>
          <div className="er-stat-card">
            <div className="er-stat-card__label" style={{ color: '#16a34a' }}><span>✅</span> CHÍNH XÁC</div>
            <div className="er-stat-card__value" style={{ color: '#16a34a' }}>{correctCount}</div>
            <div className="er-stat-card__sub">Câu trả lời đúng</div>
          </div>
          <div className="er-stat-card">
            <div className="er-stat-card__label" style={{ color: '#dc2626' }}><span>⊗</span> SAI</div>
            <div className="er-stat-card__value" style={{ color: '#dc2626' }}>{wrongCount}</div>
            <div className="er-stat-card__sub">Cần xem lại</div>
          </div>
          <div className="er-stat-card">
            <div className="er-stat-card__label"><span>⊖</span> CÂU HỎI</div>
            <div className="er-stat-card__value">{totalQuestions}</div>
            <div className="er-stat-card__sub">Tổng số câu</div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="er-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
          <button
            className="er-btn-primary"
            onClick={() => navigate(`/exam/review/${examId}`, { state: reviewState })}
          >
            ☰ Xem lại đáp án
          </button>
          <button
            className="er-btn-secondary"
            onClick={() => navigate('/exam/testing-center')}
          >
            🏠 Quay về trang chủ
          </button>
        </div>

      </div>
    </div>
  );
};

export default ExamResult;
