import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../Toast';
import { api } from '../../../services/Api';
import '../../../css/ExamFlow.css';



// ─── Component ────────────────────────────────────────────────
const TestingCenter = () => {
  const navigate = useNavigate();
  const { token, isAuthenticated } = useAuth();
  const { showToast, ToastComponent } = useToast();
  const isGuest = !isAuthenticated;

  const [practiceModules, setPracticeModules] = useState([]);
  const [exams, setExams] = useState([]);
  const [examHistory, setExamHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('practice'); // 'practice' | 'mock'
  const [expandedModule, setExpandedModule] = useState(null);

  // Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Lấy toàn bộ Course
        const coursesData = await api.getCourses(token);
        
        // 2. Lấy toàn bộ Exams
        const examsData = await api.getExams(token);
        setExams(examsData);

        // 3. Lấy Lịch sử thi của user
        let historyData = [];
        if (isAuthenticated) {
           historyData = await api.getMyExamHistory(token);
           setExamHistory(historyData);
        }

        // Tạo map lưu điểm cao nhất theo examId
        const highestScoreMap = {};
        historyData.forEach(attempt => {
          if (!highestScoreMap[attempt.examId] || attempt.score > highestScoreMap[attempt.examId].score) {
            highestScoreMap[attempt.examId] = attempt;
          }
        });

        // 4. Chuyển đổi dữ liệu từ Course -> Modules -> Quizzes (Practice)
        const allModules = [];
        const colors = ['#2563eb', '#059669', '#8b5cf6', '#f59e0b', '#ef4444'];
        const bgs = ['#eff6ff', '#ecfdf5', '#f5f3ff', '#fffbeb', '#fef2f2'];
        
        coursesData.forEach((course, cIdx) => {
          (course.modules || []).forEach((mod, mIdx) => {
            if (mod.exams && mod.exams.length > 0) {
              allModules.push({
                id: mod.id,
                icon: '⚙️',
                color: colors[cIdx % colors.length],
                bg: bgs[cIdx % bgs.length],
                title: `${course.code} - ${mod.title}`,
                meta: `${mod.exams.length} Bài tập ôn luyện`,
                quizzes: mod.exams.map(ex => {
                  const bestAttempt = highestScoreMap[ex.id];
                  let scoreLabel = 'TRẠNG THÁI';
                  let scoreSub = 'Chưa làm';
                  let scoreVal = null;
                  let colorClass = '#94a3b8'; // grey
                  
                  if (bestAttempt) {
                    scoreVal = bestAttempt.score;
                    if (bestAttempt.isPassed) {
                      scoreSub = 'Đã đạt';
                      colorClass = '#16a34a'; // green
                    } else {
                      scoreSub = 'Chưa đạt';
                      colorClass = '#dc2626'; // red
                    }
                  }

                  return {
                    id: ex.id.toString(),
                    code: ex.examCode || 'EX',
                    label: ex.title,
                    info: `${ex._count?.questions || ex.totalQuestions || 0} câu hỏi · ${ex.durationMinutes || 0} phút`,
                    score: scoreVal,
                    scoreLabel,
                    scoreSub,
                    colorClass
                  };
                })
              });
            }
          });
        });
        
        setPracticeModules(allModules);
        if (allModules.length > 0) setExpandedModule(allModules[0].id);

      } catch (error) {
        console.error("Failed to fetch testing center data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, isAuthenticated]);

  const handleStartExam = (examId) => {
    if (isGuest) {
      showToast('Vui lòng đăng nhập để bắt đầu làm bài thi.', 'info');
      navigate('/login', { state: { from: `/exam/take/${examId}` } });
      return;
    }
    navigate(`/exam/take/${examId}`);
  };

  const openHistory = (examId) => {
    setSelectedExamId(examId);
    setHistoryModalOpen(true);
  };

  const closeHistory = () => {
    setHistoryModalOpen(false);
    setSelectedExamId(null);
  };

  const handleViewDetails = (attempt) => {
    navigate(`/exam/result/${attempt.id}`);
  };

  const selectedExamData = exams.find(e => e.id === selectedExamId || e.id.toString() === selectedExamId?.toString());
  
  // Format currentHistoryList
  const currentHistoryList = examHistory
    .filter(h => h.examId.toString() === selectedExamId?.toString())
    .map((attempt, index, arr) => {
      const elapsedMin = Math.floor(attempt.timeSpent / 60);
      const elapsedSec = attempt.timeSpent % 60;
      const timeUsed = `${String(elapsedMin).padStart(2,'0')}:${String(elapsedSec).padStart(2,'0')}`;
      
      return {
        id: attempt.id,
        attempt: arr.length - index, // Mới nhất lên đầu
        date: new Date(attempt.takenAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        timeUsed,
        score: attempt.score,
        pass: attempt.isPassed
      };
    });

  return (
    <div className="tc-page">
      {ToastComponent}
      <div className="tc-container">
        
        {loading && (
          <div className="tc-loading-overlay">
            <div className="tc-spinner"></div>
            <p>Đang tải danh sách kỳ thi...</p>
          </div>
        )}

        {/* Hero */}
        <div className="tc-hero">
          <div>
            <h1 className="tc-hero-title">Trung tâm Kiểm tra &amp; Đánh giá</h1>
            <p className="tc-hero-desc">Phòng lab mô phỏng kỳ thi CCNA chuẩn quốc tế với hệ thống đánh giá chi tiết.</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="tc-tabs">
          <button
            className={`tc-tab ${activeTab === 'practice' ? 'active' : ''}`}
            onClick={() => setActiveTab('practice')}
          >
            Luyện tập theo chương
          </button>
          <button
            className={`tc-tab ${activeTab === 'mock' ? 'active' : ''}`}
            onClick={() => setActiveTab('mock')}
          >
            Thi thử CCNA
          </button>
        </div>

        {/* ── Tab 1: Practice by Chapter ── */}
        {activeTab === 'practice' && (
          <div className="tc-module-list">
            {practiceModules.length > 0 ? (
              practiceModules.map((mod) => (
                <div key={mod.id} className="tc-module-card">
                  <div className="tc-module-header" onClick={() => setExpandedModule(expandedModule === mod.id ? null : mod.id)}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div className="tc-module-icon" style={{ background: mod.bg, color: mod.color }}>
                        {mod.locked ? '🔒' : mod.icon}
                      </div>
                      <div className="tc-module-info">
                        <h3>{mod.title}</h3>
                        <span>{mod.meta}</span>
                      </div>
                    </div>
                    <div className="tc-module-meta">
                      <span style={{ fontSize: '1.2rem', color: '#94a3b8' }}>
                        {expandedModule === mod.id ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                {expandedModule === mod.id && !mod.locked && mod.quizzes.length > 0 && (
                  <div className="tc-quiz-list">
                    {mod.quizzes.map((quiz) => (
                      <div key={quiz.id} className="tc-quiz-row">
                        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                          <div className="tc-quiz-icon">{quiz.code}</div>
                          <div className="tc-quiz-info">
                            <h4>{quiz.label}</h4>
                            <span>{quiz.info}</span>
                          </div>
                        </div>
                        {quiz.score !== null ? (
                          <div className="tc-quiz-score">
                            <span>{quiz.scoreLabel}</span>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <strong style={{ color: quiz.colorClass, lineHeight: '1' }}>{quiz.scoreSub}</strong>
                              <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>{quiz.score}/1000</span>
                            </div>
                          </div>
                        ) : (
                          <div className="tc-quiz-score">
                            <span>{quiz.scoreLabel}</span>
                            <strong style={{ color: '#94a3b8' }}>{quiz.scoreSub}</strong>
                          </div>
                        )}
                        <button
                          className="tc-btn-start"
                          style={{ width: 'auto', padding: '0.5rem 1.25rem' }}
                          onClick={() => handleStartExam(quiz.id)}
                          title={isGuest ? 'Đăng nhập để làm bài' : ''}
                        >
                          Làm bài
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                </div>
              ))
            ) : (
              <div className="tc-empty-state">
                <div className="tc-empty-state-icon">📚</div>
                <h3>Chưa có bài tập luyện tập</h3>
                <p>Dữ liệu đang được cập nhật. Vui lòng quay lại sau!</p>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: Mock CCNA Exams ── */}
        {activeTab === 'mock' && (
          <div className="tc-mock-grid">
            {exams.map((exam) => (
              <div key={exam.id} className="tc-mock-card">
                <span className={`tc-mock-card__badge badge-${exam.difficulty?.toLowerCase()}`}>{exam.difficulty}</span>
                <div className="tc-mock-card__icon">📄</div>
                <h3>{exam.title}</h3>
                <ul className="tc-mock-card__meta">
                    <li><span>⏱</span>{exam.duration} phút</li>
                    <li><span>❓</span>{exam.totalQuestions} câu hỏi</li>
                </ul>
                <div className="tc-mock-card__actions">
                  <button
                    className="tc-btn-start"
                    onClick={() => handleStartExam(exam.id)}
                    title={isGuest ? 'Đăng nhập để bắt đầu thi' : ''}
                  >
                    Bắt đầu thi
                  </button>
                  {!isGuest && (
                    <button className="tc-btn-history" onClick={() => openHistory(exam.id)}>
                      XEM LẠI LỊCH SỬ THI
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Coming Soon Card */}
            <div className="tc-soon-card">
              <span style={{ fontSize: '2rem', color: '#94a3b8' }}>⊕</span>
              <h4>Thêm nhiều kỳ thi sắp ra mắt</h4>
              <p>Chúng tôi cập nhật ngân hàng câu hỏi 2 tuần một lần để phù hợp với các tiêu chuẩn CCNA hiện hành.</p>
            </div>
          </div>
        )}

        {/* ── Modal Lịch Sử Thi ── */}
        {historyModalOpen && (
          <div className="tc-modal-overlay" onClick={closeHistory}>
            <div className="tc-modal" onClick={e => e.stopPropagation()}>
              <div className="tc-modal-header">
                <h2>Lịch sử thi: {selectedExamData?.title}</h2>
                <button className="tc-modal-close" onClick={closeHistory}>&times;</button>
              </div>
              <div className="tc-modal-body">
                {currentHistoryList.length > 0 ? (
                  <div className="tc-history-list">
                    {/* Sắp xếp mới nhất lên đầu */}
                    {[...currentHistoryList].reverse().map((attempt) => (
                      <div key={attempt.id} className="tc-history-item">
                        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                          <div className="tc-history-main">
                            <span className="tc-history-title">Lần thi {attempt.attempt}</span>
                            <div className="tc-history-meta">
                              <span>📅 {attempt.date}</span>
                              <span>⏱ {attempt.timeUsed}</span>
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                            <div className="tc-history-score-wrapper">
                              <div className="tc-history-score">{attempt.score}/1000</div>
                              <span className={`tc-history-badge ${attempt.pass ? 'pass' : 'fail'}`}>
                                {attempt.pass ? 'PASS' : 'FAIL'}
                              </span>
                            </div>
                            <button className="tc-history-btn" onClick={() => handleViewDetails(attempt)}>
                              Chi tiết &rarr;
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="tc-empty-state">
                    <div className="tc-empty-state-icon">📝</div>
                    <h3>Chưa có dữ liệu</h3>
                    <p>Bạn chưa thực hiện bài thi này lần nào. Hãy bắt đầu ngay nhé!</p>
                    <button
                      className="tc-btn-start"
                      style={{ marginTop: '1rem', width: 'auto', padding: '0.6rem 1.5rem' }}
                      onClick={() => { closeHistory(); handleStartExam(selectedExamId); }}
                      title={isGuest ? 'Đăng nhập để bắt đầu thi' : ''}
                    >
                      Bắt đầu thi
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default TestingCenter;
