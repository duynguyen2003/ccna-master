const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const database = require('../config/database');

const uploadedThumbnail = 'https://res.cloudinary.com/example/image/upload/course.jpg';
const courses = [
  {
    id: 'cs202',
    code: 'cs202',
    title: 'New course',
    description: 'Uploaded thumbnail',
    thumbnailUrl: uploadedThumbnail,
    modules: [{ lessons: [{ id: 1, title: 'First lesson' }] }],
    labs: [],
  },
  {
    id: 'ITN',
    code: 'ITN',
    title: 'Legacy course',
    description: null,
    thumbnailUrl: null,
    modules: [],
    labs: [],
  },
];
const findCourses = mock.fn(async ({ select }) =>
  // Mimic a Prisma projection so omitted fields cannot accidentally pass through.
  courses.map((course) => Object.fromEntries(Object.keys(select).map((key) => [key, course[key]])))
);
const findProgress = mock.fn(async () => [
  { courseId: 'cs202', lessonId: 1, labId: null, progressPercent: 50, status: 'IN_PROGRESS' },
]);
mock.method(database, 'getPrisma', () => ({
  course: { findMany: findCourses },
  userProgress: { findMany: findProgress },
}));
const { getCourseSummaries } = require('../controllers/learningController');

const invoke = async (user) => {
  let body;
  await getCourseSummaries(
    { user },
    {
      json: (result) => {
        body = result;
      },
    },
    (error) => {
      throw error;
    }
  );
  return body.data;
};

test('public summaries include persisted thumbnails and explicit null for missing images', async () => {
  const summaries = await invoke();
  assert.equal(summaries[0].thumbnailUrl, uploadedThumbnail);
  assert.equal(summaries[1].thumbnailUrl, null);
  assert.equal(findProgress.mock.callCount(), 0);
  assert.deepEqual(findCourses.mock.calls[0].arguments[0].where.status, {
    in: ['PUBLISHED', 'OPEN'],
  });
});

test('student summaries preserve uploaded thumbnails alongside personal progress', async () => {
  const summaries = await invoke({ id: 42, role: 'STUDENT' });
  assert.equal(summaries[0].thumbnailUrl, uploadedThumbnail);
  assert.equal(summaries[0].progress, 50);
  assert.equal(summaries[0].nextLessonTitle, 'Bài học tiếp theo: First lesson');
  assert.equal(findProgress.mock.calls.at(-1).arguments[0].where.userId, 42);
});
