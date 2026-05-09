import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  Lock,
  ArrowRight,
  Play,
  Loader2,
  AlertCircle,
  BookOpen,
  ChevronRight,
  Map,
  ArrowLeft
} from 'lucide-react';
import { api } from '../../services/Api.js';
import { useAuth } from '../../context/AuthContext';
import '../../css/Roadmap.css';
import errorIllustration from '../../image/fix1.png';

// Màu gradient cho từng khóa học
const COURSE_GRADIENTS = {
  ITN:  { gradient: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)', light: '#eff6ff', text: '#1d4ed8' },
  SRW:  { gradient: 'linear-gradient(135deg, #6d28d9, #7c3aed)', light: '#f5f3ff', text: '#6d28d9' },
  SRWE: { gradient: 'linear-gradient(135deg, #6d28d9, #7c3aed)', light: '#f5f3ff', text: '#6d28d9' },
  ENA:  { gradient: 'linear-gradient(135deg, #7c3aed, #a855f7)', light: '#fdf4ff', text: '#7c3aed' },
  ENSA: { gradient: 'linear-gradient(135deg, #7c3aed, #a855f7)', light: '#fdf4ff', text: '#7c3aed' },
};

const DEFAULT_GRADIENT = { gradient: 'linear-gradient(135deg, #2563eb, #60a5fa)', light: '#eff6ff', text: '#2563eb' };

export const Roadmap = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [data, progressMap] = await Promise.all([
          api.getCourses(token),
          token ? api.getUserProgress(token) : Promise.resolve({})
        ]);
        const coursesWithProgress = data.map(course => ({
          ...course,
          progress: progressMap[course.id] ?? course.progress ?? 0
        }));
        setCourses(coursesWithProgress);
      } catch (err) {
        setError('Không thể tải dữ liệu lộ trình.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const handleViewCourse = (courseId) => {
    navigate(`/course/${courseId}?from=roadmap`);
  };

  if (loading) {
    return (
      <div className="cdp-loading-container">
        <div className="cdp-loading-card">
          <div className="cdp-spinner" />
          <p>Đang tải lộ trình học tập...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lesson-error-container">
        <div className="lesson-error-card">
          <div className="lesson-error-illustration">
             <img src={errorIllustration} alt="Lỗi tải dữ liệu" />
          </div>
          <h2 className="lesson-error-title">Lỗi hệ thống</h2>
          <p className="lesson-error-desc">{error}</p>
          <div className="lesson-error-actions">
            <button className="btn-xem-lo-trinh" onClick={() => window.location.reload()}>
               <Map size={20} />
               <span>Thử lại ngay</span>
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

  return (
    <div className="roadmap-wrapper">
      <div className="roadmap-container">

        {/* Header */}
        <div className="roadmap-header-wrapper">
          <div className="roadmap-header-badge">
            <BookOpen size={13} /> LỘ TRÌNH HỌC TẬP
          </div>
          <h1 className="roadmap-header-title">
            Lộ trình CCNA 200-301
          </h1>
          <p className="roadmap-header-desc">
            Chinh phục chứng chỉ quốc tế với 3 khóa học chuyên sâu, từ nền tảng đến nâng cao.
          </p>
        </div>

        {/* Connection line between courses */}
        <div className="roadmap-connector-wrapper">

          {courses.map((course, index) => {
            const colors = COURSE_GRADIENTS[course.code] || DEFAULT_GRADIENT;
            const isStarted = course.progress > 0;
            const isCompleted = course.progress === 100;
            const moduleCount = course.modules?.length || 0;
            const completedModules = course.modules?.filter(m => m.status === 'completed').length || 0;

            return (
              <div key={course.id} style={{ position: 'relative', marginBottom: index < courses.length - 1 ? '1.5rem' : 0 }}>

                {/* Connector arrow between cards */}
                {index < courses.length - 1 && (
                  <div className="roadmap-connector">
                    <div className="roadmap-connector-line" />
                    <ChevronRight size={16} color="#94a3b8" className="roadmap-connector-arrow" />
                    <div className="roadmap-connector-line-bottom" />
                  </div>
                )}

                {/* Course Card */}
                <div
                  id={`course-card-${course.id}`}
                  className="roadmap-card"
                  style={{
                    '--gradient-bg': colors.gradient,
                    '--gradient-text': colors.text,
                    '--gradient-light': colors.light,
                  }}
                >
                  {/* Gradient top bar */}
                  <div className="roadmap-card-gradient" style={{ background: colors.gradient }} />

                  <div className="roadmap-card-content">

                    {/* Code icon */}
                    <div
                      className="roadmap-card-code"
                      style={{
                        background: colors.gradient,
                        boxShadow: `0 6px 18px ${colors.text}40`,
                      }}
                    >
                      {course.code}
                    </div>

                    {/* Info */}
                    <div className="roadmap-card-info">
                      <div className="roadmap-card-header">
                        <h2 className="roadmap-card-title">
                          {course.title}
                        </h2>
                        {isCompleted && (
                          <span className="roadmap-card-badge roadmap-card-badge-completed">✓ Hoàn thành</span>
                        )}
                        {isStarted && !isCompleted && (
                          <span className="roadmap-card-badge roadmap-card-badge-active">Đang học</span>
                        )}
                      </div>
                      <p className="roadmap-card-desc">
                        {course.description}
                      </p>

                      {/* Module status indicators */}
                      <div className="roadmap-card-modules">
                        {course.modules?.map((mod) => (
                          <div
                            key={mod.id}
                            title={mod.title}
                            className={`roadmap-card-module-dot ${mod.status === 'completed' ? 'completed' : mod.status === 'active' ? 'active' : 'inactive'}`}
                          />
                        ))}
                        <span className="roadmap-card-module-count">
                          {completedModules}/{moduleCount} modules
                        </span>
                      </div>
                    </div>

                    {/* Progress + CTA */}
                    <div className="roadmap-card-progress-wrapper">
                      {/* Progress */}
                      <div className="roadmap-card-progress">
                        <div className="roadmap-card-progress-label">
                          <span>Tiến độ</span>
                          <span className="roadmap-card-progress-value" style={{ color: isCompleted ? '#16a34a' : colors.text }}>
                            {course.progress}%
                          </span>
                        </div>
                        <div className="roadmap-card-progress-bar">
                          <div
                            className="roadmap-card-progress-fill"
                            style={{
                              width: `${course.progress}%`,
                              background: isCompleted ? '#22c55e' : colors.gradient,
                            }}
                          />
                        </div>
                      </div>

                      {/* CTA Button */}
                      <button
                        id={`btn-course-${course.id}`}
                        onClick={() => handleViewCourse(course.id)}
                        className="roadmap-card-btn"
                        style={{
                          background: colors.gradient,
                          boxShadow: `0 4px 14px ${colors.text}35`,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${colors.text}45`; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 4px 14px ${colors.text}35`; }}
                      >
                        {isCompleted ? (
                          <><CheckCircle size={15} /> Ôn tập</>
                        ) : isStarted ? (
                          <><Play size={14} fill="white" /> Tiếp tục</>
                        ) : (
                          <>Xem chi tiết <ArrowRight size={15} /></>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="roadmap-footer-note">
          * Mỗi khóa học mở khi bạn hoàn thành khóa học trước đó.
        </p>

      </div>
    </div>
  );
};

export default Roadmap;
