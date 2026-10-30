const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
test(
  'lab policies through real admin, learner, attempt and progress APIs',
  { skip: process.env.LEARNING_PATH_INTEGRATION !== '1', timeout: 90000 },
  async (t) => {
    const target = new URL(process.env.DATABASE_URL);
    assert.equal(target.hostname, '127.0.0.1');
    assert.match(target.pathname, /^\/ai_lab_be01_.*_test$/);
    const app = require('../Server');
    const { getPrisma, disconnectDatabase } = require('../config/database');
    const { createAccessToken } = require('../security/session');
    const db = getPrisma();
    assert.equal(await db.course.count(), 0, 'Disposable empty DB required');
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const users = [];
    const rows = [];
    const request = async (path, method = 'GET', body, user = 0) => {
      const response = await fetch(base + path, {
        method,
        headers: {
          Authorization: `Bearer ${createAccessToken(users[user])}`,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    };
    const ok = (r, status) => assert.equal(r.status, status, JSON.stringify(r.body));
    const policy = (mode, lessonIds = []) => ({
      mode,
      lessonIds,
      requiredForCompletion: mode !== 'OPEN',
    });
    try {
      for (const role of ['STUDENT', 'ADMIN'])
        users.push(
          await db.user.create({
            data: { email: `${randomUUID()}@example.invalid`, passwordHash: 'synthetic', role },
          })
        );
      await db.course.createMany({
        data: [
          {
            id: 'la-first',
            code: 'FIRST',
            title: 'Prerequisite course',
            status: 'PUBLISHED',
            orderIndex: 1,
          },
          {
            id: 'la-next',
            code: 'NEXT',
            title: 'Future course',
            status: 'PUBLISHED',
            orderIndex: 2,
          },
        ],
      });
      await db.module.createMany({
        data: [
          { id: 'la-m1', courseId: 'la-first', title: 'First', orderIndex: 1 },
          { id: 'la-m2', courseId: 'la-next', title: 'Future', orderIndex: 1 },
        ],
      });
      await db.lesson.create({
        data: { moduleId: 'la-m1', title: 'Unfinished first course', orderIndex: 1 },
      });
      const lesson = await db.lesson.create({
        data: {
          moduleId: 'la-m2',
          title: 'Required video',
          orderIndex: 1,
          videoUrl: 'https://youtu.be/synthetic',
        },
      });
      const payload = {
        title: 'Policy test',
        objective: 'Verify lab access',
        guideContent: '<p>Inspect the router hostname, then submit.</p>',
        status: 'PUBLISHED',
        courseId: 'la-next',
        moduleId: 'la-m2',
        labType: 'CLI_SIMULATION',
        commandProfile: 'ccna-basic-v1',
        initialState: {
          deviceType: 'ROUTER',
          hostname: 'Router',
          interfaces: ['GigabitEthernet0/0'],
        },
        gradingSpec: {
          passingScore: 100,
          checks: [{ id: 'name', type: 'hostname_equals', expected: 'Router', points: 100 }],
        },
      };
      for (const accessPolicy of [
        policy('OPEN'),
        policy('LESSONS', [lesson.id]),
        policy('CAPSTONE'),
      ]) {
        const created = await request(
          '/learning/labs',
          'POST',
          { ...payload, title: `Policy ${accessPolicy.mode}`, accessPolicy },
          1
        );
        ok(created, 201);
        rows.push(created.body.lab);
      }
      await t.test(
        'OPEN enters before classification course; required lessons and capstone remain locked',
        async () => {
          const list = await request('/learning/labs?view=learning');
          ok(list, 200);
          assert.equal(list.body.data.find((l) => l.id === rows[0].id).access.canAccess, true);
          const locked = list.body.data.find((l) => l.id === rows[1].id);
          assert.equal(locked.access.canAccess, false);
          assert.equal(locked.fileUrl, null);
          assert.equal(locked.guideContent, null);
          assert.ok(!Object.hasOwn(locked, 'gradingSpec'));
          assert.ok(!Object.hasOwn(locked, 'initialState'));
          ok(await request(`/lab-attempts/labs/${rows[0].id}/start`, 'POST'), 201);
          ok(await request(`/lab-attempts/labs/${rows[1].id}/start`, 'POST'), 403);
          ok(await request(`/lab-attempts/labs/${rows[2].id}/start`, 'POST'), 403);
        }
      );
      await t.test(
        'saved video 70% opens only topic lab; grading is allowed while classification course is locked',
        async () => {
          // Fixture evidence is created only in this owned disposable DB.
          await db.userProgress.create({
            data: {
              userId: users[0].id,
              courseId: 'la-next',
              moduleId: 'la-m2',
              lessonId: lesson.id,
              progressPercent: 70,
              status: 'ACTIVE',
            },
          });
          const started = await request(`/lab-attempts/labs/${rows[1].id}/start`, 'POST');
          ok(started, 201);
          ok(await request('/learning/courses/la-next/modules?view=learning'), 403);
          const submitted = await request(`/lab-attempts/${started.body.data.id}/submit`, 'POST');
          ok(submitted, 200);
          assert.equal(submitted.body.data.result.passed, true);
          ok(await request(`/lab-attempts/labs/${rows[2].id}/start`, 'POST'), 403);
        }
      );
      await t.test(
        'capstone uses theory completion and never waits for its own lab result',
        async () => {
          await db.userProgress.updateMany({
            where: { userId: users[0].id, lessonId: lesson.id },
            data: { status: 'COMPLETED', progressPercent: 100 },
          });
          const started = await request(`/lab-attempts/labs/${rows[2].id}/start`, 'POST');
          ok(started, 201);
          const submitted = await request(`/lab-attempts/${started.body.data.id}/submit`, 'POST');
          ok(submitted, 200);
          assert.equal(submitted.body.data.result.passed, true);
        }
      );
      await t.test(
        'editor validates malformed, empty and foreign prerequisites; student cannot select editor view',
        async () => {
          const opened = await request(
            `/learning/labs/${rows[1].id}`,
            'PUT',
            { accessPolicy: policy('OPEN') },
            1
          );
          ok(opened, 200);
          assert.equal(opened.body.lab.accessPolicy.mode, 'OPEN');
          const legacy = await request(
            `/learning/labs/${rows[1].id}`,
            'PUT',
            { accessPolicy: null },
            1
          );
          ok(legacy, 200);
          assert.equal(legacy.body.lab.accessPolicy, null);
          const restored = await request(
            `/learning/labs/${rows[1].id}`,
            'PUT',
            { accessPolicy: policy('LESSONS', [lesson.id]) },
            1
          );
          ok(restored, 200);
          assert.deepEqual(restored.body.lab.accessPolicy.lessonIds, [lesson.id]);
          for (const accessPolicy of [
            policy('LESSONS'),
            policy('LESSONS', [2147483646]),
            { ...policy('OPEN'), bypass: true },
          ])
            ok(await request(`/learning/labs/${rows[1].id}`, 'PUT', { accessPolicy }, 1), 400);
          const learner = await request('/learning/labs?view=admin');
          ok(learner, 200);
          assert.ok(!Object.hasOwn(learner.body.data[0], 'gradingSpec'));
          const editor = await request('/learning/labs', 'GET', null, 1);
          ok(editor, 200);
          assert.ok(Object.hasOwn(editor.body.data[0], 'gradingSpec'));
          await db.lesson.update({ where: { id: lesson.id }, data: { deletedAt: new Date() } });
          ok(await request(`/lab-attempts/labs/${rows[1].id}/start`, 'POST'), 403);
        }
      );
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await disconnectDatabase();
    }
  }
);
