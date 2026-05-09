import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Play, CheckCircle, Lock, ChevronRight, Map, ArrowLeft } from 'lucide-react';
import { api } from '../../services/Api';
import { useAuth } from '../../context/AuthContext';
import errorIllustration from '../../image/fix1.png';
import '../../css/CourseDetail.css';

const COURSE_GRADIENTS = {
  ITN:  { gradient: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)', color: '#1d4ed8' },
  SRWE: { gradient: 'linear-gradient(135deg, #6d28d9, #7c3aed)', color: '#6d28d9' },
  ENSA: { gradient: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#7c3aed' },
};
const DEFAULT_GRADIENT = { gradient: 'linear-gradient(135deg, #2563eb, #60a5fa)', color: '#2563eb' };

const MODULE_STATUS = {
  completed: { label: 'Hoàn thành', bg: '#dcfce7', color: '#15803d' },
  active:    { label: 'Đang học',   bg: '#dbeafe', color: '#1d4ed8' },
  locked:    { label: 'Chưa mở',   bg: '#f1f5f9', color: '#94a3b8' },
};

const CourseDetail = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { token, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from') || 'roadmap';

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('curriculum');
  const [expandedModule, setExpandedModule] = useState(null);

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const allCourses = await api.getCourses(token);
        const found = allCourses.find((c) => c.id === courseId);
        if (!found) throw new Error('Không tìm thấy khóa học này.');
        setCourse(found);
      } catch (err) {
        setError(err.message || 'Không thể tải dữ liệu khóa học.');
      } finally {
        setLoading(false);
      }
    };
    fetchCourse();
  }, [courseId, token]);

  if (loading) {
    return (
      <div className="cdp-loading-container">
        <div className="cdp-loading-card">
          <div className="cdp-spinner" />
          <p>Đang chuẩn bị nội dung khóa học...</p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="lesson-error-container">
        <div className="lesson-error-card">
          <div className="lesson-error-illustration">
             <img src={errorIllustration} alt="Khóa học không tồn tại" />
          </div>
          <h2 className="lesson-error-title">Ôi hỏng!</h2>
          <p className="lesson-error-desc">
            {error || 'Khóa học bạn đang tìm kiếm không tồn tại hoặc đã bị gỡ bỏ.'}
          </p>
          <div className="lesson-error-actions">
            <button className="btn-xem-lo-trinh" onClick={() => navigate('/roadmap')}>
               <Map size={20} />
               <span>Xem lộ trình</span>
            </button>
            <button className="btn-quay-lai" onClick={() => navigate(-1)}>
               <ArrowLeft size={20} />
               <span>Quay lại</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const colors = COURSE_GRADIENTS[course.code] || DEFAULT_GRADIENT;
  const isStarted = course.progress > 0;
  const totalLessons = course.modules?.reduce((sum, m) => sum + (m.lessonCount || 0), 0) || 0;
  const instInitial = (course.instructor?.name || 'G').charAt(0).toUpperCase();
  const handleStartLearning = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    navigate(`/lesson?course=${courseId}`);
  };

  return (
    <div className="cdp-page">

      {/* ── Dark hero bar ── */}
      <div className="cdp-hero-bar">
        <div className="cdp-container">
          <div className="cdp-hero-left">

            {/* Breadcrumb back */}
            <button
              id="cdp-back-btn"
              className="cdp-breadcrumb-tag"
              onClick={() => navigate(`/${from}`)}
            >
              <span className="material-icons-round" style={{ fontSize: 14 }}>arrow_back</span>
              LỘ TRÌNH CHỨNG CHỈ
            </button>

            <h1 className="cdp-hero-title">
              {course.fullTitle || course.title}
            </h1>
            <p className="cdp-hero-subtitle">
              {course.longDescription || course.description}
            </p>

            {/* Meta row */}
            <div className="cdp-meta-row">
              <span className="cdp-meta-chip">
                <span className="material-icons-round">schedule</span>
                {course.totalHours || '—'} Giờ nội dung
              </span>
              <span className="cdp-meta-chip">
                <span className="material-icons-round">bar_chart</span>
                {course.level || 'Chuyên viên'}
              </span>
              <span className="cdp-meta-chip">
                <span className="material-icons-round">translate</span>
                {course.language || 'Tiếng Việt'}
              </span>
            </div>
          </div>

          {/* Spacer to push content left (sidebar floats right in body) */}
          <div style={{ width: 360, flexShrink: 0 }} />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="cdp-body">
        <div className="cdp-container">
          <div className="cdp-layout">

            {/* ── MAIN COLUMN ── */}
            <div className="cdp-main">

              {/* Competencies */}
              {course.competencies?.length > 0 && (
                <div className="cdp-section">
                  <p className="cdp-section-title">
                    <span className="material-icons-round">emoji_objects</span>
                    CÁC NĂNG LỰC CỐT LÕI
                  </p>
                  <div className="cdp-competencies-grid">
                    {course.competencies.map((comp, i) => (
                      <div key={i} className="cdp-comp-item">
                        <span className="material-icons-round">check</span>
                        {comp}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Curriculum */}
              <div className="cdp-section">
                <p className="cdp-section-title">
                  <span className="material-icons-round">menu_book</span>
                  LỘ TRÌNH KIẾN TRÚC
                </p>
                <div className="cdp-curriculum-meta">
                  <span>{course.modules?.length || 0} Học phần</span>
                  <span>•</span>
                  <span>{totalLessons} Bài học</span>
                </div>

                {course.modules?.map((module, idx) => {
                  const st = MODULE_STATUS[module.status] || MODULE_STATUS.locked;
                  const isLocked = module.status === 'locked';
                  const isNavigable = isAuthenticated && !isLocked;
                  const isCompleted = module.status === 'completed';

                   const isExpanded = expandedModule === module.id;

                  return (
                    <div key={module.id} className="cdp-module-row" id={`module-row-${module.id}`}>
                      <div
                        className="cdp-module-row-header"
                        style={{ opacity: isLocked ? 0.6 : 1, cursor: isNavigable ? 'pointer' : 'default' }}
                        onClick={() => {
                          if (!isNavigable) return;
                          setExpandedModule(isExpanded ? null : module.id);
                        }}
                      >
                        {/* Number / status icon */}
                        <div
                          className="cdp-module-row-num"
                          style={{ background: isCompleted ? '#dcfce7' : isLocked ? '#f1f5f9' : '#dbeafe',
                                   color: isCompleted ? '#15803d' : isLocked ? '#94a3b8' : '#1d4ed8' }}
                        >
                          {isCompleted
                            ? <CheckCircle size={16} />
                            : isLocked
                              ? <Lock size={13} />
                              : idx + 1}
                        </div>

                        <div className="cdp-module-row-info">
                          <p className="cdp-module-row-title">{module.title}</p>
                          {module.description && (
                            <p className="cdp-module-row-desc">{module.description}</p>
                          )}
                        </div>

                        <div className="cdp-module-row-meta">
                          {module.lessonCount > 0 && (
                            <span className="cdp-lesson-count">{module.lessonCount} bài học</span>
                          )}
                          <span
                            className="cdp-module-row-badge"
                            style={{ background: st.bg, color: st.color }}
                          >
                            {st.label}
                          </span>
                          {isNavigable && (
                            <div className={`cdp-chevron-icon ${isExpanded ? 'expanded' : ''}`}>
                              <ChevronRight size={15} color="#94a3b8" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Lesson List (Accordion Content) */}
                      {isExpanded && module.lessons && module.lessons.length > 0 && (
                        <div className="cdp-lesson-list">
                          {module.lessons.map((lesson, lIdx) => (
                            <div 
                              key={lesson.id} 
                              className="cdp-lesson-item"
                              onClick={() => navigate(`/lesson?course=${courseId}&lesson=${lesson.id}`)}
                            >
                              <div className="cdp-lesson-item-left">
                                <span className="material-icons-round">play_circle</span>
                                <span className="cdp-lesson-item-title">
                                  {lesson.sectionNumber ? `${lesson.sectionNumber}. ` : `${lIdx + 1}. `}
                                  {lesson.title}
                                </span>
                              </div>
                              <div className="cdp-lesson-item-right">
                                {lesson.videoDuration && (
                                  <span className="cdp-lesson-duration">{lesson.videoDuration}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>

            {/* ── SIDEBAR (sticky enrollment card) ── */}
            <div className="cdp-sidebar">
              <div className="cdp-enroll-card">

                {/* Thumbnail */}
                <div
                  className="cdp-thumb-wrap"
                  onClick={handleStartLearning}
                >
                  {course.thumbnailUrl ? (
                    <img className="cdp-thumb-img" src={course.thumbnailUrl} alt={course.title} />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, background: colors.gradient }} />
                  )}
                  <div className="cdp-thumb-play">
                    <span className="material-icons-round">play_circle</span>
                    <span>Xem trước khóa học</span>
                  </div>
                </div>

                {/* Enroll body */}
                <div className="cdp-enroll-body">
                  <div className="cdp-price-row">
                    <span className="cdp-price-free">Miễn phí</span>
                  </div>

                  <button
                    id="cdp-enroll-btn"
                    className="cdp-enroll-btn"
                    style={{ background: colors.gradient }}
                    onClick={handleStartLearning}
                  >
                    {!isAuthenticated ? (
                      <>Đăng nhập để học <span className="material-icons-round" style={{ fontSize: 18 }}>arrow_forward</span></>
                    ) : isStarted ? (
                      <><Play size={16} fill="white" /> Tiếp tục học</>
                    ) : (
                      <>Ghi danh miễn phí <span className="material-icons-round" style={{ fontSize: 18 }}>arrow_forward</span></>
                    )}
                  </button>

                  <p className="cdp-access-note">Truy cập toàn bộ giáo trình trong thời gian có hạn</p>

                  {/* Progress bar nếu đang học */}
                  {isStarted && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', marginBottom: '0.35rem' }}>
                        <span>Tiến độ của bạn</span>
                        <span style={{ fontWeight: 700, color: colors.color }}>{course.progress}%</span>
                      </div>
                      <div style={{ background: '#e2e8f0', borderRadius: '9999px', height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${course.progress}%`, height: '100%', background: colors.gradient, borderRadius: '9999px', transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  )}

                  {/* What's included */}
                  {course.includes?.length > 0 && (
                    <>
                      <p className="cdp-includes-title">BAO GỒM TRONG KHÓA HỌC NÀY</p>
                      <ul className="cdp-includes-list">
                        {course.includes.map((item, i) => (
                          <li key={i}>
                            <span className="material-icons-round">{item.icon}</span>
                            {item.text}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDetail;
