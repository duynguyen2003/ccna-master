const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const target = new URL(process.env.AI_TEST_DATABASE_URL || 'http://invalid');
assert.equal(target.hostname, '127.0.0.1');
assert.match(target.pathname, /^\/ai_lab_be01_(fresh|upgrade)_[a-f0-9]+$/);
Object.assign(process.env, {
  DATABASE_URL: target.toString(),
  NODE_ENV: 'production',
  AI_ENVIRONMENT: 'production',
  AI_WORKER_MODE: 'production-gemini',
  AI_PRODUCTION_ENABLED: 'true',
  AI_RELEASE_SHA: 'a'.repeat(40),
  AI_RECOVERY_EPOCH: 'production_test_epoch',
  AI_OWNER_SECRET: 'synthetic-owner-secret-at-least-32-characters',
  AI_SERVICE_SECRET: 'synthetic-service-secret-at-least-32-characters',
  JWT_SECRET: 'synthetic-session-secret-at-least-32-characters',
  JWT_REFRESH_SECRET: 'synthetic-refresh-secret-at-least-32-characters',
  GEMINI_API_KEY: 'synthetic-never-sent-to-provider',
  GEMINI_MODEL: 'gemini-3.5-flash-lite',
  LAB_AI_MODE: 'deterministic',
  FRONTEND_URL: 'https://frontend.example.invalid',
  CORS_ORIGIN: 'https://frontend.example.invalid',
});
const app = require('../../backend/src/Server');
const { getPrisma, disconnectDatabase } = require('../../backend/src/config/database');
const { createAccessToken } = require('../../backend/src/security/session');
const { productionPlan, previewProduction, applyProduction } = require('./productionPolicy');
const { labs } = require('../fixtures/labs/disc03');

test('production student rollout, atomic validation, accounting and rollback on isolated PostgreSQL', async () => {
  const db = getPrisma();
  const client = new Client({ connectionString: target.toString(), query_timeout: 10000 });
  await client.connect();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/lab-attempts`;
  try {
    const user = (role) =>
      db.user.create({
        data: {
          email: `${randomUUID()}@example.invalid`,
          passwordHash: 'synthetic',
          fullName: 'Production QA',
          role,
        },
      });
    const admin = await user('ADMIN');
    const student = await user('STUDENT');
    const fixture = labs[0];
    const lab = await db.lab.create({
      data: {
        title: 'Production opt-in QA',
        objective: fixture.objective,
        labType: 'CLI_SIMULATION',
        status: 'PUBLISHED',
        initialState: fixture.initialState,
        gradingSpec: fixture.gradingSpec,
      },
    });
    const token = createAccessToken(student);
    const call = async (path, method = 'GET', body) => {
      const response = await fetch(base + path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    };
    const started = await call(`/labs/${lab.id}/start`, 'POST');
    assert.equal(started.status, 201, JSON.stringify(started.body));
    const attempt = started.body.data.id;
    assert.equal((await call(`/${attempt}/ai/capabilities`)).status, 403);
    const plan = productionPlan(process.env, {
      actorId: admin.id,
      studentAccess: true,
      labIds: [lab.id],
      userIds: [],
      limits: {
        userMinute: 2,
        userDay: 20,
        globalDayMicros: 50000,
        globalMonthMicros: 100000,
        globalConcurrency: 1,
      },
    });
    await client.query('BEGIN READ ONLY');
    assert.equal((await previewProduction(client, plan)).publishedLabCount, 1);
    await client.query('ROLLBACK');
    await applyProduction(client, plan);
    assert.equal((await call(`/${attempt}/ai/capabilities`)).status, 200);
    const policy = () => db.aiRuntimePolicy.findUnique({ where: { environment: 'production' } });
    const initial = await policy();
    assert.equal((await applyProduction(client, plan)).changed, false);
    assert.equal((await policy()).version, initial.version);
    const peer = new Client({ connectionString: target.toString(), query_timeout: 10000 });
    await peer.connect();
    try {
      const concurrent = await Promise.all([
        applyProduction(client, plan),
        applyProduction(peer, plan),
        call(`/${attempt}/ai/capabilities`),
      ]);
      assert.equal(concurrent[0].changed, false);
      assert.equal(concurrent[1].changed, false);
      assert.equal(concurrent[2].status, 200);
      assert.equal((await policy()).version, initial.version);
    } finally {
      await peer.end();
    }
    await assert.rejects(applyProduction(client, { ...plan, actorId: student.id }), {
      code: 'AI_PRODUCTION_ADMIN_REQUIRED',
    });
    await assert.rejects(
      applyProduction(client, {
        ...plan,
        eligibilityRules: { ...plan.eligibilityRules, labIds: [2147483647] },
      }),
      { code: 'AI_PRODUCTION_LABS_UNAVAILABLE' }
    );
    assert.equal((await policy()).version, initial.version);
    await db.user.update({ where: { id: student.id }, data: { role: 'ADMIN' } });
    assert.equal((await call(`/${attempt}/ai/capabilities`)).status, 403);
    await db.user.update({ where: { id: student.id }, data: { role: 'STUDENT' } });
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    const bucket = await db.aiQuotaBucket.create({
      data: {
        scopeType: 'GLOBAL_DAY',
        scopeKey: 'production',
        windowStart: day,
        windowEnd: new Date(+day + 86400000),
        limitMicros: 50000n,
        spentMicros: 1000n,
      },
    });
    const updated = { ...plan, limits: { ...plan.limits, globalDayMicros: 60000 } };
    await applyProduction(client, updated);
    assert.equal(
      (await db.aiQuotaBucket.findUnique({ where: { id: bucket.id } })).spentMicros,
      1000n
    );
    const request = {
      contractVersion: '1.0.0',
      clientRequestId: randomUUID(),
      intent: 'NEXT_STEP',
      expectedRevision: 0,
      conversationEpoch: 0,
      recoveryEpoch: 'production_test_epoch',
      message: 'Synthetic production permission test',
    };
    const admitted = await call(`/${attempt}/ai/requests`, 'POST', request);
    assert.equal(admitted.status, 202, JSON.stringify(admitted.body));
    await assert.rejects(applyProduction(client, plan), { code: 'AI_PRODUCTION_DRAIN_REQUIRED' });
    await applyProduction(client, { actorId: admin.id }, { disable: true });
    const off = await policy();
    assert.equal(off.admissionEnabled, false);
    assert.equal(off.dispatchEnabled, false);
    assert.equal((await call(`/${attempt}/ai/capabilities`)).status, 403);
    assert.equal(
      (await db.aiQuotaBucket.findUnique({ where: { id: bucket.id } })).spentMicros,
      1000n
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await client.end();
    await disconnectDatabase();
  }
});
