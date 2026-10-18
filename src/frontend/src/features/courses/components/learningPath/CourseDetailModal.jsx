import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, BookOpen, CheckCircle2, Clock, Lock, X } from 'lucide-react';

const formatHours = (hours) => {
  if (!Number.isFinite(hours) || hours <= 0) return 'Chưa cập nhật';
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(hours)} giờ`;
};

const getModuleTarget = (courseId, module, review = false) => {
  const lessons = Array.isArray(module?.lessons) ? module.lessons : [];
  const labs = Array.isArray(module?.labs) ? module.labs : [];
  const lesson = review ? lessons[0] : lessons.find((item) => !item.completed) || lessons[0];

  if (lesson?.id) return `/lesson?course=${courseId}&lesson=${lesson.id}`;

  const lab = review ? labs[0] : labs.find((item) => !item.completed) || labs[0];
  if (lab?.id) return `/labs?labId=${lab.id}`;

  return null;
};

export const CourseDetailModal = ({ course, isOpen = false, onClose, triggerRef = null }) => {
  const navigate = useNavigate();
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousActiveElement = document.activeElement;
    const triggerElement = triggerRef?.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !modalRef.current) return;

      const focusable = modalRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      (triggerElement || previousActiveElement)?.focus?.();
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen || !course) return null;

  const modules = Array.isArray(course.modules) ? course.modules : [];
  const skills = Array.isArray(course.skills) ? course.skills.filter(Boolean) : [];
  const totalModules = Number.isFinite(course.totalModules) ? course.totalModules : modules.length;
  const completedModules = Number.isFinite(course.completedModules)
    ? course.completedModules
    : modules.filter((module) => module.completed).length;
  const progressPercent = Math.max(0, Math.min(100, Number(course.progressPercent) || 0));
  const isCompleted = course.status === 'completed' || Boolean(course.completed);
  const isLocked = course.status === 'locked' || course.canAccess === false;

  const navigateTo = (target) => {
    if (!target) return;
    onClose();
    navigate(target);
  };

  const handleContinue = () => {
    if (isLocked) {
      if (course.prerequisiteId) {
        navigateTo(`/course/${course.prerequisiteId}?from=roadmap`);
      }
      return;
    }

    if (course.nextLessonId) {
      navigateTo(`/lesson?course=${course.id}&lesson=${course.nextLessonId}`);
      return;
    }

    const currentModule =
      modules.find((module) => module.id === course.nextModuleId) ||
      modules.find((module) => module.status === 'current') ||
      modules.find((module) => module.canAccess !== false && !module.completed);
    navigateTo(getModuleTarget(course.id, currentModule) || `/course/${course.id}?from=roadmap`);
  };

  const handleReview = () => {
    const firstAccessibleModule = modules.find((module) => module.canAccess !== false);
    navigateTo(
      getModuleTarget(course.id, firstAccessibleModule, true) || `/course/${course.id}?from=roadmap`
    );
  };

  const handleOpenModule = (module) => {
    if (isLocked || module.canAccess === false || module.status === 'locked') return;
    navigateTo(getModuleTarget(course.id, module, module.completed));
  };

  return (
    <div
      className="lp-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="lp-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lp-modal-title"
      >
        <div className="lp-modal-header">
          <div className="lp-modal-title-row">
            <div className="lp-modal-badge-group">
              {course.code ? <span className="lp-badge-code">{course.code}</span> : null}
              {isCompleted ? (
                <span className="lp-badge-status-completed">
                  <CheckCircle2 size={13} strokeWidth={2.5} /> Đã hoàn thành
                </span>
              ) : isLocked ? (
                <span className="lp-badge-status-locked">
                  <Lock size={12} /> Chưa mở khóa
                </span>
              ) : (
                <span className="lp-badge-status-inprogress">
                  <span className="lp-ping-wrapper" aria-hidden="true">
                    <span className="lp-ping-ring" />
                    <span className="lp-ping-dot" />
                  </span>
                  Đang học
                </span>
              )}
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              className="lp-modal-close-btn"
              onClick={onClose}
              aria-label="Đóng cửa sổ chi tiết khóa học"
            >
              <X size={20} />
            </button>
          </div>

          <h2 id="lp-modal-title" className="lp-modal-title">
            {course.title}
          </h2>
          {course.description ? <p className="lp-modal-description">{course.description}</p> : null}
        </div>

        <div className="lp-modal-body">
          <div className="lp-modal-stats-row">
            <div className="lp-modal-stat-col">
              <BookOpen size={20} className="lp-stat-icon-blue" />
              <div className="lp-stat-info">
                <span className="lp-stat-value">
                  {completedModules} / {totalModules}
                </span>
                <span className="lp-stat-label">Modules hoàn thành</span>
              </div>
            </div>

            <div className="lp-modal-stat-col">
              <Clock size={20} className="lp-stat-icon-blue" />
              <div className="lp-stat-info">
                <span className="lp-stat-value">{formatHours(course.estimatedHours)}</span>
                <span className="lp-stat-label">Từ thời lượng video</span>
              </div>
            </div>

            <div className="lp-modal-stat-col">
              <Award size={20} className="lp-stat-icon-amber" />
              <div className="lp-stat-info">
                <span className="lp-stat-value">{course.badgeName || 'Chưa thiết lập'}</span>
                <span className="lp-stat-label">Huy hiệu chặng</span>
              </div>
            </div>
          </div>

          <div className="lp-modal-progress-section">
            <div className="lp-progress-labels">
              <span className="lp-progress-title">Tiến độ chặng</span>
              <span
                className={`lp-progress-percentage ${
                  isCompleted ? 'lp-progress-percent-green' : 'lp-progress-percent-blue'
                }`}
              >
                {progressPercent}%
              </span>
            </div>
            <div
              className="lp-progress-track"
              role="progressbar"
              aria-label={`Tiến độ ${course.title}`}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={progressPercent}
            >
              <div
                className={`lp-progress-fill ${isCompleted ? 'lp-fill-green' : 'lp-fill-blue'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {isLocked ? (
            <div className="lp-modal-alert lp-alert-locked" role="alert">
              <Lock size={18} className="lp-alert-icon" />
              <div>
                <strong>Khóa học đang bị khóa</strong>
                <p>{course.lockedReason || 'Hãy hoàn thành chặng tiên quyết để mở khóa.'}</p>
              </div>
            </div>
          ) : null}

          <div className="lp-modal-skills-section">
            <h3 className="lp-section-heading">Kỹ năng trọng tâm</h3>
            {skills.length > 0 ? (
              <div className="lp-skills-wrap">
                {skills.map((skill, index) => (
                  <span key={`${skill}-${index}`} className="lp-skill-pill">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="lp-modal-empty">Admin chưa cập nhật kỹ năng trọng tâm.</p>
            )}
          </div>

          <div className="lp-modal-curriculum-section">
            <div className="lp-curriculum-header">
              <h3 className="lp-section-heading">
                Danh sách module học tập ({completedModules}/{totalModules})
              </h3>
            </div>

            {modules.length > 0 ? (
              <div className="lp-modules-scroll-list">
                {modules.map((module, index) => {
                  const moduleCompleted = module.status === 'completed' || module.completed;
                  const moduleLocked =
                    isLocked || module.status === 'locked' || module.canAccess === false;
                  const hasTarget = Boolean(getModuleTarget(course.id, module, moduleCompleted));
                  const lessonSummary = `${module.completedLessons || 0}/${
                    module.totalLessons || 0
                  } bài`;
                  const labSummary = module.totalLabs
                    ? ` · ${module.completedLabs || 0}/${module.totalLabs} lab`
                    : '';

                  return (
                    <button
                      key={module.id || index}
                      type="button"
                      className={`lp-clone-module-card ${
                        moduleCompleted
                          ? 'lp-mod-card-checked'
                          : moduleLocked
                            ? 'lp-mod-card-locked'
                            : 'lp-mod-card-unchecked'
                      }`}
                      onClick={() => handleOpenModule(module)}
                      disabled={moduleLocked || !hasTarget}
                      aria-label={`Module ${index + 1}: ${module.title}, ${
                        moduleCompleted ? 'Đã hoàn thành' : moduleLocked ? 'Đang khóa' : 'Đang học'
                      }`}
                    >
                      <span className="lp-module-left">
                        <span className="lp-module-status-icon" aria-hidden="true">
                          {moduleCompleted ? (
                            <CheckCircle2 size={20} />
                          ) : moduleLocked ? (
                            <Lock size={18} />
                          ) : (
                            <BookOpen size={19} />
                          )}
                        </span>
                        <span className="lp-module-num">#{index + 1}</span>
                        <span className="lp-module-title-col">
                          <span className="lp-module-name">{module.title}</span>
                          <span className="lp-module-content-summary">
                            {lessonSummary}
                            {labSummary}
                          </span>
                          {Array.isArray(module.labs) && module.labs.length > 0 ? (
                            <span className="lp-module-labs-sub">
                              {module.labs.map((lab) => (
                                <span key={lab.id} className="lp-sub-lab-badge">
                                  {lab.title}
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      {module.duration ? (
                        <span className="lp-module-right">
                          <span className="lp-module-duration">{module.duration}</span>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="lp-modal-empty">Khóa học chưa có module được xuất bản.</p>
            )}
          </div>
        </div>

        <div className="lp-modal-footer">
          <div className="lp-footer-right">
            <button type="button" className="lp-btn-close" onClick={onClose}>
              Đóng
            </button>
            {isLocked && course.prerequisiteId ? (
              <button type="button" className="lp-btn-action-primary" onClick={handleContinue}>
                Xem chặng tiên quyết
              </button>
            ) : isCompleted ? (
              <button type="button" className="lp-btn-action-primary" onClick={handleReview}>
                Ôn tập lại chặng này
              </button>
            ) : !isLocked ? (
              <button type="button" className="lp-btn-action-primary" onClick={handleContinue}>
                Tiếp tục vào bài học
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDetailModal;
