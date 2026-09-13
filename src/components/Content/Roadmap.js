import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, LogIn, RefreshCw, Server, Lock, Monitor, Smartphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/Api';
import { useLearningPath } from '../../hooks/useLearningPath';
import { useLearningProgress } from '../../hooks/useLearningProgress';
import { usePathLayout } from '../../hooks/usePathLayout';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { calculateZigzagPositions, generatePathSegments } from '../../utils/learningPathGeometry';
import { normalizeCourse } from '../../utils/learningPathAdapter';

import LearningStats from './learningPath/LearningStats';
import LearningPathMap from './learningPath/LearningPathMap';
import CourseDetailModal from './learningPath/CourseDetailModal';
import LearningPathSkeleton from './learningPath/LearningPathSkeleton';

import errorIllustration from '../../image/fix1.png';
import '../../css/Roadmap.css';

const LAYOUT_OPTIONS = [
  { value: 'auto', label: 'Tự động' },
  { value: 'horizontal', label: 'Ngang', icon: Monitor },
  { value: 'vertical', label: 'Dọc', icon: Smartphone },
];

export const getAdminUnlockCandidate = (courses = []) => {
  if (!Array.isArray(courses) || courses.length < 2) return null;

  let fromIndex = -1;
  for (let index = 0; index < courses.length - 1; index += 1) {
    if (courses[index].status === 'completed') fromIndex = index;
  }

  if (fromIndex < 0) {
    const currentIndex = courses.findIndex((course) => course.status === 'current');
    fromIndex = currentIndex > 0 ? currentIndex - 1 : 0;
  }

  return {
    changed: true,
    courseCompleted: true,
    courseId: courses[fromIndex].id,
    unlockedCourseId: courses[fromIndex + 1].id,
    isAdminPreview: true,
  };
};

export const getLearnerUnlockCandidate = (courses = []) => {
  if (!Array.isArray(courses) || courses.length < 2) return null;

  for (let index = courses.length - 2; index >= 0; index -= 1) {
    const completedCourse = courses[index];
    const nextCourse = courses[index + 1];
    const nextCourseNotStarted = !nextCourse.isStarted && (nextCourse.progressPercent || 0) === 0;
    if (
      completedCourse.status === 'completed' &&
      nextCourse.status === 'current' &&
      nextCourseNotStarted
    ) {
      return {
        changed: true,
        courseCompleted: true,
        courseId: completedCourse.id,
        unlockedCourseId: nextCourse.id,
        xpAwarded: 0,
        isSnapshotUnlock: true,
        timestamp: `snapshot-${completedCourse.id}-${nextCourse.id}`,
      };
    }
  }

  return null;
};

const unlockAcknowledgementKey = (userId, transition) =>
  `learning-path-unlock:${userId}:${transition.courseId}:${transition.unlockedCourseId}`;

const hasAcknowledgedUnlock = (userId, transition) => {
  if (!userId || !transition || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(unlockAcknowledgementKey(userId, transition)) === '1';
  } catch {
    return false;
  }
};

const acknowledgeUnlock = (userId, transition) => {
  if (!userId || !transition || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(unlockAcknowledgementKey(userId, transition), '1');
  } catch {
    // Storage có thể bị chặn; animation vẫn chạy trong phiên hiện tại.
  }
};

export const RoadmapOverview = ({
  completedCourses = 0,
  totalCourses = 0,
  layoutMode,
  onLayoutModeChange,
  unlockAction = null,
  adminTestAction = null,
}) => (
  <section className="lp-roadmap-overview" aria-labelledby="lp-roadmap-title">
    <div className="lp-overview-copy">
      <div className="lp-overview-title-row">
        <h1 id="lp-roadmap-title" className="lp-overview-title">
          Lộ trình học tập CCNA
        </h1>
        {totalCourses > 0 ? (
          <span className="lp-overview-progress">
            ({completedCourses}/{totalCourses} chặng hoàn thành)
          </span>
        ) : null}
      </div>
      <p className="lp-overview-description">
        Các chặng học được bố trí zigzag tuần tự uốn lượn. Bạn cần hoàn thành chặng trước để mở khóa
        chặng tiếp theo.
      </p>
    </div>

    <div className="lp-overview-controls">
      <div className="lp-layout-switch" role="group" aria-label="Hướng hiển thị lộ trình">
        {LAYOUT_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            className={`lp-layout-option ${layoutMode === value ? 'is-active' : ''}`}
            aria-pressed={layoutMode === value}
            onClick={() => onLayoutModeChange(value)}
          >
            {Icon ? <Icon size={15} aria-hidden="true" /> : null}
            {label}
          </button>
        ))}
      </div>

      {unlockAction || adminTestAction ? (
        <div className="lp-unlock-actions">
          {unlockAction ? (
            <button type="button" className="lp-unlock-button" onClick={unlockAction.onClick}>
              <Sparkles size={16} aria-hidden="true" />
              {unlockAction.label}
            </button>
          ) : null}
          {adminTestAction ? (
            <button
              type="button"
              className="lp-unlock-button lp-unlock-button-admin"
              onClick={adminTestAction.onClick}
              disabled={adminTestAction.disabled}
              title={
                adminTestAction.disabled ? 'Cần ít nhất hai chặng để chạy hiệu ứng' : undefined
              }
            >
              <Sparkles size={16} aria-hidden="true" />
              {adminTestAction.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  </section>
);

export const Roadmap = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const reducedMotion = useReducedMotion();

  // ── 1. Learning Path Data từ Server ──
  const {
    courses: authCourses,
    stats: authStats,
    currentCourseId: authCurrentCourseId,
    isLoading: isPathLoading,
    isFetching: isPathFetching,
    isError: isPathError,
    error: pathError,
    refetch,
    isColdStarting,
  } = useLearningPath();

  const { consumeTransitionEvent, peekTransitionEvent } = useLearningProgress();

  // ── 2. Guest Preview Query (nếu chưa đăng nhập) ──
  const guestQuery = useQuery({
    queryKey: ['courses', 'guest'],
    queryFn: async () => {
      const list = await api.getCourses();
      return (list || []).map((c, idx) => {
        // Mock trạng thái hiển thị an toàn cho khách: chặng 1 preview, các chặng sau khóa
        const status = idx === 0 ? 'current' : 'locked';
        return normalizeCourse(
          {
            ...c,
            status,
            canAccess: idx === 0,
            lockedReason: idx > 0 ? 'Vui lòng đăng nhập để mở khóa chặng này' : null,
            progressPercent: 0,
          },
          idx
        );
      });
    },
    enabled: !authLoading && !isAuthenticated,
    staleTime: 60_000,
  });

  // Xác định danh sách course và stats thực tế
  const courses = useMemo(
    () => (isAuthenticated ? authCourses : guestQuery.data || []),
    [isAuthenticated, authCourses, guestQuery.data]
  );
  const stats = isAuthenticated
    ? authStats
    : { streakDays: 0, xp: 0, badges: 0, overallProgress: 0 };
  const currentCourseId = isAuthenticated ? authCurrentCourseId : courses[0]?.id || null;
  const isAdmin = user?.role === 'ADMIN';
  const [pendingUnlockTransition, setPendingUnlockTransition] = useState(null);
  const [unlockTransition, setUnlockTransition] = useState(null);
  const adminUnlockRunRef = useRef(0);
  const preparedTransitionRef = useRef(null);

  const adminUnlockCandidate = useMemo(
    () => (isAdmin ? getAdminUnlockCandidate(courses) : null),
    [isAdmin, courses]
  );

  const displayCourses = useMemo(() => {
    return courses.map((course) => {
      if (pendingUnlockTransition?.unlockedCourseId === course.id) {
        return {
          ...course,
          status: 'locked',
          canAccess: false,
          lockedReason: 'Bấm “Mở khóa chặng tiếp theo” để bắt đầu chặng này.',
        };
      }
      if (unlockTransition?.isAdminPreview && unlockTransition.courseId === course.id) {
        return { ...course, status: 'completed', progressPercent: 100 };
      }
      if (unlockTransition?.isAdminPreview && unlockTransition.unlockedCourseId === course.id) {
        return { ...course, status: 'current', canAccess: true, lockedReason: null };
      }
      return course;
    });
  }, [courses, pendingUnlockTransition, unlockTransition]);

  const displayCurrentCourseId = pendingUnlockTransition
    ? null
    : unlockTransition?.isAdminPreview
      ? unlockTransition.unlockedCourseId
      : currentCourseId;

  // ── 3. Layout Dimensions qua ResizeObserver ──
  const { containerRef, width } = usePathLayout();
  const [layoutMode, setLayoutMode] = useState('auto');

  // ── 4. Pure Geometry Engine tính toán tọa độ & Bezier curve ──
  const { nodes, canvasWidth, canvasHeight, isDesktop } = useMemo(() => {
    return calculateZigzagPositions({
      containerWidth: width,
      courses: displayCourses,
      layoutMode,
    });
  }, [width, displayCourses, layoutMode]);

  const segments = useMemo(() => {
    return generatePathSegments(nodes, isDesktop);
  }, [nodes, isDesktop]);

  // ── 5. Modal & Interaction State ──
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const activeTriggerRef = useRef(null);
  const [lockedNotice, setLockedNotice] = useState(null);
  const hasAutoScrolledRef = useRef(false);

  // Lookup course từ snapshot mới nhất để modal luôn hiển thị dữ liệu tươi
  const selectedCourse = useMemo(() => {
    if (!selectedCourseId) return null;
    return displayCourses.find((c) => c.id === selectedCourseId) || null;
  }, [displayCourses, selectedCourseId]);

  const handleSelectCourse = (course) => {
    setSelectedCourseId(course.id);
  };

  const handleLockedClick = (course) => {
    setLockedNotice({
      type: 'locked',
      title: course.title,
      reason: course.lockedReason || 'Khóa học này chưa mở. Bạn cần hoàn thành khóa học trước.',
    });
    // Vẫn cho mở modal để người học xem danh sách bài học/nhiệm vụ cần đạt
    setSelectedCourseId(course.id);
  };

  // ── 6. Xử lý One-time Transition Event từ học bài / làm lab ──
  useEffect(() => {
    if (!isAuthenticated) return;
    const storedTransition = peekTransitionEvent();
    if (storedTransition?.changed && !storedTransition.courseCompleted) {
      consumeTransitionEvent();
      return;
    }

    const transition =
      storedTransition?.changed && storedTransition.courseCompleted
        ? storedTransition
        : getLearnerUnlockCandidate(courses);
    if (!transition) return;

    if (!transition.unlockedCourseId) {
      consumeTransitionEvent();
      setLockedNotice({
        type: 'unlock-success',
        title: 'Chúc mừng bạn!',
        reason: `Bạn đã hoàn thành khóa học và nhận ${transition.xpAwarded || 0} XP.`,
      });
      return;
    }

    if (transition.isSnapshotUnlock && hasAcknowledgedUnlock(user?.id, transition)) return;

    const transitionKey = `${transition.courseId}:${transition.unlockedCourseId}:${
      transition.timestamp || ''
    }`;
    if (preparedTransitionRef.current === transitionKey) return;
    preparedTransitionRef.current = transitionKey;

    setLockedNotice({
      type: 'unlock-ready',
      title: 'Chúc mừng bạn!',
      reason: transition.isSnapshotUnlock
        ? 'Chặng trước đã hoàn thành 100%. Hãy bấm “Mở khóa chặng tiếp theo” để tiếp tục.'
        : `Bạn đã hoàn thành khóa học và nhận ${transition.xpAwarded || 0} XP. Hãy bấm “Mở khóa chặng tiếp theo” để tiếp tục.`,
    });
    setPendingUnlockTransition((current) => current || transition);
  }, [isAuthenticated, user?.id, courses, peekTransitionEvent, consumeTransitionEvent]);

  const handleStudentUnlock = useCallback(() => {
    if (!pendingUnlockTransition) return;
    const consumedTransition = consumeTransitionEvent() || pendingUnlockTransition;
    const unlockedCourse = courses.find(
      (course) => course.id === consumedTransition.unlockedCourseId
    );
    acknowledgeUnlock(user?.id, consumedTransition);
    setPendingUnlockTransition(null);
    setUnlockTransition({ ...consumedTransition, timestamp: Date.now() });
    setLockedNotice({
      type: 'unlock-success',
      title: unlockedCourse?.title || 'Chặng tiếp theo',
      reason: 'Đã mở khóa. Bạn có thể bắt đầu học ngay bây giờ.',
    });
  }, [pendingUnlockTransition, consumeTransitionEvent, courses, user?.id]);

  const handleAdminUnlockTest = useCallback(() => {
    if (!adminUnlockCandidate) return;
    adminUnlockRunRef.current += 1;
    setUnlockTransition({
      ...adminUnlockCandidate,
      timestamp: `admin-${adminUnlockRunRef.current}`,
    });
  }, [adminUnlockCandidate]);

  const handleUnlockAnimationComplete = useCallback(() => {
    setUnlockTransition(null);
  }, []);

  // ── 7. Auto-scroll tới Current Course khi layout sẵn sàng lần đầu ──
  useEffect(() => {
    if (hasAutoScrolledRef.current || !currentCourseId || nodes.length === 0) return;

    const currentNode = nodes.find((n) => n.id === currentCourseId);
    if (!currentNode) return;

    const scrollContainer = containerRef.current?.querySelector('.lp-map-scroll-viewport');
    if (!scrollContainer) return;

    // Desktop: cuộn ngang để đưa node vào giữa
    if (isDesktop) {
      const targetScrollLeft = Math.max(0, currentNode.x - scrollContainer.clientWidth / 2);
      scrollContainer.scrollTo({
        left: targetScrollLeft,
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    }

    hasAutoScrolledRef.current = true;
  }, [currentCourseId, nodes, isDesktop, reducedMotion, containerRef]);

  // ── 8. Render Loading / Error States ──
  const isLoading =
    authLoading || (isAuthenticated ? isPathLoading && !courses.length : guestQuery.isLoading);

  if (isLoading) {
    return (
      <div className="lp-page-wrapper">
        <div className="lp-container" ref={containerRef}>
          <RoadmapOverview layoutMode={layoutMode} onLayoutModeChange={setLayoutMode} />

          {/* Render Cold Start Notification */}
          {isColdStarting && (
            <div className="lp-banner lp-banner-cold-start" role="status">
              <div className="lp-banner-content">
                <Server size={18} />
                <span>
                  Máy chủ đang khởi động sau thời gian tạm nghỉ. Quá trình này có thể mất từ 10 đến
                  30 giây...
                </span>
              </div>
            </div>
          )}

          {/* Skeleton Match Geometry */}
          <LearningPathSkeleton isDesktop={isDesktop} />
        </div>
      </div>
    );
  }

  if (isAuthenticated && isPathError && !courses.length) {
    return (
      <div className="lp-page-wrapper">
        <div className="lp-container">
          <div className="lesson-error-container">
            <div className="lesson-error-card">
              <div className="lesson-error-illustration">
                <img src={errorIllustration} alt="Lỗi tải lộ trình" />
              </div>
              <h2 className="lesson-error-title">Không thể tải lộ trình học tập</h2>
              <p className="lesson-error-desc">
                {pathError?.message || 'Đã có lỗi xảy ra trong quá trình kết nối với máy chủ.'}
              </p>
              <div className="lesson-error-actions">
                <button type="button" className="btn-xem-lo-trinh" onClick={() => refetch()}>
                  <RefreshCw size={18} />
                  <span>Thử lại ngay</span>
                </button>
                <button type="button" className="btn-quay-lai" onClick={() => navigate('/')}>
                  <span>Về trang chủ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lp-page-wrapper">
      <div className="lp-container" ref={containerRef}>
        <RoadmapOverview
          completedCourses={courses.filter((course) => course.status === 'completed').length}
          totalCourses={courses.length}
          layoutMode={layoutMode}
          onLayoutModeChange={setLayoutMode}
          unlockAction={
            pendingUnlockTransition
              ? { label: 'Mở khóa chặng tiếp theo', onClick: handleStudentUnlock }
              : null
          }
          adminTestAction={
            isAdmin
              ? {
                  label: 'Admin: Test mở khóa',
                  onClick: handleAdminUnlockTest,
                  disabled: !adminUnlockCandidate,
                }
              : null
          }
        />

        <div className="lp-path-meta-row">
          <div className="lp-legend-container" aria-label="Chú thích trạng thái">
            <div className="lp-legend-item">
              <div className="lp-legend-dot lp-legend-dot-completed" />
              <span>Đã hoàn thành (100%)</span>
            </div>
            <div className="lp-legend-item">
              <div className="lp-legend-dot lp-legend-dot-current" />
              <span>Đang học (Bắt đầu tại đây)</span>
            </div>
            <div className="lp-legend-item">
              <div className="lp-legend-dot lp-legend-dot-locked" />
              <span>Đã khóa (Cần hoàn thành chặng trước)</span>
            </div>
          </div>
          <p className="lp-path-hint">
            * Bấm vào node đang học hoặc đã hoàn thành để xem chi tiết bài học
          </p>
        </div>

        {/* Guest Banner */}
        {!isAuthenticated && (
          <div className="lp-banner lp-banner-guest" role="region" aria-label="Chế độ khách">
            <div className="lp-banner-content">
              <Sparkles size={20} className="lp-icon-inline" />
              <div>
                <strong>Chế độ xem trước:</strong> Đăng nhập để lưu tiến độ học tập, tích lũy điểm
                XP và nhận huy hiệu CCNA khi hoàn thành.
              </div>
            </div>
            <button type="button" className="lp-banner-btn" onClick={() => navigate('/login')}>
              <LogIn size={15} /> Đăng nhập ngay
            </button>
          </div>
        )}

        {/* Cold Start Banner khi refetch nền lâu */}
        {isColdStarting && isPathFetching && (
          <div className="lp-banner lp-banner-cold-start" role="status">
            <div className="lp-banner-content">
              <Server size={18} />
              <span>Đang kết nối lại máy chủ... Vui lòng giữ kết nối.</span>
            </div>
          </div>
        )}

        {/* Thông báo khóa nhẹ nếu có */}
        {lockedNotice && (
          <div
            className={`lp-banner ${
              lockedNotice.type === 'locked' ? 'lp-banner-locked-notice' : 'lp-banner-unlock-ready'
            }`}
            role="alert"
          >
            <div className="lp-banner-content">
              <Lock size={18} />
              <span>
                <strong>{lockedNotice.title}:</strong> {lockedNotice.reason}
              </span>
            </div>
            <button
              type="button"
              className="lp-modal-close-btn"
              onClick={() => setLockedNotice(null)}
              aria-label="Đóng thông báo"
            >
              ×
            </button>
          </div>
        )}

        {/* Stats Bar */}
        <LearningStats stats={stats} />

        {/* Map Viewport Card */}
        <div className="lp-map-card">
          <LearningPathMap
            nodes={nodes}
            segments={segments}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            isDesktop={isDesktop}
            currentCourseId={displayCurrentCourseId}
            unlockTransition={unlockTransition}
            onUnlockAnimationComplete={handleUnlockAnimationComplete}
            onSelectCourse={handleSelectCourse}
            onLockedClick={handleLockedClick}
          />
        </div>

        {/* Course Detail Modal */}
        <CourseDetailModal
          course={selectedCourse}
          isOpen={Boolean(selectedCourse)}
          onClose={() => setSelectedCourseId(null)}
          triggerRef={activeTriggerRef}
        />
      </div>
    </div>
  );
};

export default Roadmap;
