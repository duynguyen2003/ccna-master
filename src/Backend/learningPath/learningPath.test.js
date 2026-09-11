const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildLearningPath,
  computeCourseStatuses,
  durationSeconds,
} = require('../domain/learningPath');
const {
  progressSchema,
  moduleProgressSchema,
  videoProgressSchema,
} = require('../validation/learningPathSchema');
const { studyDate } = require('../services/learningPathService');

const lesson = (id) => ({ id, title: `Lesson ${id}`, orderIndex: id, videoDuration: '10:30' });
const moduleOf = (id, lessons, labs = []) => ({ id, title: id, orderIndex: 1, lessons, labs });
const courseOf = (id, orderIndex, modules, labs = []) => ({
  id,
  code: id,
  title: id,
  status: 'PUBLISHED',
  orderIndex,
  modules,
  labs,
});
const completed = (courseId, lessonId, extra = {}) => ({
  courseId,
  lessonId,
  labId: null,
  status: 'COMPLETED',
  progressPercent: 100,
  ...extra,
});

test('statuses choose one current, clamp progress, support completed review and missing prerequisites', () => {
  const states = computeCourseStatuses([
    { id: 'a', progressPercent: 140, prerequisiteId: null },
    { id: 'b', progressPercent: -4, prerequisiteId: 'a' },
    { id: 'c', progressPercent: 0, prerequisiteId: 'b' },
    { id: 'd', progressPercent: 10, prerequisiteId: null },
  ]);
  assert.deepEqual(
    states.map((c) => c.status),
    ['completed', 'current', 'locked', 'locked']
  );
  assert.deepEqual(
    states.map((c) => c.progressPercent),
    [100, 0, 0, 10]
  );
  assert.equal(
    computeCourseStatuses([{ id: 'b', progressPercent: 20, prerequisiteId: 'missing' }])[0].status,
    'locked'
  );
  assert.equal(
    computeCourseStatuses([{ id: 'b', progressPercent: NaN, prerequisiteId: null }])[0]
      .progressPercent,
    0
  );
});

test('empty catalog and content-free modules cannot grant completion or XP', () => {
  assert.deepEqual(buildLearningPath([]), {
    courses: [],
    stats: { streakDays: 0, xp: 0, badges: 0, overallProgress: 0 },
    currentCourseId: null,
  });
  const path = buildLearningPath([courseOf('a', 1, [moduleOf('m', [])]), courseOf('b', 2, [])]);
  assert.equal(path.courses[0].progressPercent, 0);
  assert.equal(path.courses[0].modules[0].completed, false);
  assert.equal(path.courses[1].status, 'locked');
});

test('stable course order is independent of input order and duplicate orderIndex', () => {
  const courses = [courseOf('b', 1, []), courseOf('c', 2, []), courseOf('a', 1, [])];
  const path = buildLearningPath(courses);
  assert.deepEqual(
    path.courses.map((c) => [c.id, c.prerequisiteId]),
    [
      ['a', null],
      ['b', 'a'],
      ['c', 'b'],
    ]
  );
  assert.deepEqual(
    courses.map((c) => c.id),
    ['b', 'c', 'a']
  );
});

test('distinct task evidence overrides stale or forged course/module summaries', () => {
  const catalog = [courseOf('c', 1, [moduleOf('m', [lesson(1), lesson(2)])])];
  const path = buildLearningPath(catalog, [
    completed('c', 1),
    completed('c', 1),
    {
      courseId: 'c',
      moduleId: null,
      lessonId: null,
      labId: null,
      status: 'COMPLETED',
      progressPercent: 100,
    },
    {
      courseId: 'c',
      moduleId: 'm',
      lessonId: null,
      labId: null,
      status: 'COMPLETED',
      progressPercent: 100,
    },
    completed('other', 2),
    completed('c', 2, { labId: 99 }),
  ]);
  assert.equal(path.courses[0].progressPercent, 50);
  assert.equal(path.courses[0].completedModules, 0);
  assert.equal(path.stats.xp, 10);
});

test('published labs count once even when reachable through both course and module', () => {
  const lab = {
    id: 10,
    title: 'CLI',
    status: 'PUBLISHED',
    courseId: 'c',
    moduleId: 'm',
    labType: 'CLI_SIMULATION',
  };
  const hiddenLab = { ...lab, id: 11, status: 'DRAFT' };
  const catalog = [
    courseOf('c', 1, [moduleOf('m', [lesson(1)], [lab, hiddenLab])], [lab, hiddenLab]),
  ];
  const incomplete = buildLearningPath(catalog, [completed('c', 1)]);
  assert.equal(incomplete.courses[0].totalItems, 2);
  assert.equal(incomplete.courses[0].progressPercent, 50);
  const path = buildLearningPath(
    catalog,
    [completed('c', 1), completed('c', null, { labId: 10 })],
    { streak: 7 },
    [{ id: 1 }]
  );
  assert.equal(path.courses[0].completed, true);
  assert.deepEqual(path.stats, { streakDays: 7, xp: 185, badges: 1, overallProgress: 100 });
});

test('deleted lessons/modules and inconsistent lab links never inflate completion counts', () => {
  const catalog = [
    courseOf(
      'c',
      1,
      [
        moduleOf('m', [lesson(1), { ...lesson(2), deletedAt: new Date() }]),
        { ...moduleOf('deleted', [lesson(3)]), deletedAt: new Date() },
      ],
      [
        { id: 1, status: 'PUBLISHED', courseId: 'c', moduleId: 'deleted' },
        { id: 2, status: 'PUBLISHED', courseId: 'other', moduleId: 'm' },
      ]
    ),
  ];
  const path = buildLearningPath(catalog, [
    completed('c', 1),
    completed('c', 2),
    completed('c', 3),
  ]);
  assert.equal(path.courses[0].totalItems, 1);
  assert.equal(path.courses[0].totalModules, 1);
  assert.equal(path.stats.xp, 135);
});

test('module-only lab relation is included without requiring duplicate courseId', () => {
  const lab = { id: 10, title: 'Lab', status: 'PUBLISHED', courseId: null, moduleId: 'm' };
  const path = buildLearningPath([courseOf('c', 1, [moduleOf('m', [], [lab])])]);
  assert.equal(path.courses[0].totalLabs, 1);
  assert.equal(path.courses[0].contentReady, true);
});

test('an unfinished early module keeps all later unfinished modules locked', () => {
  const modules = [
    moduleOf('m1', [lesson(1)]),
    moduleOf('m2', [lesson(2)]),
    moduleOf('m3', [lesson(3)]),
  ];
  const path = buildLearningPath([courseOf('c', 1, modules)], [completed('c', 2)]);
  assert.deepEqual(
    path.courses[0].modules.map((m) => m.status),
    ['current', 'completed', 'locked']
  );
  assert.equal(path.courses[0].nextLessonId, 1);
});

test('an empty module blocks the course even when every existing task is complete', () => {
  const path = buildLearningPath(
    [courseOf('c', 1, [moduleOf('m1', [lesson(1)]), moduleOf('m2', [])])],
    [completed('c', 1)]
  );
  assert.equal(path.courses[0].progressPercent, 99);
  assert.equal(path.courses[0].completed, false);
  assert.equal(path.stats.overallProgress, 99);
});

test('99.9 percent never prematurely completes the course', () => {
  const lessons = Array.from({ length: 1000 }, (_, i) => lesson(i + 1));
  const progress = lessons.slice(0, -1).map((l) => completed('c', l.id));
  const path = buildLearningPath([courseOf('c', 1, [moduleOf('m', lessons)])], progress);
  assert.equal(path.courses[0].progressPercent, 99);
  assert.equal(path.courses[0].status, 'current');
});

test('server completion unlocks next course and all-complete path has no current node', () => {
  const catalog = [
    courseOf('c1', 1, [moduleOf('m1', [lesson(1)])]),
    courseOf('c2', 2, [moduleOf('m2', [lesson(2)])]),
  ];
  const halfway = buildLearningPath(catalog, [completed('c1', 1)]);
  assert.deepEqual(
    halfway.courses.map((c) => c.status),
    ['completed', 'current']
  );
  const complete = buildLearningPath(catalog, [completed('c1', 1), completed('c2', 2)]);
  assert.equal(complete.currentCourseId, null);
  assert.equal(complete.stats.overallProgress, 100);
});

test('duration metadata is based only on known valid video durations', () => {
  assert.equal(durationSeconds('1:02:03'), 3723);
  assert.equal(durationSeconds('10:30'), 630);
  assert.equal(durationSeconds('10:99'), 0);
  assert.equal(durationSeconds('unknown'), 0);
  assert.equal(buildLearningPath([courseOf('c', 1, [])]).courses[0].estimatedHours, null);
});

test('Zod preserves string module IDs and rejects impersonation, ambiguity and arbitrary rewards', () => {
  const valid = {
    courseId: 'c1',
    moduleId: 'm1234567',
    lessonId: '42',
    progressPercent: 100,
    status: 'COMPLETED',
  };
  assert.equal(progressSchema.parse(valid).moduleId, 'm1234567');
  assert.equal(progressSchema.parse(valid).lessonId, 42);
  for (const extra of [
    { userId: 2 },
    { xp: 100 },
    { labId: 4 },
    { progressPercent: 101 },
    { status: 'LOCKED' },
    { moduleId: 123 },
  ]) {
    assert.equal(progressSchema.safeParse({ ...valid, ...extra }).success, false);
  }
  assert.equal(moduleProgressSchema.safeParse({ completed: false }).success, false);
  assert.equal(moduleProgressSchema.safeParse({ completed: 'true' }).success, false);
  assert.equal(moduleProgressSchema.safeParse({ completed: true, userId: 2 }).success, false);
  assert.equal(
    videoProgressSchema.safeParse({ lessonId: 1, watchedSeconds: 10000, lastPosition: 2 }).success,
    false
  );
});

test('study calendar date is consistently Vietnam time across UTC midnight', () => {
  assert.equal(
    studyDate(new Date('2026-09-09T16:59:59Z')).toISOString(),
    '2026-09-09T00:00:00.000Z'
  );
  assert.equal(
    studyDate(new Date('2026-09-09T17:00:00Z')).toISOString(),
    '2026-09-10T00:00:00.000Z'
  );
});
