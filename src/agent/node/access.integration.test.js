const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
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
          assert.equal(explained.status, 200);
          assert.equal(explained.body.data.provider, 'deterministic');
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
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
  }
});
