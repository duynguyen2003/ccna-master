/**
 * Adapter chuẩn hóa DTO Learning Path từ Backend.
 *
 * NGUYÊN TẮC QUAN TRỌNG:
 * - Giữ nguyên status ('completed' | 'current' | 'locked'), canAccess, lockedReason từ server.
 * - KHÔNG tính lại nghiệp vụ, KHÔNG ghi đè quyền hoặc tiến độ của server.
 * - Chỉ fallback an toàn khi dữ liệu null/undefined/sai kiểu để UI không bị crash.
 */

const VALID_STATUSES = new Set(['completed', 'current', 'locked']);
const VALID_ICON_TYPES = new Set(['network', 'switching', 'enterprise', 'security', 'automation']);

const normalizeCourseTitle = (value) =>
  String(value || '')
    .replace(/\s*\(updated\)\s*$/i, '')
    .trim();

const inferIconType = (code, index) => {
  const upper = String(code || '').toUpperCase();
  if (upper.includes('ITN') || upper.includes('INTRO')) return 'network';
  if (upper.includes('SRWE') || upper.includes('SWIT')) return 'switching';
  if (upper.includes('ENSA') || upper.includes('ENTER')) return 'enterprise';
  if (upper.includes('SEC')) return 'security';
  if (upper.includes('AUTO') || upper.includes('DEVNET')) return 'automation';

  const defaultCycle = ['network', 'switching', 'enterprise', 'security', 'automation'];
  return defaultCycle[index % defaultCycle.length];
};

/**
 * Chuẩn hóa một bài học (Lesson)
 */
export const normalizeLesson = (raw = {}) => {
  const id = typeof raw.id === 'number' ? raw.id : parseInt(raw.id, 10) || 0;
  return {
    id,
    title: String(raw.title || `Bài học ${id || ''}`),
    orderIndex: typeof raw.orderIndex === 'number' ? raw.orderIndex : 0,
    videoDuration: raw.videoDuration ? String(raw.videoDuration) : null,
    progressPercent: Math.max(0, Math.min(100, Math.floor(raw.progressPercent || 0))),
    completed: Boolean(raw.completed),
  };
};

/**
 * Chuẩn hóa một bài thực hành (Lab)
 */
export const normalizeLab = (raw = {}) => {
  const id = typeof raw.id === 'number' ? raw.id : parseInt(raw.id, 10) || 0;
  return {
    id,
    title: String(raw.title || `Lab ${id || ''}`),
    moduleId: raw.moduleId != null ? String(raw.moduleId) : null,
    labType: raw.labType === 'CLI_SIMULATION' ? 'CLI_SIMULATION' : 'PACKET_TRACER',
    progressPercent: Math.max(0, Math.min(100, Math.floor(raw.progressPercent || 0))),
    completed: Boolean(raw.completed),
  };
};

/**
 * Chuẩn hóa một chương học (Module)
 */
export const normalizeModule = (raw = {}, fallbackIndex = 0) => {
  const id = String(raw.id != null ? raw.id : `m-${fallbackIndex}`);
  const status = VALID_STATUSES.has(raw.status) ? raw.status : 'locked';
  const lessons = Array.isArray(raw.lessons) ? raw.lessons.map(normalizeLesson) : [];
  const labs = Array.isArray(raw.labs) ? raw.labs.map(normalizeLab) : [];

  const totalLessons = typeof raw.totalLessons === 'number' ? raw.totalLessons : lessons.length;
  const completedLessons =
    typeof raw.completedLessons === 'number'
      ? raw.completedLessons
      : lessons.filter((l) => l.completed).length;
  const totalLabs = typeof raw.totalLabs === 'number' ? raw.totalLabs : labs.length;
  const completedLabs =
    typeof raw.completedLabs === 'number'
      ? raw.completedLabs
      : labs.filter((l) => l.completed).length;

  const totalItems = typeof raw.totalItems === 'number' ? raw.totalItems : totalLessons + totalLabs;
  const completedItems =
    typeof raw.completedItems === 'number' ? raw.completedItems : completedLessons + completedLabs;

  return {
    id,
    title: String(raw.title || `Chương ${fallbackIndex + 1}`),
    description: String(raw.description || ''),
    orderIndex: typeof raw.orderIndex === 'number' ? raw.orderIndex : fallbackIndex,
    lessons,
    labs,
    totalLessons,
    completedLessons,
    totalLabs,
    completedLabs,
    totalItems,
    completedItems,
    completed: Boolean(raw.completed),
    progressPercent: Math.max(0, Math.min(100, Math.floor(raw.progressPercent || 0))),
    estimatedMinutes: typeof raw.estimatedMinutes === 'number' ? raw.estimatedMinutes : null,
    duration: raw.duration ? String(raw.duration) : null,
    nextLessonId: raw.nextLessonId != null ? Number(raw.nextLessonId) : null,
    status,
    canAccess: raw.canAccess !== undefined ? Boolean(raw.canAccess) : status !== 'locked',
    lockedReason: raw.lockedReason ? String(raw.lockedReason) : null,
  };
};

/**
 * Chuẩn hóa một khóa học (Course)
 */
export const normalizeCourse = (raw = {}, index = 0) => {
  const id = String(raw.id != null ? raw.id : `course-${index}`);
  const status = VALID_STATUSES.has(raw.status) ? raw.status : 'locked';
  const iconType = VALID_ICON_TYPES.has(raw.iconType)
    ? raw.iconType
    : inferIconType(raw.code, index);

  const modules = Array.isArray(raw.modules)
    ? raw.modules.map((m, mIdx) => normalizeModule(m, mIdx))
    : [];

  const labs = Array.isArray(raw.labs) ? raw.labs.map(normalizeLab) : [];

  const totalModules = typeof raw.totalModules === 'number' ? raw.totalModules : modules.length;
  const completedModules =
    typeof raw.completedModules === 'number'
      ? raw.completedModules
      : modules.filter((m) => m.completed).length;

  const totalLessons =
    typeof raw.totalLessons === 'number'
      ? raw.totalLessons
      : modules.reduce((sum, m) => sum + m.totalLessons, 0);
  const completedLessons =
    typeof raw.completedLessons === 'number'
      ? raw.completedLessons
      : modules.reduce((sum, m) => sum + m.completedLessons, 0);

  const totalLabs = typeof raw.totalLabs === 'number' ? raw.totalLabs : labs.length;
  const completedLabs =
    typeof raw.completedLabs === 'number'
      ? raw.completedLabs
      : labs.filter((l) => l.completed).length;

  const totalItems = typeof raw.totalItems === 'number' ? raw.totalItems : totalLessons + totalLabs;
  const completedItems =
    typeof raw.completedItems === 'number' ? raw.completedItems : completedLessons + completedLabs;

  return {
    id,
    code: String(raw.code || '').trim(),
    title: normalizeCourseTitle(raw.title) || `Khóa học ${index + 1}`,
    description: String(raw.description || '').trim(),
    thumbnailUrl: raw.thumbnailUrl ? String(raw.thumbnailUrl) : null,
    orderIndex: typeof raw.orderIndex === 'number' ? raw.orderIndex : index,
    publicationStatus: String(raw.publicationStatus || 'PUBLISHED'),
    prerequisiteId: raw.prerequisiteId != null ? String(raw.prerequisiteId) : null,
    prerequisiteTitle: raw.prerequisiteTitle ? String(raw.prerequisiteTitle) : null,
    status,
    canAccess: raw.canAccess !== undefined ? Boolean(raw.canAccess) : status !== 'locked',
    lockedReason: raw.lockedReason ? String(raw.lockedReason) : null,
    iconType,
    modules,
    labs,
    totalModules,
    completedModules,
    totalLessons,
    completedLessons,
    totalLabs,
    completedLabs,
    totalItems,
    completedItems,
    completed: Boolean(raw.completed),
    progressPercent: Math.max(0, Math.min(100, Math.floor(raw.progressPercent || 0))),
    estimatedHours: typeof raw.estimatedHours === 'number' ? raw.estimatedHours : null,
    skills: Array.isArray(raw.skills)
      ? raw.skills.map((s) => String(s).trim()).filter(Boolean)
      : [],
    badgeName: raw.badgeName ? String(raw.badgeName).trim() : null,
    examCode: raw.examCode ? String(raw.examCode).trim() : null,
    contentReady: raw.contentReady !== undefined ? Boolean(raw.contentReady) : true,
    isStarted: Boolean(raw.isStarted || (raw.progressPercent && raw.progressPercent > 0)),
    nextModuleId: raw.nextModuleId != null ? String(raw.nextModuleId) : null,
    nextLessonId: raw.nextLessonId != null ? Number(raw.nextLessonId) : null,
  };
};

/**
 * Chuẩn hóa toàn bộ DTO Learning Path
 */
export const normalizeLearningPath = (raw = {}) => {
  const data = raw?.data || raw || {};

  const courses = Array.isArray(data.courses)
    ? data.courses.map((c, idx) => normalizeCourse(c, idx))
    : [];

  const rawStats = data.stats || {};
  const stats = {
    streakDays: Math.max(0, Math.floor(Number(rawStats.streakDays) || 0)),
    xp: Math.max(0, Math.floor(Number(rawStats.xp) || 0)),
    badges: Math.max(0, Math.floor(Number(rawStats.badges) || 0)),
    overallProgress: Math.max(0, Math.min(100, Math.floor(Number(rawStats.overallProgress) || 0))),
  };

  let currentCourseId = data.currentCourseId != null ? String(data.currentCourseId) : null;

  // Nếu backend không trả currentCourseId hoặc là null, tìm course có status === 'current'
  if (!currentCourseId && courses.length > 0) {
    const currentCourse = courses.find((c) => c.status === 'current');
    if (currentCourse) {
      currentCourseId = currentCourse.id;
    }
  }

  return {
    courses,
    stats,
    currentCourseId,
  };
};
