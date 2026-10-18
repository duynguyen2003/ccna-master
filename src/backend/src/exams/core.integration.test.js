const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test(
  'HTTP/PostgreSQL: account revocation, learning and exam lifecycle',
  { skip: process.env.CORE_INTEGRATION !== '1', timeout: 90000 },
  async (t) => {
    assert.match(new URL(process.env.DATABASE_URL).pathname, /_test$/);
    const app = require('../Server');
    const { getPrisma, disconnectDatabase } = require('../config/database');
    const { createAccessToken } = require('../security/session');
    const bcrypt = require('bcrypt');
    const prisma = getPrisma();
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const email = `core-${crypto.randomUUID()}@example.invalid`;
    const password = 'SafePassword123!';
    const users = [];
    let exam, course;
    const request = async (path, token, method = 'GET', body) => {
      const response = await fetch(base + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    };
    const status = (response, code) =>
      assert.equal(response.status, code, JSON.stringify(response.body));
    let student, token, admin, adminToken, otherToken, attempt, resultId;
    try {
      await t.test(
        'register and login, learn, persist notes without sharing across accounts',
        async () => {
          status(
            await request('/auth/register', null, 'POST', {
              email,
              password,
              fullName: 'Core test student',
            }),
            201
          );
          student = await prisma.user.findUnique({ where: { email } });
          users.push(student.id);
          const login = await request('/auth/login', null, 'POST', { email, password });
          status(login, 200);
          token = login.body.accessToken;
          admin = await prisma.user.create({
            data: {
              email: 'admin-' + email,
              passwordHash: await bcrypt.hash(password, 4),
              role: 'ADMIN',
            },
          });
          users.push(admin.id);
          adminToken = createAccessToken(admin);
          const other = await prisma.user.create({
            data: { email: 'other-' + email, passwordHash: 'unused' },
          });
          users.push(other.id);
          otherToken = createAccessToken(other);
          course = await prisma.course.create({
            data: {
              id: 'ct' + crypto.randomBytes(4).toString('hex'),
              code: 'TEST',
              title: 'Core course',
              status: 'PUBLISHED',
              modules: {
                create: {
                  id: 'cm' + crypto.randomBytes(4).toString('hex'),
                  title: 'Core module',
                  orderIndex: 1,
                  lessons: { create: { title: 'First lesson', orderIndex: 1 } },
                },
              },
            },
            include: { modules: { include: { lessons: true } } },
          });
          const lesson = course.modules[0].lessons[0];
          status(
            await request('/users/notes', token, 'POST', {
              lessonId: lesson.id,
              content: 'Only my note',
            }),
            200
          );
          const mine = await request('/users/notes/' + lesson.id, token);
          status(mine, 200);
          assert.equal(mine.body.content, 'Only my note');
          const theirs = await request('/users/notes/' + lesson.id, otherToken);
          status(theirs, 200);
          assert.equal(theirs.body.content, '');
          status(await request('/learning/learning-path', token), 200);
          status(
            await request('/users/progress', token, 'POST', {
              courseId: course.id,
              moduleId: course.modules[0].id,
              lessonId: lesson.id,
              progressPercent: 100,
              status: 'COMPLETED',
            }),
            200
          );
          const lab = await prisma.lab.create({
            data: {
              title: 'Hostname lab',
              status: 'PUBLISHED',
              labType: 'CLI_SIMULATION',
              courseId: course.id,
              moduleId: course.modules[0].id,
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
                    expected: 'Target',
                    points: 100,
                  },
                ],
              },
            },
          });
          const started = await request(`/lab-attempts/labs/${lab.id}/start`, token, 'POST');
          status(started, 201);
          const labAttemptId = started.body.data.id;
          for (const command of ['enable', 'configure terminal', 'hostname Target']) {
            const current = await request(`/lab-attempts/${labAttemptId}`, token);
            status(
              await request(`/lab-attempts/${labAttemptId}/commands`, token, 'POST', {
                command,
                deviceId: 'R1',
                expectedRevision: current.body.data.state.revision,
              }),
              200
            );
          }
          const submitted = await request(`/lab-attempts/${labAttemptId}/submit`, token, 'POST');
          status(submitted, 200);
          assert.equal(submitted.body.data.result.score, 100);
          status(await request('/api-does-not-exist', token), 404);
          status(await request('/health/ready'), 200);
        }
      );
      await t.test('start/resume is concurrent safe and hides answers', async () => {
        exam = await prisma.exam.create({
          data: {
            title: 'Original title',
            durationMinutes: 10,
            totalQuestions: 1,
            passingScore: 70,
            status: 'OPEN',
            questions: {
              create: {
                question: 'Choose b and c',
                options: ['a', 'b', 'c'],
                correctAnswer: [1, 2],
                explanation: 'Original explanation',
                orderIndex: 1,
              },
            },
          },
          include: { questions: true },
        });
        const starts = await Promise.all([
          request(`/exams/${exam.id}/attempts`, token, 'POST'),
          request(`/exams/${exam.id}/attempts`, token, 'POST'),
        ]);
        starts.forEach((r) => status(r, 200));
        attempt = starts[0].body.attempt;
        assert.equal(attempt.id, starts[1].body.attempt.id);
        assert.doesNotMatch(
          JSON.stringify(attempt),
          /correctAnswer|explanation|Original explanation/
        );
        status(await request(`/exams/${exam.id}/attempts/${attempt.id}`, otherToken), 404);
        status(await request(`/exams/${exam.id}/submit`, token, 'POST', { answers: {} }), 400);
        status(
          await request(`/exams/${exam.id}/submit`, token, 'POST', {
            attemptId: attempt.id,
            answers: { [exam.questions[0].id]: [1, 1] },
          }),
          400
        );
        status(
          await request(`/exams/${exam.id}/submit`, token, 'POST', {
            attemptId: attempt.id,
            answers: { [exam.questions[0].id]: [3] },
          }),
          400
        );
        await assert.rejects(
          require('./attempts').submitAttempt(prisma, student.id, exam.id, attempt.id, {
            999999: [0],
          }),
          { status: 400 }
        );
      });
      await t.test(
        'editing replaces questions but grading/review use original snapshot; submit is idempotent',
        async () => {
          const edited = await request(`/exams/${exam.id}`, adminToken, 'PUT', {
            title: 'Changed title',
            passingScore: 100,
            questions: [{ question: 'Changed question', options: ['x', 'y'], correctAnswer: [0] }],
          });
          status(edited, 200);
          const submissions = await Promise.all(
            Array.from({ length: 2 }, () =>
              request(`/exams/${exam.id}/submit`, token, 'POST', {
                attemptId: attempt.id,
                answers: { [exam.questions[0].id]: [2, 1] },
                timeSpent: 999999,
              })
            )
          );
          submissions.forEach((r) => status(r, 200));
          resultId = submissions[0].body.resultId;
          assert.equal(resultId, submissions[1].body.resultId);
          assert.equal(await prisma.examResult.count({ where: { attemptId: attempt.id } }), 1);
          const review = await request(`/exams/result/${resultId}`, token);
          status(review, 200);
          assert.equal(review.body.data.score, 1000);
          assert.equal(review.body.data.exam.title, 'Original title');
          assert.equal(review.body.data.exam.questions[0].explanation, 'Original explanation');
          assert.ok(review.body.data.timeSpent < 60);
          status(await request(`/exams/result/${resultId}`, otherToken), 404);
          const history = await request('/exams/history/me', token);
          assert.equal(history.body.data[0].exam.title, 'Original title');
          const retake = await request(`/exams/${exam.id}/attempts`, token, 'POST');
          status(retake, 200);
          assert.notEqual(retake.body.attempt.id, attempt.id);
          assert.equal(retake.body.attempt.exam.title, 'Changed title');
          const retakeResultId = await require('./attempts').submitAttempt(
            prisma,
            student.id,
            exam.id,
            retake.body.attempt.id,
            { [retake.body.attempt.exam.questions[0].id]: [0] }
          );
          assert.notEqual(
            retakeResultId,
            resultId,
            'A retake inside five minutes must have a new result'
          );
          const expired = await request(`/exams/${exam.id}/attempts`, token, 'POST');
          status(expired, 200);
          await prisma.examAttempt.update({
            where: { id: expired.body.attempt.id },
            data: { expiresAt: new Date(Date.now() - 1000) },
          });
          // Exercise expiry through service to avoid the deliberately exhausted HTTP submission limiter.
          await assert.rejects(
            require('./attempts').submitAttempt(
              prisma,
              student.id,
              exam.id,
              expired.body.attempt.id,
              {}
            ),
            { status: 409 }
          );
        }
      );
      await t.test(
        'lock/unlock and soft delete invalidate old tokens and block password/Google login',
        async () => {
          status(await request(`/admin/users/${student.id}/toggle`, adminToken, 'PATCH'), 200);
          status(await request('/auth/profile', token), 401);
          status(await request('/auth/login', null, 'POST', { email, password }), 401);
          const originalFetch = global.fetch;
          global.fetch = async (url, options) =>
            String(url).startsWith('https://www.googleapis.com/')
              ? { ok: true, json: async () => ({ email, name: 'Test' }) }
              : originalFetch(url, options);
          try {
            status(
              await request('/auth/google', null, 'POST', { token: 'fake-google-test-token' }),
              403
            );
          } finally {
            global.fetch = originalFetch;
          }
          status(await request(`/admin/users/${student.id}/toggle`, adminToken, 'PATCH'), 200);
          status(await request('/auth/profile', token), 401);
          const login = await request('/auth/login', null, 'POST', { email, password });
          status(login, 200);
          token = login.body.accessToken;
          status(await request(`/admin/users/${student.id}`, adminToken, 'DELETE'), 200);
          status(await request('/auth/profile', token), 401);
          status(await request('/auth/login', null, 'POST', { email, password }), 401);
          await prisma.user.update({
            where: { id: student.id },
            data: { deletedAt: null, isActive: true, sessionVersion: { increment: 1 } },
          });
          student = await prisma.user.findUnique({ where: { id: student.id } });
          token = createAccessToken(student);
        }
      );
      await t.test(
        'role changes, password reset races and logout revoke access tokens',
        async () => {
          status(
            await request(`/admin/users/${student.id}/role`, adminToken, 'PATCH', {
              role: 'ADMIN',
            }),
            200
          );
          status(await request('/auth/profile', token), 401);
          student = await prisma.user.findUnique({ where: { id: student.id } });
          token = createAccessToken(student);
          status(
            await request(`/admin/users/${student.id}/role`, adminToken, 'PATCH', {
              role: 'STUDENT',
            }),
            200
          );
          status(await request('/exams', token), 200); // Optional auth downgrades revoked token to guest.
          status(await request('/admin/dashboard/summary', token), 401);
          student = await prisma.user.findUnique({ where: { id: student.id } });
          token = createAccessToken(student);
          const rawToken = crypto.randomBytes(32).toString('hex');
          await prisma.passwordResetToken.create({
            data: {
              userId: student.id,
              tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
              expiresAt: new Date(Date.now() + 60000),
            },
          });
          const resets = await Promise.all(
            [0, 1].map(() =>
              request('/auth/reset-password', null, 'POST', {
                token: rawToken,
                password: 'NewPassword123!',
              })
            )
          );
          assert.deepEqual(resets.map((r) => r.status).sort(), [200, 400]);
          status(await request('/auth/profile', token), 401);
          const login = await request('/auth/login', null, 'POST', {
            email,
            password: 'NewPassword123!',
          });
          status(login, 200);
          token = login.body.accessToken;
          status(await request('/auth/logout', token, 'POST'), 200);
          status(await request('/auth/profile', token), 401);
        }
      );
    } finally {
      if (exam) await prisma.exam.delete({ where: { id: exam.id } });
      if (course) await prisma.course.delete({ where: { id: course.id } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
      await new Promise((resolve) => server.close(resolve));
      await disconnectDatabase();
    }
  }
);
