import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useLearningPath from '../../features/courses/hooks/useLearningPath';
import './LearningResumeBanner.css';

const LearningResumeContent = () => {
  const { courses, currentCourseId, stats, learningPath, isLoading, isError, refetch } =
    useLearningPath();

  if (isLoading && !learningPath) {
    return null;
  }
  if (isError) {
    return (
      <section className="learning-resume learning-resume--error" aria-label="Tiến độ học tập">
        <p role="status">Chưa tải được tiến độ học.</p>
        <button className="learning-resume__action" type="button" onClick={() => refetch()}>
          Thử lại
        </button>
      </section>
    );
  }
  if (!courses.length) return null;
  const hasLearningActivity = courses.some(
    (item) => item.isStarted || item.completed || item.progressPercent > 0
  );
  if (!hasLearningActivity) return null;

  const completedCount = courses.filter((course) => course.completed).length;
  const allCompleted = completedCount === courses.length;
  const course =
    courses.find((item) => item.id === currentCourseId && item.canAccess && !item.completed) ||
    courses.find((item) => item.canAccess && !item.completed);
  const nextModule = course?.modules.find(
    (module) =>
      module.canAccess && module.lessons.some((lesson) => lesson.id === course.nextLessonId)
  );
  // The server can return a completed lesson when only labs remain. Open the
  // course in that case, rather than presenting that lesson as unfinished.
  const nextLesson = nextModule?.lessons.find(
    (lesson) => lesson.id === course.nextLessonId && !lesson.completed
  );
  const progress = allCompleted ? 100 : (course?.progressPercent ?? stats.overallProgress);
  const started = course?.isStarted;
  const title = allCompleted
    ? 'Bạn đã hoàn thành lộ trình CCNA'
    : course?.title || 'Lộ trình học CCNA';
  const destination = nextLesson
    ? `/lesson?${new URLSearchParams({ course: course.id, lesson: nextLesson.id })}`
    : course
      ? `/course/${encodeURIComponent(course.id)}?from=resume`
      : '/roadmap';
  const action = allCompleted
    ? 'Ôn tập lộ trình'
    : course
      ? started
        ? 'Tiếp tục học'
        : 'Bắt đầu học'
      : 'Xem lộ trình';

  return (
    <section className="learning-resume" aria-label="Tiến độ học tập">
      <div
        className="learning-resume__percent"
        role="progressbar"
        aria-label={allCompleted ? 'Tiến độ lộ trình' : `Tiến độ ${title}`}
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {progress}%
      </div>
      <div className="learning-resume__content">
        <strong className="learning-resume__title">{title}</strong>
        <div className="learning-resume__details">
          {nextLesson ? (
            <span className="learning-resume__lesson" title={nextLesson.title}>
              Bài tiếp: {nextLesson.title}
            </span>
          ) : (
            <span>
              {allCompleted
                ? 'Sẵn sàng ôn tập và luyện thi'
                : course
                  ? 'Xem nội dung khóa học'
                  : 'Chọn chặng học phù hợp'}
            </span>
          )}
          <span className="learning-resume__count">
            {completedCount}/{courses.length} khóa học hoàn thành
          </span>
          {stats.streakDays > 0 && (
            <span className="learning-resume__streak">Chuỗi {stats.streakDays} ngày</span>
          )}
        </div>
      </div>
      <Link className="learning-resume__action" to={destination}>
        {action}
      </Link>
    </section>
  );
};

const LearningResumeBanner = () => {
  const { isAuthenticated, loading, token } = useAuth();
  const { pathname } = useLocation();
  const showOnRoute = /^\/(?:roadmap\/?)?$/.test(pathname);

  if (loading || !isAuthenticated || !token || !showOnRoute) return null;
  return <LearningResumeContent />;
};

export default LearningResumeBanner;
