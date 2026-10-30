import AppIcon from '../../../components/ui/AppIcon';
import React, { useState, useEffect, useLayoutEffect } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Play, CheckCircle, Lock, ChevronRight, Map, ArrowLeft } from 'lucide-react';
import { api } from '../../../services/Api';
import { useAuth } from '../../../context/AuthContext';
import HeartbeatLoader from '../../../components/ui/HeartbeatLoader';
import errorIllustration from '../../../assets/images/fix1.webp';
import '../styles/CourseDetail.css';
import '../../../components/ui/styles/LearningError.css';

const COURSE_GRADIENTS = {
  ITN: {
    gradient: 'linear-gradient(135deg, #2d4e7a, #7395be)',
    color: 'var(--color-primary-hover)',
  },
  SRWE: { gradient: 'linear-gradient(135deg, #6d28d9, #7c3aed)', color: '#6d28d9' },
  ENSA: { gradient: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#7c3aed' },
};
const DEFAULT_GRADIENT = {
  gradient: 'linear-gradient(135deg, #386298, #7395be)',
  color: 'var(--color-primary)',
};

const MODULE_STATUS = {
  completed: { label: 'Hoàn thành', bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  active: { label: 'Đang học', bg: 'var(--color-muted)', color: 'var(--color-primary-hover)' },
  locked: { label: 'Chưa mở', bg: 'var(--color-muted)', color: 'var(--color-muted-foreground)' },
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
  const [expandedModule, setExpandedModule] = useState(null);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCourse(null);
    setError(null);
    const fetchCourse = async () => {
      try {
        const allCourses = await api.getCourses(token);
        const found = allCourses.find((c) => c.id === courseId);
        if (!found) throw new Error('Không tìm thấy khóa học này.');
        if (!cancelled) setCourse(found);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Không thể tải dữ liệu khóa học.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchCourse();
    return () => {
      cancelled = true;
    };
  }, [courseId, token]);

  if (loading) {
    return <HeartbeatLoader label="Đang chuẩn bị nội dung khóa học..." />;
  }

  if (error || !course) {
    return (
      <div className="lesson-error-container">
        <div className="lesson-error-card">
          <div className="lesson-error-illustration">
            <img
              src={errorIllustration}
              alt="Khóa học không tồn tại"
              width={512}
              height={512}
              decoding="async"
            />
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
  const isStarted = course.isStarted || course.progress > 0;
  const totalLessons =
    course.modules?.reduce((sum, m) => sum + (m.lessons?.length || m.lessonCount || 0), 0) || 0;
  const isLocked =
    course.canAccess === false || course.learningStatus === 'locked' || course.status === 'locked';

  const handleStartLearning = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (isLocked) {
      navigate('/roadmap');
      return;
    }

    try {
      // Nếu chưa học (chưa có record trong UserProgress), tạo 1 record đánh dấu đã ghi danh
      if (!isStarted) {
        await api.updateUserProgress(token, {
          courseId,
          progressPercent: 0,
          status: 'ACTIVE',
        });
      }
      navigate(`/lesson?course=${courseId}`);
    } catch (e) {
      console.error('Lỗi khi ghi danh khóa học:', e);
      if (e?.code === 'COURSE_LOCKED' || e?.status === 403) {
        setError(e.message || 'Khóa học này đang bị khóa. Vui lòng hoàn thành các chặng trước.');
      }
    }
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
              <AppIcon name={'arrow_back'} className="app-icon" style={{ fontSize: 14 }} />
              LỘ TRÌNH CHỨNG CHỈ
            </button>

            <h1 className="cdp-hero-title">
              {(course.fullTitle || course.title).replace(' (Updated)', '').replace(/,/g, ', ')}
            </h1>
            <p className="cdp-hero-subtitle">{course.longDescription || course.description}</p>

            {/* Meta row */}
            <div className="cdp-meta-row">
              <span className="cdp-meta-chip">
                <AppIcon name={'schedule'} className="app-icon" />
                {course.totalHours || '—'} Giờ nội dung
              </span>
              <span className="cdp-meta-chip">
                <AppIcon name={'bar_chart'} className="app-icon" />
                {course.level || 'Chuyên viên'}
              </span>
              <span className="cdp-meta-chip">
                <AppIcon name={'translate'} className="app-icon" />
                {course.language || 'Tiếng Việt'}
              </span>
            </div>
          </div>

          {/* Spacer to push content left (sidebar floats right in body) */}
          <div className="cdp-hero-spacer" />
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
                    <AppIcon name={'emoji_objects'} className="app-icon" />
                    CÁC NĂNG LỰC CỐT LÕI
                  </p>
                  <div className="cdp-competencies-grid">
                    {course.competencies.map((comp, i) => (
                      <div key={i} className="cdp-comp-item">
                        <AppIcon name={'check'} className="app-icon" />
                        {comp}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Curriculum */}
              <div className="cdp-section">
                <p className="cdp-section-title">
                  <AppIcon name={'menu_book'} className="app-icon" />
                  Nội dung khóa học
                </p>
                <div className="cdp-curriculum-meta">
                  <span>{course.modules?.length || 0} Học phần</span>
                  <span>•</span>
                  <span>{totalLessons} Bài học</span>
                </div>

                {course.modules?.map((module, idx) => {
                  const st = MODULE_STATUS[module.status] || MODULE_STATUS.locked;
                  const isLocked =
                    course.canAccess === false ||
                    course.learningStatus === 'locked' ||
                    module.canAccess === false ||
                    module.status === 'locked';
                  const isNavigable = isAuthenticated && !isLocked;
                  const isCompleted = module.status === 'completed';

                  const isExpanded = expandedModule === module.id;

                  return (
                    <div key={module.id} className="cdp-module-row" id={`module-row-${module.id}`}>
                      <button
                        type="button"
                        className="cdp-module-row-header"
                        disabled={!isNavigable}
                        aria-expanded={isExpanded}
                        aria-controls={`module-lessons-${module.id}`}
                        style={{
                          opacity: isLocked ? 0.6 : 1,
                          cursor: isNavigable ? 'pointer' : 'default',
                        }}
                        onClick={() => {
                          if (!isNavigable) return;
                          setExpandedModule(isExpanded ? null : module.id);
                        }}
                      >
                        {/* Number / status icon */}
                        <div
                          className="cdp-module-row-num"
                          style={{
                            background: isCompleted
                              ? 'var(--color-success-bg)'
                              : isLocked
                                ? 'var(--color-muted)'
                                : 'var(--color-muted)',
                            color: isCompleted
                              ? 'var(--color-success)'
                              : isLocked
                                ? 'var(--color-muted-foreground)'
                                : 'var(--color-primary-hover)',
                          }}
                        >
                          {isCompleted ? (
                            <CheckCircle size={16} />
                          ) : isLocked ? (
                            <Lock size={13} />
                          ) : (
                            idx + 1
                          )}
                        </div>

                        <div className="cdp-module-row-info">
                          <p className="cdp-module-row-title">{module.title}</p>
                          {module.description && (
                            <p className="cdp-module-row-desc">{module.description}</p>
                          )}
                        </div>

                        <div className="cdp-module-row-meta">
                          {(module.lessons?.length || module.lessonCount) > 0 && (
                            <span className="cdp-lesson-count">
                              {module.lessons?.length || module.lessonCount} bài học
                            </span>
                          )}
                          <span
                            className="cdp-module-row-badge"
                            style={{ background: st.bg, color: st.color }}
                          >
                            {st.label}
                          </span>
                          {isNavigable && (
                            <div className={`cdp-chevron-icon ${isExpanded ? 'expanded' : ''}`}>
                              <ChevronRight size={15} color="var(--color-muted-foreground)" />
                            </div>
                          )}
                        </div>
                      </button>

                      {/* Lesson List (Accordion Content) */}
                      {isExpanded && module.lessons && module.lessons.length > 0 && (
                        <div className="cdp-lesson-list" id={`module-lessons-${module.id}`}>
                          {module.lessons.map((lesson, lIdx) => {
                            const locked = lesson.canAccess === false;
                            const LessonLink = locked ? 'span' : Link;
                            return (
                              <LessonLink
                                key={lesson.id}
                                className="cdp-lesson-item"
                                {...(locked
                                  ? {
                                      role: 'link',
                                      'aria-disabled': true,
                                      tabIndex: 0,
                                      title: lesson.lockedReason,
                                      'aria-label': `${lesson.title}. ${lesson.lockedReason || 'Bài học chưa được mở khóa.'}`,
                                    }
                                  : { to: `/lesson?course=${courseId}&lesson=${lesson.id}` })}
                              >
                                <div className="cdp-lesson-item-left">
                                  {locked ? (
                                    <Lock size={16} aria-hidden="true" />
                                  ) : (
                                    <AppIcon name={'play_circle'} className="app-icon" />
                                  )}
                                  <span className="cdp-lesson-item-title">
                                    {lesson.sectionNumber
                                      ? `${lesson.sectionNumber}. `
                                      : `${lIdx + 1}. `}
                                    {lesson.title}
                                  </span>
                                </div>
                                <div className="cdp-lesson-item-right">
                                  {lesson.videoDuration && (
                                    <span className="cdp-lesson-duration">
                                      {lesson.videoDuration}
                                    </span>
                                  )}
                                </div>
                              </LessonLink>
                            );
                          })}
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
                <button
                  type="button"
                  className="cdp-thumb-wrap"
                  onClick={handleStartLearning}
                  aria-label={`Mở khóa học ${course.title}`}
                >
                  {course.thumbnailUrl ? (
                    <img
                      className="cdp-thumb-img"
                      src={course.thumbnailUrl}
                      alt={course.title}
                      width={640}
                      height={360}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, background: colors.gradient }} />
                  )}
                  <div className="cdp-thumb-play">
                    <AppIcon name={'play_circle'} className="app-icon" />
                    <span>Xem trước khóa học</span>
                  </div>
                </button>

                {/* Enroll body */}
                <div className="cdp-enroll-body">
                  <div className="cdp-price-row">
                    <span className="cdp-price-free">Miễn phí</span>
                  </div>

                  <button
                    id="cdp-enroll-btn"
                    className="cdp-enroll-btn"
                    style={{ background: 'var(--color-primary)' }}
                    onClick={handleStartLearning}
                  >
                    {isLocked ? (
                      <>
                        <Lock size={16} /> Chưa mở khóa — Xem lộ trình
                      </>
                    ) : !isAuthenticated ? (
                      <>
                        Đăng nhập để học{' '}
                        <AppIcon
                          name={'arrow_forward'}
                          className="app-icon"
                          style={{ fontSize: 18 }}
                        />
                      </>
                    ) : isStarted ? (
                      <>
                        <Play size={16} fill="white" /> Tiếp tục học
                      </>
                    ) : (
                      <>
                        Bắt đầu học{' '}
                        <AppIcon
                          name={'arrow_forward'}
                          className="app-icon"
                          style={{ fontSize: 18 }}
                        />
                      </>
                    )}
                  </button>

                  {isLocked ? (
                    <p className="cdp-access-note" style={{ color: 'var(--color-danger)' }}>
                      {course.lockedReason ||
                        'Bạn cần hoàn thành các bài học ở chặng trước để mở khóa.'}
                    </p>
                  ) : (
                    <p className="cdp-access-note">
                      Truy cập toàn bộ giáo trình trong thời gian có hạn
                    </p>
                  )}

                  {/* Progress bar nếu đang học */}
                  {isStarted && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.78rem',
                          color: 'var(--color-muted-foreground)',
                          marginBottom: '0.35rem',
                        }}
                      >
                        <span>Tiến độ của bạn</span>
                        <span style={{ fontWeight: 700, color: colors.color }}>
                          {course.progress}%
                        </span>
                      </div>
                      <div
                        style={{
                          background: 'var(--color-muted)',
                          borderRadius: '9999px',
                          height: 6,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${course.progress}%`,
                            height: '100%',
                            background: colors.gradient,
                            borderRadius: '9999px',
                            transition: 'width 0.6s ease',
                          }}
                        />
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
                            <AppIcon name={item.icon} className="app-icon" />
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
