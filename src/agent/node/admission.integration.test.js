const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const target = new URL(process.env.AI_TEST_DATABASE_URL || 'http://invalid');
assert.equal(target.hostname, '127.0.0.1');
assert.match(target.pathname, /^\/ai_lab_be01_(fresh|upgrade)_[a-f0-9]+$/);
Object.assign(process.env, {
  DATABASE_URL: target.toString(),
  JWT_SECRET: 'be03-test-only',
  LAB_AI_MODE: 'deterministic',
  AI_ENVIRONMENT: 'be03',
  AI_RECOVERY_EPOCH: 'epoch_test',
  AI_OWNER_SECRET: 'synthetic-owner-secret-at-least-32-characters',
});
const { fork } = require('node:child_process');
const path = require('node:path');
const { getPrisma, disconnectDatabase } = require('../../backend/src/config/database');
const { createAccessToken } = require('../../backend/src/security/session');
const { schemas } = require('@ccna/shared/aiLabContract');
const { labs } = require('../fixtures/labs/disc03');
test('BE-03 admission through two HTTP servers sharing PostgreSQL', async (t) => {
  const db = getPrisma();
  const servers = [0, 1].map(() =>
    fork(path.join(__dirname, 'fixtures/admission-server.cjs'), [], {
      env: process.env,
      execArgv: [],
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
      windowsHide: true,
    })
  );
  const addresses = await Promise.all(
    servers.map(
      (s) =>
        new Promise((resolve, reject) => {
          s.once('message', resolve);
          s.once('error', reject);
          s.once('exit', () => reject(new Error('Replica exited before readiness')));
        })
    )
  );
  assert.notEqual(addresses[0].pid, addresses[1].pid);
  const bases = addresses.map((s) => `http://127.0.0.1:${s.port}/api/lab-attempts`);
  const users = [];
  const attempts = [];
  const limits = {
    userMinute: 10,
    userDay: 2,
    globalDayMicros: 100,
    globalMonthMicros: 100,
    maxCostMicros: 2,
    versions: {
      contextSchemaVersion: '1.0.0',
      diagnosticVersion: 'test',
      promptVersion: 'test',
      modelVersion: 'fake',
      priceVersion: 'test',
      appCommit: '0'.repeat(40),
    },
  };
  try {
    const f = labs[0];
    const lab = await db.lab.create({
      data: {
        title: f.title,
        labType: 'CLI_SIMULATION',
        status: 'PUBLISHED',
        initialState: f.initialState,
        gradingSpec: f.gradingSpec,
      },
    });
    for (let i = 0; i < 3; i++) {
      const user = await db.user.create({
        data: {
          email: `${randomUUID()}@example.invalid`,
          passwordHash: 'synthetic',
          fullName: 'BE03',
        },
      });
      users.push(user);
      const r = await fetch(`${bases[0]}/labs/${lab.id}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${createAccessToken(user)}` },
      });
      assert.equal(r.status, 201);
      attempts.push((await r.json()).data.id);
    }
    await db.aiRuntimePolicy.create({
      data: {
        environment: 'be03',
        admissionEnabled: true,
        eligibilityRules: { userIds: users.map((u) => u.id), labIds: [lab.id] },
        limits,
      },
    });
    const input = {
      contractVersion: '1.0.0',
      clientRequestId: randomUUID(),
      intent: 'NEXT_STEP',
      expectedRevision: 0,
      conversationEpoch: 0,
      recoveryEpoch: 'epoch_test',
      message: 'Help',
    };
    const send = async (body, user = 0, replica = 0, path = '/requests', method = 'POST') => {
      const r = await fetch(`${bases[replica]}/${attempts[user]}/ai${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${createAccessToken(users[user])}`,
          'Content-Type': 'application/json',
        },
        ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
      });
      const value = await r.json();
      if (r.status >= 400) schemas.ErrorResponse.parse(value);
      else if (path.startsWith('/requests')) schemas.RequestResponse.parse(value);
      return { status: r.status, value };
    };
    let requestId;
    await t.test(
      '20 simultaneous retries across two servers create one request/message/outbox and three reservations',
      async () => {
        const results = await Promise.all(
          Array.from({ length: 20 }, (_, i) => send(input, 0, i % 2))
        );
        assert.ok(
          results.every((r) => r.status === 202),
          JSON.stringify(results)
        );
        requestId = results[0].value.data.requestId;
        assert.equal(new Set(results.map((r) => r.value.data.requestId)).size, 1);
        assert.equal(await db.aiMessage.count({ where: { requestId } }), 1);
        assert.equal(await db.aiReservation.count({ where: { requestId } }), 3);
        assert.equal(
          await db.aiEventOutbox.count({
            where: { payload: { path: ['requestId'], equals: requestId } },
          }),
          1
        );
      }
    );
    await t.test(
      'payload conflict, active limit, replay before stale and GET reconciliation',
      async () => {
        assert.equal(
          (await send({ ...input, message: 'Different' })).value.error.code,
          'AI_IDEMPOTENCY_CONFLICT'
        );
        assert.equal(
          (await send({ ...input, clientRequestId: randomUUID() })).value.error.code,
          'AI_CONCURRENT_LIMIT'
        );
        const a = await db.labAttempt.findUnique({ where: { id: attempts[0] } });
        await db.labAttempt.update({
          where: { id: a.id },
          data: { deviceState: { ...a.deviceState, revision: 1 } },
        });
        assert.equal((await send(input)).value.data.stale, true);
        assert.equal(
          (await send(null, 0, 1, `/requests/by-client-id/${input.clientRequestId}`, 'GET')).value
            .data.requestId,
          requestId
        );
        assert.equal(
          (await send({ ...input, clientRequestId: randomUUID() })).value.error.code,
          'AI_STALE_CONTEXT'
        );
        assert.equal(
          (
            await send({
              ...input,
              clientRequestId: randomUUID(),
              expectedRevision: 1,
              recoveryEpoch: 'old_epoch',
            })
          ).value.error.code,
          'AI_RECOVERY_RECONFIRM'
        );
      }
    );
    await t.test(
      'quota rejection rolls back request/message/outbox and bucket increments',
      async () => {
        await db.aiRequest.update({
          where: { id: requestId },
          data: { status: 'FAILED', finishedAt: new Date() },
        });
        const second = await send({ ...input, clientRequestId: randomUUID(), expectedRevision: 1 });
        assert.equal(second.status, 202);
        await db.aiRequest.update({
          where: { id: second.value.data.requestId },
          data: { status: 'FAILED', finishedAt: new Date() },
        });
        const before = await db.aiQuotaBucket.findMany({ orderBy: { id: 'asc' } });
        const rejectedId = randomUUID();
        assert.equal(
          (await send({ ...input, clientRequestId: rejectedId, expectedRevision: 1 })).value.error
            .code,
          'AI_QUOTA_EXHAUSTED'
        );
        assert.equal(await db.aiRequest.count({ where: { clientRequestId: rejectedId } }), 0);
        assert.deepEqual(await db.aiQuotaBucket.findMany({ orderBy: { id: 'asc' } }), before);
        assert.equal((await send(input)).status, 200);
      }
    );
    await t.test('global budget and per-user minute limits fail closed', async () => {
      await db.aiRuntimePolicy.update({
        where: { environment: 'be03' },
        data: { limits: { ...limits, globalDayMicros: 4 } },
      });
      assert.equal(
        (await send({ ...input, clientRequestId: randomUUID() }, 1)).value.error.code,
        'AI_BUDGET_PAUSED'
      );
      await db.aiRuntimePolicy.update({
        where: { environment: 'be03' },
        data: { limits: { ...limits, userMinute: 0 } },
      });
      assert.equal(
        (await send({ ...input, clientRequestId: randomUUID() }, 1)).value.error.code,
        'AI_USER_RATE_LIMITED'
      );
      assert.equal(await db.aiRequest.count({ where: { userId: users[1].id } }), 0);
      assert.equal(
        await db.aiProviderCall.count({
          where: { request: { userId: { in: users.map((u) => u.id) } } },
        }),
        0
      );
    });
    await t.test('capabilities/quota responses follow the public contract', async () => {
      schemas.CapabilitiesResponse.parse((await send(null, 0, 0, '/capabilities', 'GET')).value);
      schemas.QuotaResponse.parse((await send(null, 0, 0, '/quota', 'GET')).value);
    });
    await t.test('outbox DB failure rolls back all reservations and request data', async () => {
      await db.aiRuntimePolicy.update({ where: { environment: 'be03' }, data: { limits } });
      const before = await db.aiQuotaBucket.findMany({ orderBy: { id: 'asc' } });
      await db.$executeRawUnsafe(
        "CREATE FUNCTION be03_fail_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic fault'; END $$"
      );
      await db.$executeRawUnsafe(
        'CREATE TRIGGER be03_fail BEFORE INSERT ON ai_event_outbox FOR EACH ROW EXECUTE FUNCTION be03_fail_outbox()'
      );
      try {
        const clientRequestId = randomUUID();
        assert.equal((await send({ ...input, clientRequestId }, 1)).status, 500);
        assert.equal(await db.aiRequest.count({ where: { clientRequestId } }), 0);
        assert.deepEqual(await db.aiQuotaBucket.findMany({ orderBy: { id: 'asc' } }), before);
      } finally {
        await db.$executeRawUnsafe('DROP TRIGGER be03_fail ON ai_event_outbox');
        await db.$executeRawUnsafe('DROP FUNCTION be03_fail_outbox()');
      }
    });
    await t.test(
      'different users on two processes cannot overspend the shared global budget',
      async () => {
        await db.aiRuntimePolicy.update({
          where: { environment: 'be03' },
          data: { limits: { ...limits, globalDayMicros: 6 } },
        });
        const results = await Promise.all([
          send({ ...input, clientRequestId: randomUUID() }, 1, 0),
          send({ ...input, clientRequestId: randomUUID() }, 2, 1),
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [202, 503]);
        const b = await db.aiQuotaBucket.findFirst({
          where: { scopeType: 'GLOBAL_DAY', scopeKey: 'be03' },
        });
        assert.equal(b.reservedMicros, 6n);
      }
    );
  } finally {
    await Promise.all(
      servers.map(
        (s) =>
          new Promise((r) => {
            if (s.exitCode !== null) return r();
            s.once('exit', r);
            s.kill();
          })
      )
    );
    await disconnectDatabase();
  }
});
