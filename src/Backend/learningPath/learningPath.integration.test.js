const test = require('node:test');
const assert = require('node:assert/strict');

test(
  'Learning Path HTTP + PostgreSQL contracts, authorization, concurrency and rollback',
  {
    skip: process.env.LEARNING_PATH_INTEGRATION !== '1',
    timeout: 90000,
  },
  async (t) => {
    // This suite creates its own fixtures and a temporary failure trigger. Refuse
    // to run against a normal application database even if the flag was set.
    const url = new URL(process.env.DATABASE_URL);
    assert.match(url.pathname, /_test$/);
    const jwt = require('jsonwebtoken');
    const app = require('../Server');
    const { getPrisma, disconnectDatabase } = require('../config/database');
    const prisma = getPrisma();
    assert.equal(await prisma.course.count(), 0, 'Use an empty, isolated test database');
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const userIds = [];
    const tokens = [];
    const courseIds = ['lp-c1', 'lp-c2', 'lp-draft', 'lp-deleted'];
    let triggerCreated = false;
    const request = async (path, { user = 0, method = 'GET', body, token } = {}) => {
      const response = await fetch(base + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token || user >= 0 ? { Authorization: `Bearer ${token || tokens[user]}` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    };
    const patchModule = (moduleId, body = { completed: true }, user = 0) =>
      request(`/learning/modules/${moduleId}/progress`, { method: 'PATCH', body, user });
    const progress = (body, user = 0) => request('/users/progress', { method: 'POST', body, user });
    const getPath = async (user = 0) => {
      const result = await request('/learning/learning-path', { user });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      return result.body.data;
    };
    const assertStatus = (response, expected) =>
      assert.equal(response.status, expected, JSON.stringify(response.body));
    try {
      for (let i = 0; i < 3; i++) {
        const user = await prisma.user.create({
          data: {
            email: `learning-path-${i}@example.invalid`,
            passwordHash: 'unusable-test-hash',
            streak: i === 0 ? 7 : 0,
          },
        });
        userIds.push(user.id);
        tokens.push(
          jwt.sign({ id: user.id, role: 'STUDENT' }, process.env.JWT_SECRET, { expiresIn: '5m' })
        );
      }
      await prisma.course.createMany({
        data: courseIds.map((id, i) => ({
          id,
          code: ['ITN', 'SRWE', 'DRAFT', 'DELETED'][i],
          title: id,
          orderIndex: i + 1,
          status: i === 2 ? 'DRAFT' : 'PUBLISHED',
          deletedAt: i === 3 ? new Date() : null,
        })),
      });
      await prisma.module.createMany({
        data: [
          { id: 'lp-m1', courseId: 'lp-c1', title: 'First module', orderIndex: 1 },
          { id: 'lp-m2', courseId: 'lp-c1', title: 'Second module', orderIndex: 2 },
          { id: 'lp-m3', courseId: 'lp-c2', title: 'Next course module', orderIndex: 1 },
          {
            id: 'lp-md',
            courseId: 'lp-c1',
            title: 'Deleted module',
            orderIndex: 3,
            deletedAt: new Date(),
          },
        ],
      });
      const lessons = [];
      for (const [moduleId, title, orderIndex, deletedAt] of [
        ['lp-m1', 'First lesson', 1, null],
        ['lp-m1', 'Second lesson', 2, null],
        ['lp-m2', 'Third lesson', 1, null],
        ['lp-m3', 'Fourth lesson', 1, null],
        ['lp-md', 'Hidden by module', 1, null],
        ['lp-m1', 'Deleted lesson', 3, new Date()],
      ])
        lessons.push(
          await prisma.lesson.create({
            data: { moduleId, title, orderIndex, deletedAt, videoDuration: '10:00' },
          })
        );
      const ptLab = await prisma.lab.create({
        data: {
          title: 'Packet Tracer requirement',
          courseId: 'lp-c1',
          moduleId: 'lp-m2',
          status: 'PUBLISHED',
        },
      });
      const cliLab = await prisma.lab.create({
        data: {
          title: 'CLI requirement',
          courseId: 'lp-c1',
          moduleId: 'lp-m2',
          status: 'PUBLISHED',
          labType: 'CLI_SIMULATION',
          initialState: {
            devices: [
              {
                id: 'R1',
                deviceType: 'ROUTER',
                hostname: 'Router',
                interfaces: ['GigabitEthernet0/0'],
              },
            ],
            links: [],
          },
          gradingSpec: {
            passingScore: 100,
            checks: [
              {
                id: 'name',
                type: 'hostname_equals',
                deviceId: 'R1',
                expected: 'Router',
                points: 100,
              },
            ],
          },
        },
      });
      await prisma.lab.create({
        data: { title: 'Draft lab excluded', courseId: 'lp-c1', status: 'DRAFT' },
      });
      await prisma.courseTopic.create({ data: { courseId: 'lp-c1', title: 'IPv4 addressing' } });
      const finishLesson = (index, user = 0, extra = {}) =>
        progress(
          {
            courseId: index === 3 ? 'lp-c2' : 'lp-c1',
            moduleId: lessons[index].moduleId,
            lessonId: lessons[index].id,
            status: 'COMPLETED',
            progressPercent: 100,
            ...extra,
          },
          user
        );

      await t.test('JWT is mandatory for personal roadmap and module mutations', async () => {
        assertStatus(await request('/learning/learning-path', { user: -1 }), 401);
        assertStatus(
          await request('/learning/modules/lp-m1/progress', {
            user: -1,
            method: 'PATCH',
            body: { completed: true },
          }),
          401
        );
        const expired = jwt.sign({ id: userIds[0] }, process.env.JWT_SECRET, { expiresIn: -1 });
        assertStatus(await request('/learning/learning-path', { token: expired }), 401);
        assertStatus(await request('/learning/courses', { user: -1 }), 200);
      });

      await t.test(
        'GET uses published metadata and real statistics without private content',
        async () => {
          const path = await getPath();
          assert.deepEqual(
            path.courses.map((course) => course.id),
            ['lp-c1', 'lp-c2']
          );
          assert.deepEqual(
            path.courses.map((course) => course.status),
            ['current', 'locked']
          );
          assert.deepEqual(path.stats, { streakDays: 7, xp: 0, badges: 0, overallProgress: 0 });
          assert.equal(path.courses[0].totalItems, 5);
          assert.equal(path.courses[0].totalModules, 2);
          assert.deepEqual(path.courses[0].skills, ['IPv4 addressing']);
          assert.doesNotMatch(
            JSON.stringify(path),
            /passwordHash|gradingSpec|correctAnswer|contentHtml|DATABASE_URL/
          );
        }
      );

      await t.test(
        'Zod rejects wrong types, unknown fields, completion reset and user impersonation',
        async () => {
          for (const body of [
            {},
            { completed: false },
            { completed: 'true' },
            { completed: true, userId: userIds[1] },
          ]) {
            assertStatus(await patchModule('lp-m1', body), 400);
          }
          assertStatus(await finishLesson(0, 0, { userId: userIds[1] }), 400);
          assertStatus(await finishLesson(0, 0, { moduleId: 123 }), 400);
          assertStatus(await finishLesson(0, 0, { progressPercent: 150 }), 400);
          assertStatus(await finishLesson(0, 0, { xp: 99999 }), 400);
        }
      );

      await t.test(
        'nonexistent/deleted content is rejected; module/course relation cannot be spoofed',
        async () => {
          assertStatus(await patchModule('missing'), 404);
          assertStatus(await patchModule('lp-md'), 404);
          assertStatus(await finishLesson(0, 0, { lessonId: lessons[4].id }), 404);
          assertStatus(await finishLesson(0, 0, { lessonId: lessons[5].id }), 404);
          assertStatus(await finishLesson(0, 0, { courseId: 'lp-c2' }), 400);
          assertStatus(await finishLesson(0, 0, { moduleId: 'lp-m2' }), 400);
        }
      );

      await t.test(
        'all mutation paths enforce prerequisites and cannot forge summaries',
        async () => {
          assertStatus(await patchModule('lp-m3'), 403);
          assertStatus(await finishLesson(3), 403);
          assertStatus(await finishLesson(2), 403);
          assertStatus(
            await progress({ courseId: 'lp-c2', status: 'ACTIVE', progressPercent: 0 }),
            403
          );
          assertStatus(
            await progress({ courseId: 'lp-c1', status: 'COMPLETED', progressPercent: 100 }),
            400
          );
          assertStatus(await patchModule('lp-m1'), 409);
          assertStatus(
            await request('/users/progress/video', {
              method: 'POST',
              body: {
                lessonId: lessons[3].id,
                watchedSeconds: 5,
                lastPosition: 5,
                isCompleted: true,
              },
            }),
            403
          );
          assertStatus(
            await request(`/lab-attempts/labs/${cliLab.id}/start`, { method: 'POST' }),
            403
          );
        }
      );

      await t.test('inactive account is rejected even with a valid JWT', async () => {
        await prisma.user.update({ where: { id: userIds[1] }, data: { isActive: false } });
        assertStatus(await request('/learning/learning-path', { user: 1 }), 403);
        assertStatus(await finishLesson(0, 1), 403);
        await prisma.user.update({ where: { id: userIds[1] }, data: { isActive: true } });
      });

      await t.test(
        'existing enrollment payload remains compatible and cannot award XP',
        async () => {
          const result = await progress({
            courseId: 'lp-c1',
            status: 'ACTIVE',
            progressPercent: 0,
          });
          assertStatus(result, 200);
          assert.equal(result.body.data.courseId, 'lp-c1');
          assert.equal(result.body.overallPercent, 0);
          assert.equal(result.body.learningPath.courses[0].isStarted, true);
          assert.equal(result.body.transition.xpAwarded, 0);
        }
      );

      await t.test(
        'concurrent duplicate lesson writes produce one completion and one reward',
        async () => {
          const responses = await Promise.all([finishLesson(0), finishLesson(0), finishLesson(0)]);
          responses.forEach((response) => assertStatus(response, 200));
          assert.equal(
            responses.reduce((sum, response) => sum + response.body.transition.xpAwarded, 0),
            10
          );
          assert.equal(
            await prisma.userProgress.count({
              where: { userId: userIds[0], lessonId: lessons[0].id },
            }),
            1
          );
          assert.equal(
            await prisma.userActivity.count({
              where: { userId: userIds[0], type: 'LESSON_COMPLETED', referenceId: lessons[0].id },
            }),
            1
          );
          assert.equal(responses[0].body.data.moduleId, 'lp-m1');
          assert.equal((await getPath(1)).stats.xp, 0);
        }
      );

      await t.test(
        'admin dashboard distinguishes module summaries from course enrollment and progress',
        async () => {
          const token = jwt.sign({ id: userIds[0], role: 'ADMIN' }, process.env.JWT_SECRET, {
            expiresIn: '5m',
          });
          await prisma.userProgress.updateMany({
            where: { userId: userIds[0], moduleId: 'lp-m1', lessonId: null },
            data: { progressPercent: 50 },
          });
          const distribution = await request('/admin/dashboard/distribution', { token });
          assertStatus(distribution, 200);
          assert.equal(distribution.body.find((course) => course.name === 'lp-c1').value, 1);
          const summary = await request('/admin/dashboard/summary', { token });
          assertStatus(summary, 200);
          assert.equal(summary.body.avgProgress, 20);
          const students = await request('/admin/dashboard/students', { token });
          assertStatus(students, 200);
          assert.equal(students.body.find((student) => student.id === userIds[0]).progress, 20);
        }
      );

      await t.test(
        'an empty module returns a domain conflict without fabricating task completion',
        async () => {
          await prisma.module.create({
            data: { id: 'lp-empty', title: 'Pending content', courseId: 'lp-c2', orderIndex: 0 },
          });
          try {
            // The course is locked first; even empty content cannot bypass its prerequisite.
            assertStatus(await patchModule('lp-empty'), 403);
            await prisma.module.update({
              where: { id: 'lp-empty' },
              data: { courseId: 'lp-c1', orderIndex: 0 },
            });
            const result = await patchModule('lp-empty');
            assertStatus(result, 409);
            assert.equal(result.body.code, 'MODULE_EMPTY');
          } finally {
            await prisma.module.delete({ where: { id: 'lp-empty' } });
          }
        }
      );

      await t.test(
        'partial retry preserves completion and the final lesson unlocks the next module',
        async () => {
          const retry = await finishLesson(0, 0, { status: 'ACTIVE', progressPercent: 10 });
          assertStatus(retry, 200);
          assert.equal(retry.body.data.progressPercent, 100);
          assert.equal(retry.body.data.status, 'COMPLETED');
          assert.equal(retry.body.transition.changed, false);
          const result = await finishLesson(1);
          assertStatus(result, 200);
          assert.equal(result.body.transition.moduleCompleted, true);
          assert.equal(result.body.transition.xpAwarded, 35);
          assert.equal(result.body.learningPath.courses[0].modules[1].status, 'current');
          const confirmations = await Promise.all([patchModule('lp-m1'), patchModule('lp-m1')]);
          confirmations.forEach((response) => {
            assertStatus(response, 200);
            assert.equal(response.body.data.courseCompleted, false);
            assert.equal(response.body.data.xpAwarded, 0);
          });
        }
      );

      await t.test(
        'video telemetry remains atomic and cannot independently finish a lesson',
        async () => {
          const body = {
            lessonId: lessons[2].id,
            watchedSeconds: 5,
            lastPosition: 590,
            isCompleted: true,
          };
          assertStatus(await request('/users/progress/video', { method: 'POST', body }), 200);
          const video = await prisma.videoProgress.findUnique({
            where: { userId_lessonId: { userId: userIds[0], lessonId: lessons[2].id } },
          });
          assert.equal(video.isCompleted, false);
          assert.equal((await getPath()).courses[0].modules[1].lessons[0].completed, false);
          assert.equal(await prisma.studyLog.count({ where: { userId: userIds[0] } }), 1);
          assertStatus(
            await request('/users/progress/video', {
              method: 'POST',
              body: { ...body, watchedSeconds: 86400 },
            }),
            400
          );
        }
      );

      await t.test(
        'concurrent distinct task writes keep course/module totals consistent',
        async () => {
          const results = await Promise.all([
            finishLesson(2),
            progress({
              courseId: 'lp-c1',
              moduleId: 'lp-m2',
              labId: ptLab.id,
              progressPercent: 100,
              status: 'COMPLETED',
            }),
          ]);
          results.forEach((response) => assertStatus(response, 200));
          const path = await getPath();
          assert.equal(path.courses[0].progressPercent, 80);
          assert.equal(path.courses[0].completedModules, 1);
          assert.equal(path.courses[1].status, 'locked');
          assertStatus(
            await progress({
              courseId: 'lp-c1',
              labId: cliLab.id,
              progressPercent: 100,
              status: 'COMPLETED',
            }),
            403
          );
          const video = await prisma.videoProgress.findUnique({
            where: { userId_lessonId: { userId: userIds[0], lessonId: lessons[2].id } },
          });
          assert.equal(video.isCompleted, true);
        }
      );

      await t.test(
        'real CLI grading finishes the course, stores badge and unlocks the next course atomically',
        async () => {
          const start = await request(`/lab-attempts/labs/${cliLab.id}/start`, { method: 'POST' });
          assertStatus(start, 201);
          const submit = await request(`/lab-attempts/${start.body.data.id}/submit`, {
            method: 'POST',
          });
          assertStatus(submit, 200);
          assert.equal(submit.body.data.result.passed, true);
          assert.equal(submit.body.data.transition.courseCompleted, true);
          assert.equal(submit.body.data.transition.unlockedCourseId, 'lp-c2');
          assert.equal(submit.body.data.transition.badgesAwarded.length, 1);
          const path = await getPath();
          assert.equal(path.courses[0].progressPercent, 100);
          assert.equal(path.courses[1].status, 'current');
          assert.equal(path.stats.xp, 280);
          assert.equal(path.stats.badges, 1);
          const summary = await prisma.userProgress.findFirst({
            where: {
              userId: userIds[0],
              courseId: 'lp-c1',
              moduleId: null,
              lessonId: null,
              labId: null,
            },
          });
          assert.equal(summary.status, 'COMPLETED');
          assert.ok(summary.completedAt);
        }
      );

      await t.test(
        'reviewing/passing a new CLI attempt never duplicates XP, badges or events',
        async () => {
          const start = await request(`/lab-attempts/labs/${cliLab.id}/start`, { method: 'POST' });
          assertStatus(start, 201);
          const submit = await request(`/lab-attempts/${start.body.data.id}/submit`, {
            method: 'POST',
          });
          assertStatus(submit, 200);
          assert.equal(submit.body.data.transition.xpAwarded, 0);
          assert.equal(submit.body.data.transition.courseCompleted, false);
          assert.equal(submit.body.data.transition.unlockedCourseId, null);
          assert.equal(await prisma.userBadge.count({ where: { userId: userIds[0] } }), 1);
          assert.equal(
            await prisma.userActivity.count({
              where: { userId: userIds[0], type: 'LAB_COMPLETED', referenceId: cliLab.id },
            }),
            1
          );
        }
      );

      await t.test(
        'legacy courses and roadmap agree, including pagination beyond the first course',
        async () => {
          const result = await request('/learning/courses?page=2&limit=1');
          assertStatus(result, 200);
          const node = (await getPath()).courses[1];
          assert.equal(result.body.data[0].id, node.id);
          assert.equal(result.body.data[0].progress, node.progressPercent);
          assert.equal(result.body.data[0].learningStatus, node.status);
          assert.equal(result.body.data[0].prerequisiteId, node.prerequisiteId);
        }
      );

      await t.test(
        'all courses completed yields no current node and retry carries no unlock animation',
        async () => {
          const result = await finishLesson(3);
          assertStatus(result, 200);
          assert.equal(result.body.transition.courseCompleted, true);
          assert.equal(result.body.transition.unlockedCourseId, null);
          assert.equal(result.body.learningPath.currentCourseId, null);
          assert.equal(result.body.learningPath.stats.overallProgress, 100);
          const retry = await patchModule('lp-m3');
          assertStatus(retry, 200);
          assert.equal(retry.body.data.courseCompleted, false);
          assert.equal(retry.body.data.xpAwarded, 0);
        }
      );

      await t.test(
        'legacy duplicate task rows and stale summaries are deduplicated by identity',
        async () => {
          await prisma.userProgress.createMany({
            data: [
              {
                userId: userIds[1],
                courseId: 'lp-c1',
                lessonId: lessons[0].id,
                status: 'COMPLETED',
                progressPercent: 95,
              },
              {
                userId: userIds[1],
                courseId: 'lp-c1',
                lessonId: lessons[0].id,
                status: 'ACTIVE',
                progressPercent: 10,
              },
              { userId: userIds[1], courseId: 'lp-c1', status: 'COMPLETED', progressPercent: 100 },
            ],
          });
          assert.equal((await getPath(1)).courses[0].progressPercent, 20);
          const retry = await finishLesson(0, 1);
          assertStatus(retry, 200);
          assert.equal(retry.body.transition.xpAwarded, 0);
          const rows = await prisma.userProgress.findMany({
            where: { userId: userIds[1], lessonId: lessons[0].id },
          });
          assert.equal(rows.length, 2);
          rows.forEach((row) => {
            assert.equal(row.moduleId, 'lp-m1');
            assert.equal(row.progressPercent, 100);
          });
        }
      );

      await t.test(
        'badge failure rolls back the final lesson, summaries and activities without leaking database errors',
        async () => {
          // User 2 completes c1, then attempts the only lesson in c2 while a test
          // trigger rejects badge insertion. There must be no partial completion.
          for (const index of [0, 1, 2]) assertStatus(await finishLesson(index, 2), 200);
          assertStatus(
            await progress(
              { courseId: 'lp-c1', labId: ptLab.id, progressPercent: 100, status: 'COMPLETED' },
              2
            ),
            200
          );
          const start = await request(`/lab-attempts/labs/${cliLab.id}/start`, {
            method: 'POST',
            user: 2,
          });
          assertStatus(start, 201);
          assertStatus(
            await request(`/lab-attempts/${start.body.data.id}/submit`, {
              method: 'POST',
              user: 2,
            }),
            200
          );
          await prisma.$executeRawUnsafe(
            "CREATE FUNCTION lp_test_reject_badge() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private database failure'; END; $$"
          );
          await prisma.$executeRawUnsafe(
            'CREATE TRIGGER lp_test_reject_badge BEFORE INSERT ON user_badges FOR EACH ROW EXECUTE FUNCTION lp_test_reject_badge()'
          );
          triggerCreated = true;
          const failed = await finishLesson(3, 2);
          assertStatus(failed, 500);
          assert.deepEqual(Object.keys(failed.body).sort(), ['code', 'message']);
          assert.doesNotMatch(
            JSON.stringify(failed.body),
            /private database|Prisma|stack|user_badges/
          );
          assert.equal(
            await prisma.userProgress.count({ where: { userId: userIds[2], courseId: 'lp-c2' } }),
            0
          );
          assert.equal(
            await prisma.userActivity.count({
              where: { userId: userIds[2], referenceId: lessons[3].id, type: 'LESSON_COMPLETED' },
            }),
            0
          );
          assert.equal((await getPath(2)).courses[1].progressPercent, 0);
          await prisma.$executeRawUnsafe('DROP TRIGGER lp_test_reject_badge ON user_badges');
          await prisma.$executeRawUnsafe('DROP FUNCTION lp_test_reject_badge()');
          triggerCreated = false;
          assertStatus(await finishLesson(3, 2), 200);
        }
      );
    } finally {
      if (triggerCreated) {
        await prisma.$executeRawUnsafe(
          'DROP TRIGGER IF EXISTS lp_test_reject_badge ON user_badges'
        );
        await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS lp_test_reject_badge()');
      }
      await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await new Promise((resolve) => server.close(resolve));
      await disconnectDatabase();
    }
  }
);
