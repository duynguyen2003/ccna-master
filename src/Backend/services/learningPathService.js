const { getPrisma } = require('../config/database');
const { buildLearningPath, clampProgress, PUBLISHED_STATUSES } = require('../domain/learningPath');

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const orderBy = [{ orderIndex: 'asc' }, { id: 'asc' }];
const visibleLabs = { deletedAt: null, status: { in: PUBLISHED_STATUSES } };
const labSelect = {
  id: true,
  title: true,
  courseId: true,
  moduleId: true,
  labType: true,
  status: true,
};

async function readCatalog(db, includeDrafts = false) {
  return db.course.findMany({
    where: { deletedAt: null, ...(includeDrafts ? {} : { status: { in: PUBLISHED_STATUSES } }) },
    orderBy,
    include: {
      modules: {
        where: { deletedAt: null },
        orderBy,
        include: {
          lessons: {
            where: { deletedAt: null },
            orderBy,
            select: {
              id: true,
              moduleId: true,
              title: true,
              videoDuration: true,
              sectionNumber: true,
              orderIndex: true,
            },
          },
          labs: { where: visibleLabs, select: labSelect },
          exams: {
            where: { deletedAt: null, status: 'OPEN' },
            include: { _count: { select: { questions: true } } },
          },
        },
      },
      labs: { where: visibleLabs, select: labSelect },
      topics: { orderBy },
      exams: { where: { deletedAt: null, status: 'OPEN' }, select: { id: true, examCode: true } },
    },
  });
}

async function readState(db, userId, includeDrafts = false) {
  // An interactive transaction owns one pg connection. Keep explicit queries
  // sequential instead of queueing concurrent work on that same connection.
  const user = userId
    ? await db.user.findUnique({
        where: { id: userId },
        select: { id: true, streak: true, isActive: true, deletedAt: true },
      })
    : {};
  if (userId && (!user || user.deletedAt))
    throw fail(401, 'USER_NOT_FOUND', 'Tài khoản không còn khả dụng.');
  if (userId && !user.isActive) throw fail(403, 'USER_INACTIVE', 'Tài khoản đã bị vô hiệu hóa.');
  const catalog = await readCatalog(db, includeDrafts);
  const progress = userId
    ? await db.userProgress.findMany({ where: { userId }, orderBy: { id: 'asc' } })
    : [];
  const badges = userId
    ? await db.userBadge.findMany({ where: { userId }, orderBy: { id: 'asc' } })
    : [];
  return {
    catalog,
    progress,
    user,
    badges,
    path: buildLearningPath(catalog, progress, user, badges),
  };
}

async function lockUser(db, userId) {
  if (!Number.isInteger(userId) || userId <= 0)
    throw fail(401, 'INVALID_IDENTITY', 'Phiên đăng nhập không hợp lệ.');
  // Same transaction-scoped lock as CLI grading, shared across Render replicas.
  await db.$queryRaw`SELECT pg_advisory_xact_lock(${userId}::int, 0::int)::text AS locked`;
}

const transaction = (userId, callback) =>
  getPrisma().$transaction(
    async (db) => {
      await lockUser(db, userId);
      return callback(db, await readState(db, userId));
    },
    { timeout: 15000, maxWait: 10000 }
  );

function assertAccess(course, module) {
  if (!course) throw fail(404, 'COURSE_NOT_FOUND', 'Không tìm thấy khóa học đã xuất bản.');
  if (!course.canAccess) throw fail(403, 'COURSE_LOCKED', course.lockedReason);
  if (module && !module.canAccess) throw fail(403, 'MODULE_LOCKED', module.lockedReason);
}

function findModule(state, moduleId) {
  for (const course of state.path.courses) {
    const module = course.modules.find((item) => item.id === moduleId);
    if (module) return { course, module };
  }
  throw fail(404, 'MODULE_NOT_FOUND', 'Không tìm thấy chương học.');
}

function findLesson(state, lessonId) {
  for (const course of state.path.courses) {
    for (const module of course.modules) {
      const lesson = module.lessons.find((item) => item.id === lessonId);
      if (lesson) return { course, module, lesson };
    }
  }
  throw fail(404, 'LESSON_NOT_FOUND', 'Không tìm thấy bài học.');
}

function findLab(state, labId) {
  for (const course of state.path.courses) {
    const lab = course.labs.find((item) => item.id === labId);
    if (lab) return { course, lab, module: course.modules.find((m) => m.id === lab.moduleId) };
  }
  throw fail(404, 'LAB_NOT_FOUND', 'Không tìm thấy Lab đã xuất bản trong khóa học.');
}

async function writeProgress(db, where, fields, now, monotonic = false) {
  const rows = await db.userProgress.findMany({ where, orderBy: { id: 'asc' } });
  const previous = Math.max(
    0,
    ...rows.map((row) => (row.status === 'COMPLETED' ? 100 : clampProgress(row.progressPercent)))
  );
  const percent = monotonic ? Math.max(previous, fields.progressPercent) : fields.progressPercent;
  const completed = percent === 100;
  const data = {
    ...fields,
    progressPercent: percent,
    status: completed ? 'COMPLETED' : 'ACTIVE',
    completedAt: completed ? rows.find((row) => row.completedAt)?.completedAt || now : null,
  };
  const changed =
    !rows.length ||
    rows.some(
      (row) =>
        row.progressPercent !== data.progressPercent ||
        row.status !== data.status ||
        (fields.moduleId !== undefined && row.moduleId !== fields.moduleId)
    );
  let record = rows[0];
  if (!record) record = await db.userProgress.create({ data: { ...where, ...data } });
  else if (changed || (completed && !record.completedAt)) {
    // Normalize legacy duplicates without deleting any user's historical rows.
    await db.userProgress.updateMany({ where, data });
    record = await db.userProgress.findUnique({ where: { id: record.id } });
  }
  return { record, changed, firstCompletion: completed && previous < 100 };
}

async function activity(db, userId, type, title, referenceId = null) {
  await db.userActivity.create({ data: { userId, type, title: title.slice(0, 200), referenceId } });
}

async function finishMutation(db, userId, before, courseId, moduleId, write, now) {
  const progress = await db.userProgress.findMany({ where: { userId }, orderBy: { id: 'asc' } });
  let path = buildLearningPath(before.catalog, progress, before.user, before.badges);
  const previousCourse = before.path.courses.find((course) => course.id === courseId);
  const course = path.courses.find((item) => item.id === courseId);
  for (const module of course.modules.filter((item) => item.id === moduleId)) {
    const started = progress.some(
      (row) =>
        row.courseId === courseId &&
        (row.moduleId === module.id ||
          module.lessons.some((lesson) => lesson.id === row.lessonId) ||
          module.labs.some((lab) => lab.id === row.labId))
    );
    if (started || module.completed) {
      await writeProgress(
        db,
        { userId, courseId, moduleId: module.id, lessonId: null, labId: null },
        { progressPercent: module.progressPercent },
        now
      );
    }
    if (
      module.completed &&
      !previousCourse.modules.find((item) => item.id === module.id)?.completed
    ) {
      await activity(db, userId, 'MODULE_COMPLETED', `Hoàn thành chương: ${module.title}`);
    }
  }
  const summary = await writeProgress(
    db,
    { userId, courseId, moduleId: null, lessonId: null, labId: null },
    { progressPercent: course.progressPercent },
    now
  );
  const courseCompleted = course.completed && !previousCourse.completed;
  const badgesAwarded = [];
  if (course.completed && !before.badges.some((badge) => badge.badgeName === course.badgeName)) {
    const badge = await db.userBadge.create({
      data: { userId, badgeName: course.badgeName, badgeIcon: 'workspace_premium' },
    });
    badgesAwarded.push(badge);
  }
  if (courseCompleted)
    await activity(db, userId, 'COURSE_COMPLETED', `Hoàn thành khóa học: ${course.title}`);
  path = buildLearningPath(before.catalog, progress, before.user, [
    ...before.badges,
    ...badgesAwarded,
  ]);
  const unlocked = path.courses.find(
    (item) =>
      item.status === 'current' &&
      before.path.courses.find((previous) => previous.id === item.id)?.status === 'locked'
  );
  const module = course.modules.find((item) => item.id === moduleId);
  const previousModule = previousCourse.modules.find((item) => item.id === moduleId);
  return {
    record:
      write?.record && (write.record.lessonId || write.record.labId || write.record.moduleId)
        ? write.record
        : summary.record,
    learningPath: path,
    transition: {
      changed: Boolean(write?.changed || courseCompleted || badgesAwarded.length),
      courseId,
      moduleId: moduleId || null,
      courseProgress: course.progressPercent,
      moduleCompleted: Boolean(module?.completed && !previousModule?.completed),
      courseCompleted,
      unlockedCourseId: unlocked?.id || null,
      xpAwarded: Math.max(0, path.stats.xp - before.path.stats.xp),
      badgesAwarded,
    },
  };
}

async function updateProgress(userId, input) {
  return transaction(userId, async (db, before) => {
    let target;
    if (input.lessonId != null) target = findLesson(before, input.lessonId);
    else if (input.labId != null) target = findLab(before, input.labId);
    else if (input.moduleId)
      throw fail(400, 'USE_MODULE_ENDPOINT', 'Dùng API hoàn thành chương học.');
    else target = { course: before.path.courses.find((course) => course.id === input.courseId) };
    const { course, module, lesson, lab } = target;
    if (
      course &&
      (course.id !== input.courseId || (input.moduleId && input.moduleId !== module?.id))
    ) {
      throw fail(400, 'CONTENT_MISMATCH', 'Bài học hoặc Lab không thuộc khóa học/chương đã gửi.');
    }
    assertAccess(course, module);
    if (lab?.labType === 'CLI_SIMULATION') {
      throw fail(
        403,
        'SERVER_GRADED_LAB',
        'CLI Lab chỉ được cập nhật tiến độ qua chấm cấu hình ở máy chủ.'
      );
    }
    if (!lesson && !lab && (input.progressPercent !== 0 || input.status !== 'ACTIVE')) {
      throw fail(400, 'DERIVED_COURSE_PROGRESS', 'Tiến độ khóa học được tính từ bài học và Lab.');
    }
    const now = new Date();
    const percent =
      input.status === 'COMPLETED' || input.progressPercent >= 95 ? 100 : input.progressPercent;
    const write = await writeProgress(
      db,
      {
        userId,
        courseId: course.id,
        lessonId: lesson?.id || null,
        labId: lab?.id || null,
        ...(!lesson && !lab ? { moduleId: null } : {}),
      },
      { moduleId: module?.id || null, progressPercent: percent },
      now,
      true
    );
    if (write.firstCompletion && (lesson || lab))
      await activity(
        db,
        userId,
        lesson ? 'LESSON_COMPLETED' : 'LAB_COMPLETED',
        `Hoàn thành ${lesson ? 'bài học' : 'bài thực hành'}: ${(lesson || lab).title}`,
        (lesson || lab).id
      );
    if (lesson && write.record.status === 'COMPLETED')
      await db.videoProgress.updateMany({
        where: { userId, lessonId: lesson.id },
        data: { isCompleted: true },
      });
    return finishMutation(db, userId, before, course.id, module?.id, write, now);
  });
}

async function completeModule(userId, moduleId) {
  return transaction(userId, async (db, before) => {
    const { course, module } = findModule(before, moduleId);
    assertAccess(course, module);
    if (!module.totalItems)
      throw fail(409, 'MODULE_EMPTY', 'Chương chưa có nội dung để hoàn thành.');
    if (!module.completed)
      throw fail(409, 'MODULE_INCOMPLETE', 'Cần hoàn thành các bài học và Lab của chương trước.');
    const now = new Date();
    const write = await writeProgress(
      db,
      { userId, courseId: course.id, moduleId, lessonId: null, labId: null },
      { progressPercent: 100 },
      now
    );
    return finishMutation(db, userId, before, course.id, moduleId, write, now);
  });
}

async function assertLabAccess(db, userId, lab) {
  const state = await readState(db, userId);
  if (!lab.courseId && !lab.moduleId) return state;
  const target = findLab(state, lab.id);
  assertAccess(target.course, target.module);
  return state;
}

async function completeGradedLab(db, userId, lab) {
  await lockUser(db, userId);
  const before = await assertLabAccess(db, userId, lab);
  if (!lab.courseId && !lab.moduleId) return null;
  const target = findLab(before, lab.id);
  const now = new Date();
  const write = await writeProgress(
    db,
    { userId, courseId: target.course.id, lessonId: null, labId: lab.id },
    { moduleId: target.module?.id || null, progressPercent: 100 },
    now,
    true
  );
  if (write.firstCompletion)
    await activity(db, userId, 'LAB_COMPLETED', `Hoàn thành CLI Lab: ${lab.title}`, lab.id);
  return finishMutation(db, userId, before, target.course.id, target.module?.id, write, now);
}

// PostgreSQL DATE stores the learning calendar day, independent of Render's TZ.
function studyDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type) => parts.find((item) => item.type === type).value;
  return new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00.000Z`);
}

async function updateVideoProgress(userId, input) {
  return transaction(userId, async (db, state) => {
    const { course, module, lesson } = findLesson(state, input.lessonId);
    assertAccess(course, module);
    const video = await db.videoProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: input.lessonId } },
      create: {
        userId,
        lessonId: input.lessonId,
        watchedSeconds: input.watchedSeconds,
        lastPosition: input.lastPosition,
        isCompleted: lesson.completed,
      },
      update: {
        watchedSeconds: { increment: input.watchedSeconds },
        lastPosition: input.lastPosition,
        ...(lesson.completed ? { isCompleted: true } : {}),
      },
    });
    // This is resume telemetry. Completion evidence remains UserProgress; a
    // browser's isCompleted flag cannot independently unlock a course.
    if (input.watchedSeconds > 0) {
      const date = studyDate();
      await db.studyLog.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date, duration: input.watchedSeconds },
        update: { duration: { increment: input.watchedSeconds } },
      });
      const totals = await db.studyLog.aggregate({ where: { userId }, _sum: { duration: true } });
      await db.user.update({
        where: { id: userId },
        data: { totalStudyTime: Math.floor((totals._sum.duration || 0) / 60) },
      });
    }
    return video;
  });
}

async function getLearningPath(userId) {
  if (!Number.isInteger(userId) || userId <= 0)
    throw fail(401, 'INVALID_IDENTITY', 'Phiên đăng nhập không hợp lệ.');
  return getPrisma().$transaction(async (db) => (await readState(db, userId)).path, {
    isolationLevel: 'RepeatableRead',
    timeout: 15000,
    maxWait: 10000,
  });
}

module.exports = {
  readCatalog,
  readState,
  getLearningPath,
  updateProgress,
  completeModule,
  assertLabAccess,
  completeGradedLab,
  updateVideoProgress,
  studyDate,
};
