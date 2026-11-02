const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const target = new URL(process.env.AI_TEST_DATABASE_URL || 'http://invalid');
assert.equal(target.hostname, '127.0.0.1');
assert.match(target.pathname, /^\/ai_lab_be01_(fresh|upgrade)_[a-f0-9]+$/);
process.env.DATABASE_URL = target.toString();
process.env.JWT_SECRET = 'synthetic-be02-local-only';
process.env.LAB_AI_MODE = 'deterministic';
process.env.AI_ENVIRONMENT = 'be02-test';
const app = require('../../backend/src/Server');
const { getPrisma, disconnectDatabase } = require('../../backend/src/config/database');
const { createAccessToken } = require('../../backend/src/security/session');
const { withAiAccess } = require('./access');
const { captureSnapshot } = require('./snapshot');
const { labs } = require('../fixtures/labs/disc03');
test('BE-02 real HTTP and PostgreSQL: auth, snapshots, isolation and explain connection', async (t) => {
  const db = getPrisma();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/lab-attempts`;
  const users = [];
  try {
    for (let i = 0; i < 3; i++)
      users.push(
        await db.user.create({
          data: {
            email: `${randomUUID()}@example.invalid`,
            passwordHash: 'synthetic',
            fullName: 'BE02',
          },
        })
      );
    const tokens = users.map(createAccessToken);
    const request = async (path, token = tokens[0], method = 'GET') => {
      const response = await fetch(base + path, {
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return { status: response.status, body: await response.json() };
    };
    for (const fixture of labs) {
      const lab = await db.lab.create({
        data: {
          title: fixture.title,
          objective: fixture.objective,
          labType: 'CLI_SIMULATION',
          status: 'PUBLISHED',
          initialState: fixture.initialState,
          gradingSpec: fixture.gradingSpec,
        },
      });
      const started = await request(`/labs/${lab.id}/start`, tokens[0], 'POST');
      assert.equal(started.status, 201, JSON.stringify(started.body));
      const id = started.body.data.id;
      await db.aiRuntimePolicy.upsert({
        where: { environment: 'be02-test' },
        create: {
          environment: 'be02-test',
          admissionEnabled: true,
          eligibilityRules: { userIds: users.map((u) => u.id), labIds: [lab.id] },
        },
        update: { eligibilityRules: { userIds: users.map((u) => u.id), labIds: [lab.id] } },
      });
      const scope = {
        principal: { id: users[0].id, sessionVersion: users[0].sessionVersion },
        attemptId: id,
        environment: 'be02-test',
      };
      const capture = () =>
        withAiAccess(db, scope, async (_, { attempt }) => captureSnapshot(attempt));
      await t.test(
        `${fixture.id}: metadata, snapshot and feedback remain tied to revision`,
        async () => {
          const snap = await capture();
          const original = JSON.stringify(snap);
          assert.equal(snap.publicMetadataProvenance, 'CAPTURED_AT_ATTEMPT_START');
          assert.doesNotMatch(original, /gradingSpec|passwordHash|expected/);
          await db.lab.update({ where: { id: lab.id }, data: { title: 'Changed after start' } });
          assert.equal((await capture()).publicMetadata.title, fixture.title);
          assert.equal(JSON.stringify(snap), original);
          const submitted = await request(`/${id}/submit`, tokens[0], 'POST');
          assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
          let a = await db.labAttempt.findUnique({ where: { id }, include: { lab: true } });
          const review = captureSnapshot(a, 'LAB_REVIEW');
          assert.equal(review.sourceRevision, 0);
          assert.equal(review.sourceProvenance, 'FEEDBACK_SNAPSHOT');
          a.deviceState.revision = 99;
          assert.deepEqual(captureSnapshot(a, 'LAB_REVIEW'), review);
          a.feedbackRevision = null;
          a.safeFeedbackSnapshot = null;
          assert.equal(captureSnapshot(a, 'LAB_REVIEW').sourceRevision, null);
          const explained = await request(`/${id}/explain`, tokens[0], 'POST');
          assert.equal(explained.status, 503);
          assert.equal(explained.body.data, undefined);
        }
      );
      await t.test(`${fixture.id}: HTTP Bearer-only and revoked access`, async () => {
        assert.equal((await request(`/${id}/ai?token=${tokens[0]}`, null)).status, 401);
        assert.equal((await request(`/${id}/ai`, tokens[2])).status, 404);
        await db.user.update({ where: { id: users[0].id }, data: { isActive: false } });
        assert.equal((await request(`/${id}/ai`)).status, 401);
        await db.user.update({ where: { id: users[0].id }, data: { isActive: true } });
        await db.labAttempt.update({ where: { id }, data: { members: [users[1].id] } });
        const member = {
          ...scope,
          principal: { id: users[1].id, sessionVersion: users[1].sessionVersion },
        };
        await withAiAccess(db, member, async () => {});
        const chat = await db.aiConversation.create({
          data: { userId: users[1].id, attemptId: id, ownerKey: randomUUID() },
        });
        await assert.rejects(
          withAiAccess(db, { ...scope, conversationId: chat.id, epoch: 0 }, async () => {}),
          { status: 404 }
        );
        await assert.rejects(
          withAiAccess(db, { ...member, conversationId: chat.id, epoch: 1 }, async () => {}),
          { status: 409 }
        );
        await db.labAttempt.update({ where: { id }, data: { members: [] } });
        await assert.rejects(
          withAiAccess(db, member, async () => {}),
          { status: 404 }
        );
      });
      if (fixture === labs[0])
        await t.test(
          'admin opt-in reads current DB role and preserves ownership and kill switch',
          async () => {
            const policy = await db.aiRuntimePolicy.findUnique({
              where: { environment: 'be02-test' },
            });
            await db.aiRuntimePolicy.update({
              where: { environment: 'be02-test' },
              data: { eligibilityRules: { adminAccess: true, userIds: [], labIds: [] } },
            });
            // The preexisting token was issued with the ordinary student role.
            await db.user.update({ where: { id: users[0].id }, data: { role: 'ADMIN' } });
            assert.equal(await withAiAccess(db, scope, async (_, c) => c.user.role), 'ADMIN');
            await db.aiRuntimePolicy.update({
              where: { environment: 'be02-test' },
              data: { admissionEnabled: false },
            });
            await assert.rejects(
              withAiAccess(db, scope, async () => {}),
              { status: 403 }
            );
            await db.aiRuntimePolicy.update({
              where: { environment: 'be02-test' },
              data: { admissionEnabled: true },
            });
            // A new signed ADMIN claim cannot retain access after demotion in DB.
            const adminToken = jwt.sign(
              { id: users[0].id, sessionVersion: users[0].sessionVersion, role: 'ADMIN' },
              process.env.JWT_SECRET,
              { expiresIn: '1m', algorithm: 'HS256' }
            );
            await db.user.update({ where: { id: users[0].id }, data: { role: users[0].role } });
            assert.equal((await request(`/${id}/ai/capabilities`, adminToken)).status, 403);
            assert.equal((await request(`/${id}/ai/capabilities`, tokens[2])).status, 404);
            await db.aiRuntimePolicy.update({
              where: { environment: 'be02-test' },
              data: { eligibilityRules: policy.eligibilityRules },
            });
          }
        );
    }
    await t.test(
      'only opted-in dev admins can start a published lab behind prerequisites',
      async () => {
        await db.course.createMany({
          data: [
            {
              id: 'adt-first',
              code: 'ADTF',
              title: 'Prerequisite',
              status: 'PUBLISHED',
              orderIndex: 1000000,
            },
            {
              id: 'adt-next',
              code: 'ADTN',
              title: 'Locked course',
              status: 'PUBLISHED',
              orderIndex: 1000001,
            },
          ],
        });
        await db.module.create({
          data: { id: 'adt-mod', courseId: 'adt-first', title: 'Required module', orderIndex: 1 },
        });
        await db.lesson.create({
          data: { moduleId: 'adt-mod', title: 'Required lesson', orderIndex: 1 },
        });
        const lab = await db.lab.create({
          data: {
            title: 'Admin test locked lab',
            courseId: 'adt-next',
            status: 'PUBLISHED',
            labType: 'CLI_SIMULATION',
            initialState: labs[0].initialState,
            gradingSpec: labs[0].gradingSpec,
          },
        });
        await db.aiRuntimePolicy.create({
          data: {
            environment: 'admin-test',
            admissionEnabled: true,
            eligibilityRules: { adminAccess: true },
          },
        });
        const previousEnv = process.env.AI_ENVIRONMENT;
        try {
          const start = () => request(`/labs/${lab.id}/start`, tokens[0], 'POST');
          await db.user.update({ where: { id: users[0].id }, data: { role: 'ADMIN' } });
          assert.equal((await start()).status, 403); // Other environments stay gated.
          process.env.AI_ENVIRONMENT = 'admin-test';
          assert.equal((await start()).status, 201);
          await db.user.update({ where: { id: users[0].id }, data: { role: 'STUDENT' } });
          assert.equal((await start()).status, 403);
          await db.user.update({ where: { id: users[0].id }, data: { role: 'ADMIN' } });
          await db.aiRuntimePolicy.update({
            where: { environment: 'admin-test' },
            data: { admissionEnabled: false },
          });
          assert.equal((await start()).status, 403);
          await db.aiRuntimePolicy.update({
            where: { environment: 'admin-test' },
            data: { admissionEnabled: true },
          });
          await db.lab.update({ where: { id: lab.id }, data: { status: 'DRAFT' } });
          assert.equal((await start()).status, 404);
        } finally {
          process.env.AI_ENVIRONMENT = previousEnv;
          await db.user.update({ where: { id: users[0].id }, data: { role: users[0].role } });
        }
      }
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
  }
});
