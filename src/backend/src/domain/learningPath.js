// The roadmap and the legacy course API share these calculations. Summary
// UserProgress rows are projections, never evidence that a task was completed.
const XP_REWARDS = Object.freeze({ lesson: 10, lab: 50, module: 25, course: 100 });
const PUBLISHED_STATUSES = ['PUBLISHED', 'OPEN'];

const clampProgress = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 0;
};
const compareOrder = (a, b) =>
  (a.orderIndex || 0) - (b.orderIndex || 0) || String(a.id).localeCompare(String(b.id), 'en');
const durationSeconds = (value) => {
  if (!value || !/^\d+:\d{2}(:\d{2})?$/.test(value)) return 0;
  const parts = value.split(':').map(Number);
  if (parts.slice(1).some((part) => part > 59)) return 0;
  return parts.reduce((seconds, part) => seconds * 60 + part, 0);
};
const progressKey = (courseId, kind, id) => `${courseId}:${kind}:${id}`;

function computeCourseStatuses(rawCourses) {
  const completedIds = new Set(
    rawCourses.filter((course) => clampProgress(course.progressPercent) === 100).map((c) => c.id)
  );
  let hasCurrent = false;
  return rawCourses.map((course) => {
    const progressPercent = clampProgress(course.progressPercent);
    let status = 'locked';
    if (progressPercent === 100) status = 'completed';
    else if (!hasCurrent && (!course.prerequisiteId || completedIds.has(course.prerequisiteId))) {
      status = 'current';
      hasCurrent = true;
    }
    return { ...course, progressPercent, status };
  });
}

function buildProgressLookup(progress) {
  const lookup = new Map();
  for (const row of progress) {
    // Reject ambiguous legacy rows. Count distinct task IDs, not database rows.
    if (row.lessonId != null && row.labId != null) continue;
    const kind = row.lessonId != null ? 'lesson' : row.labId != null ? 'lab' : null;
    if (!kind) continue;
    const key = progressKey(row.courseId, kind, row.lessonId ?? row.labId);
    const percent = row.status === 'COMPLETED' ? 100 : clampProgress(row.progressPercent);
    lookup.set(key, Math.max(lookup.get(key) || 0, percent));
  }
  return lookup;
}

function summarizeItems(items, canComplete = true) {
  const totalItems = items.length;
  const completedItems = items.filter((item) => item.completed).length;
  const completed = canComplete && totalItems > 0 && completedItems === totalItems;
  // Never round an unfinished 99.9% course to 100 and unlock its successor.
  const progressPercent = completed
    ? 100
    : totalItems
      ? Math.min(
          99,
          Math.floor(items.reduce((sum, item) => sum + item.progressPercent, 0) / totalItems)
        )
      : 0;
  return { totalItems, completedItems, completed, progressPercent };
}

function buildLearningPath(catalog, progress = [], user = {}, badges = []) {
  const lookup = buildProgressLookup(progress);
  const ordered = [...catalog].sort(compareOrder);
  const task = (courseId, kind, item) => {
    const progressPercent = lookup.get(progressKey(courseId, kind, item.id)) || 0;
    return { ...item, progressPercent, completed: progressPercent === 100 };
  };

  const rawNodes = ordered.map((course, index) => {
    const rawModules = [...(course.modules || [])].filter((m) => !m.deletedAt).sort(compareOrder);
    const moduleIds = new Set(rawModules.map((m) => m.id));
    const labsById = new Map();
    for (const lab of [...(course.labs || []), ...rawModules.flatMap((m) => m.labs || [])]) {
      if (lab.deletedAt || !PUBLISHED_STATUSES.includes(lab.status)) continue;
      if (lab.courseId && lab.courseId !== course.id) continue;
      if (lab.moduleId && !moduleIds.has(lab.moduleId)) continue;
      labsById.set(
        lab.id,
        task(course.id, 'lab', {
          id: lab.id,
          title: lab.title,
          moduleId: lab.moduleId || null,
          labType: lab.labType,
        })
      );
    }
    const labs = [...labsById.values()].sort((a, b) => a.id - b.id);
    const modules = rawModules.map((module) => {
      const lessons = [...(module.lessons || [])]
        .filter((lesson) => !lesson.deletedAt)
        .sort(compareOrder)
        .map((lesson) =>
          task(course.id, 'lesson', {
            id: lesson.id,
            title: lesson.title,
            videoDuration: lesson.videoDuration || null,
            orderIndex: lesson.orderIndex,
          })
        );
      const moduleLabs = labs.filter((lab) => lab.moduleId === module.id);
      const seconds = lessons.reduce(
        (sum, lesson) => sum + durationSeconds(lesson.videoDuration),
        0
      );
      return {
        id: module.id,
        title: module.title,
        description: module.description || '',
        orderIndex: module.orderIndex,
        lessons,
        labs: moduleLabs,
        ...summarizeItems([...lessons, ...moduleLabs]),
        totalLessons: lessons.length,
        completedLessons: lessons.filter((l) => l.completed).length,
        totalLabs: moduleLabs.length,
        completedLabs: moduleLabs.filter((l) => l.completed).length,
        estimatedMinutes: seconds ? Math.ceil(seconds / 60) : null,
        duration: seconds ? `${Math.ceil(seconds / 60)} phút` : null,
        nextLessonId: (lessons.find((l) => !l.completed) || lessons[0])?.id || null,
      };
    });
    const lessons = modules.flatMap((module) => module.lessons);
    const contentReady = modules.every((m) => m.totalItems > 0) && lessons.length + labs.length > 0;
    const summary = summarizeItems(
      [...lessons, ...labs],
      contentReady && modules.every((m) => m.completed)
    );
    const seconds = lessons.reduce((sum, lesson) => sum + durationSeconds(lesson.videoDuration), 0);
    const iconType = {
      ITN: 'network',
      SRW: 'switching',
      SRWE: 'switching',
      ENA: 'enterprise',
      ENSA: 'enterprise',
    };
    return {
      id: course.id,
      code: course.code,
      title: course.title,
      description: course.description || '',
      thumbnailUrl: course.thumbnailUrl || null,
      orderIndex: course.orderIndex,
      publicationStatus: course.status,
      prerequisiteId: ordered[index - 1]?.id || null,
      prerequisiteTitle: ordered[index - 1]?.title || null,
      iconType: iconType[course.code] || 'network',
      ...summary,
      contentReady,
      modules,
      labs,
      totalModules: modules.length,
      completedModules: modules.filter((m) => m.completed).length,
      totalLessons: lessons.length,
      completedLessons: lessons.filter((l) => l.completed).length,
      totalLabs: labs.length,
      completedLabs: labs.filter((l) => l.completed).length,
      estimatedHours: seconds ? Math.round(seconds / 360) / 10 : null,
      skills: [...(course.topics || [])].sort(compareOrder).map((topic) => topic.title),
      badgeName: `CCNA: ${course.id}`,
      examCode: (course.exams || []).find((exam) => exam.examCode)?.examCode || null,
      isStarted: progress.some((row) => row.courseId === course.id),
    };
  });

  const courses = computeCourseStatuses(rawNodes).map((course) => {
    const lockedReason =
      course.status === 'locked'
        ? `Hoàn thành ${course.prerequisiteTitle || 'chặng học hiện tại'} để mở khóa chặng này.`
        : null;
    let previousCompleted = true;
    let previousTitle = null;
    const modules = course.modules.map((module) => {
      const canAccess = course.status !== 'locked' && (module.completed || previousCompleted);
      const status = module.completed ? 'completed' : canAccess ? 'current' : 'locked';
      const reason = !canAccess
        ? lockedReason || `Hoàn thành ${previousTitle} để mở khóa chương này.`
        : null;
      if (!module.completed) previousTitle = previousTitle || module.title;
      previousCompleted = previousCompleted && module.completed;
      return { ...module, status, canAccess, lockedReason: reason };
    });
    const nextModule =
      modules.find((m) => m.status === 'current') || (course.completed ? modules[0] : null);
    return {
      ...course,
      modules,
      lockedReason,
      canAccess: course.status !== 'locked',
      nextModuleId: nextModule?.id || null,
      nextLessonId: nextModule?.nextLessonId || null,
    };
  });
  const totalItems = courses.reduce((sum, course) => sum + course.totalItems, 0);
  const sumProgress = courses.reduce(
    (sum, course) => sum + course.progressPercent * course.totalItems,
    0
  );
  const allComplete = courses.length > 0 && courses.every((course) => course.completed);
  const xp = courses.reduce(
    (sum, course) =>
      sum +
      course.completedLessons * XP_REWARDS.lesson +
      course.completedLabs * XP_REWARDS.lab +
      course.completedModules * XP_REWARDS.module +
      (course.completed ? XP_REWARDS.course : 0),
    0
  );
  return {
    courses,
    stats: {
      streakDays: Math.max(0, Math.trunc(Number(user.streak) || 0)),
      xp,
      badges: badges.length,
      overallProgress: allComplete
        ? 100
        : totalItems
          ? Math.min(99, Math.floor(sumProgress / totalItems))
          : 0,
    },
    currentCourseId: courses.find((course) => course.status === 'current')?.id || null,
  };
}

module.exports = {
  XP_REWARDS,
  PUBLISHED_STATUSES,
  clampProgress,
  compareOrder,
  durationSeconds,
  computeCourseStatuses,
  buildProgressLookup,
  buildLearningPath,
};
