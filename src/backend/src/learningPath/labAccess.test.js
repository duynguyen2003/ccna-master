const { test } = require('node:test');
const assert = require('node:assert/strict');
const { labAccess, countsForCompletion } = require('../domain/labAccess');
const { buildLearningPath } = require('../domain/learningPath');
const { validateLabAccessPolicy } = require('../validation/labAccessPolicy');
const policy = (mode, lessonIds = []) => ({
  mode,
  lessonIds,
  requiredForCompletion: mode !== 'OPEN',
});
test('a malformed optional policy cannot remove a required lab from course completion', () => {
  assert.equal(
    countsForCompletion({ accessPolicy: { mode: 'OPEN', requiredForCompletion: false } }),
    true
  );
  assert.equal(countsForCompletion({ accessPolicy: policy('OPEN') }), false);
});
const state = () => ({
  user: { id: 1 },
  path: {
    courses: [
      {
        id: 'c1',
        canAccess: false,
        lockedReason: 'Course locked',
        modules: [
          {
            id: 'm1',
            canAccess: false,
            lessons: [
              { id: 1, title: 'Video', hasVideo: true, progressPercent: 69, completed: false },
              { id: 2, title: 'Reading', hasVideo: false, progressPercent: 70, completed: false },
            ],
          },
        ],
      },
    ],
  },
});
test('explicit prerequisites separate lab entry from locked classification; no implicit legacy unlock', () => {
  const s = state();
  const lab = { courseId: 'c1', moduleId: 'm1', accessPolicy: policy('LESSONS', [1]) };
  assert.equal(labAccess(lab, s).canAccess, false);
  s.path.courses[0].modules[0].lessons[0].progressPercent = 70;
  assert.equal(labAccess(lab, s).canAccess, true);
  assert.equal(labAccess({ ...lab, accessPolicy: null }, s).canAccess, false);
  assert.equal(labAccess({ ...lab, accessPolicy: policy('OPEN') }, s).canAccess, true);
  lab.accessPolicy = policy('LESSONS', [2]);
  assert.equal(labAccess(lab, s).canAccess, false);
  s.path.courses[0].modules[0].lessons[1].completed = true;
  assert.equal(labAccess(lab, s).canAccess, true);
  assert.equal(labAccess(lab, { ...s, user: {} }).canAccess, false);
});
test('capstone requires all theory at completion, excludes labs and fails closed on missing or malformed prerequisites', () => {
  const s = state();
  const lab = { courseId: 'c1', moduleId: 'm1', accessPolicy: policy('CAPSTONE') };
  assert.equal(labAccess(lab, s).canAccess, false);
  s.path.courses[0].modules[0].lessons.forEach((l) => {
    l.completed = true;
    l.progressPercent = 100;
  });
  assert.equal(labAccess(lab, s).canAccess, true);
  for (const p of [
    policy('LESSONS', [99]),
    policy('LESSONS'),
    { mode: 'OPEN' },
    { ...policy('OPEN'), bypass: true },
  ])
    assert.equal(labAccess({ ...lab, accessPolicy: p }, s).canAccess, false);
});
test('optional labs and optional-only modules do not prevent course completion or the next module', () => {
  const lab = {
    id: 1,
    courseId: 'c1',
    moduleId: 'm1',
    title: 'Practice',
    status: 'PUBLISHED',
    accessPolicy: policy('OPEN'),
  };
  const catalog = [
    {
      id: 'c1',
      orderIndex: 1,
      modules: [
        { id: 'm1', orderIndex: 1, lessons: [], labs: [lab] },
        { id: 'm2', orderIndex: 2, lessons: [{ id: 2, title: 'Theory' }] },
      ],
    },
  ];
  let path = buildLearningPath(catalog);
  assert.equal(path.courses[0].modules[1].canAccess, true);
  assert.equal(path.courses[0].totalItems, 1);
  path = buildLearningPath(catalog, [
    { courseId: 'c1', lessonId: 2, status: 'COMPLETED', progressPercent: 100 },
  ]);
  assert.equal(path.courses[0].completed, true);
  assert.equal(path.courses[0].completedLabs, 0);
});
test('policy publishing validates scope, duplicates, deleted lessons and capstone theory', async () => {
  const db = { lesson: { findMany: async () => [{ id: 1 }], count: async () => 0 } };
  const scope = { courseId: 'c1', moduleId: 'm1', status: 'PUBLISHED' };
  assert.deepEqual(
    await validateLabAccessPolicy(db, JSON.stringify(policy('LESSONS', [1])), scope),
    policy('LESSONS', [1])
  );
  for (const p of [
    policy('LESSONS'),
    policy('LESSONS', [1, 1]),
    policy('LESSONS', [1, 2]),
    policy('CAPSTONE'),
    { ...policy('OPEN'), extra: true },
  ])
    await assert.rejects(validateLabAccessPolicy(db, p, scope), { status: 400 });
  await assert.rejects(
    validateLabAccessPolicy(db, policy('LESSONS', [1]), { ...scope, courseId: null }),
    { status: 400 }
  );
});
