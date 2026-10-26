const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { fork } = require('node:child_process');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const jwt = require('jsonwebtoken');
const target = new URL(process.env.AI_TEST_DATABASE_URL || 'http://invalid');
assert.equal(target.hostname, '127.0.0.1');
assert.match(target.pathname, /^\/ai_lab_be01_(fresh|upgrade)_[a-f0-9]+$/);
Object.assign(process.env, {
  DATABASE_URL: target.toString(),
  JWT_SECRET: 'be04-user-test-only',
  LAB_AI_MODE: 'deterministic',
  AI_ENVIRONMENT: 'be04',
  AI_RECOVERY_EPOCH: 'epoch_be04',
  AI_OWNER_SECRET: 'synthetic-owner-secret-at-least-32-characters',
  AI_SERVICE_SECRET: 'synthetic-service-secret-at-least-32-characters',
});
const { getPrisma, disconnectDatabase } = require('../../backend/src/config/database');
const { createAccessToken } = require('../../backend/src/security/session');
const { serviceAuth } = require('./serviceAuth');
const { service } = require('./requests');
const { receipts } = require('./receipts');
const { dispatch } = require('./dispatch');
const { fakePrepare } = require('../workers/aiWorker');
const { schemas, parseRequestResource } = require('@ccna/shared/aiLabContract');
const { labs } = require('../fixtures/labs/disc03');

test('BE-04 durable workers, permits and accounting on isolated PostgreSQL', async (t) => {
  const db = getPrisma();
  const config = require('./fixtures/worker-config.cjs')();
  const auth = serviceAuth(config.auth);
  const api = service(db, config);
  const results = receipts(db, config);
  const peers = [];
  async function spawn() {
    const child = fork(path.join(__dirname, 'fixtures/worker-peer.cjs'), [], {
      env: process.env,
      execArgv: [],
      serialization: 'advanced',
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
      windowsHide: true,
    });
    const pending = new Map();
    const ready = await new Promise((resolve, reject) => {
      child.on('message', (message) => {
        if (message.ready) resolve(message);
        else {
          const slot = pending.get(message.id);
          if (slot) {
            pending.delete(message.id);
            if (message.error)
              slot.reject(Object.assign(new Error(message.error), { code: message.error }));
            else slot.resolve(message.value);
          }
        }
      });
      child.once('error', reject);
      child.once('exit', () => {
        reject(new Error('Peer exited'));
        for (const slot of pending.values()) slot.reject(new Error('Peer exited'));
        pending.clear();
      });
    });
    const peer = {
      child,
      base: `http://127.0.0.1:${ready.port}`,
      pid: ready.pid,
      rpc(action, ...args) {
        return new Promise((resolve, reject) => {
          const id = randomUUID();
          pending.set(id, { resolve, reject });
          child.send({ id, action, args });
        });
      },
    };
    peers.push(peer);
    return peer;
  }
  async function stop(peer) {
    if (peer.child.exitCode !== null || peer.child.signalCode) return;
    await new Promise((resolve) => {
      peer.child.once('exit', resolve);
      peer.child.kill();
    });
  }
  let a;
  let b;
  let lab;
  const limits = {
    userMinute: 100,
    userDay: 100,
    globalDayMicros: 100000,
    globalMonthMicros: 100000,
    maxCostMicros: 20,
    globalConcurrency: 2,
    versions: { ...config.providers['synthetic-paid'].versions, appCommit: '0'.repeat(40) },
  };
  async function fresh() {
    const user = await db.user.create({
      data: {
        email: `${randomUUID()}@example.invalid`,
        fullName: 'BE04 synthetic',
        passwordHash: 'synthetic',
      },
    });
    const started = await fetch(`${a.base}/api/lab-attempts/labs/${lab.id}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${createAccessToken(user)}` },
    });
    assert.equal(started.status, 201);
    const attemptId = (await started.json()).data.id;
    const policy = await db.aiRuntimePolicy.findUnique({ where: { environment: 'be04' } });
    await db.aiRuntimePolicy.update({
      where: { environment: 'be04' },
      data: {
        admissionEnabled: true,
        dispatchEnabled: true,
        limits,
        eligibilityRules: {
          userIds: [...policy.eligibilityRules.userIds, user.id],
          labIds: [lab.id],
        },
      },
    });
    const principal = { id: user.id, sessionVersion: user.sessionVersion };
    const body = {
      contractVersion: '1.0.0',
      clientRequestId: randomUUID(),
      intent: 'NEXT_STEP',
      expectedRevision: 0,
      conversationEpoch: 0,
      recoveryEpoch: 'epoch_be04',
      message: 'Synthetic help',
    };
    const created = await api.create(principal, attemptId, body);
    const row = await db.aiRequest.findUnique({ where: { id: created.data.requestId } });
    assert.ok(
      +row.deadlineAt - +row.createdAt > 59000 && +row.deadlineAt - +row.createdAt < 61000,
      'DB deadline must be 60 seconds after creation, including non-UTC PostgreSQL sessions'
    );
    return { user, principal, attemptId, id: created.data.requestId };
  }
  async function plan(job, peer = a) {
    const row = await peer.rpc('claim');
    if (!row)
      assert.fail(
        JSON.stringify(
          await db.$queryRaw`SELECT
      created_at::text AS created, deadline_at::text AS deadline, clock_timestamp()::text AS now,
      extract(epoch FROM (deadline_at-clock_timestamp()))::text AS remaining
      FROM ai_requests WHERE id=${job.id}::uuid`
        )
      );
    assert.equal(row.id, job.id);
    return peer.rpc('plan', row.id);
  }
  const binding = (input) =>
    schemas.ClaimRequest.parse({
      contractVersion: '1.0.0',
      requestId: input.requestId,
      callId: input.callId,
      contextHash: input.contextHash,
      leaseVersion: input.leaseVersion,
    });
  const receiptFor = (input, overrides = {}) => ({
    ...binding(input),
    outcome: 'RECEIVED',
    providerRequestId: 'synthetic-provider-id',
    usage: { status: 'FINAL', inputTokens: 2, outputTokens: 3, reasoningTokens: 0 },
    versions: input.versions,
    finishReason: 'stop',
    output: {
      summary: 'Synthetic answer',
      claimType: 'INSUFFICIENT_CONTEXT',
      evidenceIds: [],
      nextSteps: [],
      verification: 'Check the lab',
      hintLevel: 1,
    },
    ...overrides,
  });
  async function internal(input, operation, body, peer = a, token) {
    const r = await fetch(
      `${peer.base}/internal/v1/ai/provider-calls/${input.callId}/${operation}`,
      {
        method: operation === 'claim' ? 'POST' : 'PUT',
        headers: {
          Authorization: `Bearer ${token || auth.sign(operation === 'claim' ? 'CLAIM' : 'RECEIPT', input, new Date(Date.now() + 60000))}`,
          'Content-Type': 'application/json',
          'X-AI-Contract-Version': '1.0.0',
        },
        body: JSON.stringify(body),
      }
    );
    const value = await r.json();
    if (r.status >= 400) schemas.ErrorResponse.parse(value);
    return { status: r.status, value };
  }
  async function expireLease(id) {
    await db.aiRequest.update({
      where: { id },
      data: { leaseExpiresAt: new Date(Date.now() - 1000) },
    });
  }
  async function expireExecution(input) {
    const call = await db.aiProviderCall.findUnique({ where: { id: input.callId } });
    await db.aiProviderCall.update({
      where: { id: call.id },
      data: {
        analyzeInput: {
          ...call.analyzeInput,
          deadlineAt: new Date(Date.now() - 6000).toISOString(),
        },
      },
    });
    await db.aiExecutionSlot.updateMany({
      where: { callId: call.id },
      data: {
        acquiredAt: new Date(Date.now() - 30000),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
  }
  async function assertAccounting(id, cost, units, reserved = 0n) {
    const reservations = await db.aiReservation.findMany({
      where: { requestId: id },
      include: { bucket: true },
    });
    assert.equal(reservations.length, 3);
    for (const r of reservations) {
      assert.equal(r.bucket.spentMicros >= cost, true);
      assert.equal(r.bucket.reservedMicros >= reserved, true);
      if (r.bucket.scopeType === 'USER_DAY') {
        assert.equal(r.bucket.usedUnits, units);
        assert.equal(r.bucket.reservedUnits, 0);
        assert.equal(r.bucket.spentMicros, cost);
        assert.equal(r.bucket.reservedMicros, reserved);
      }
    }
  }
  try {
    a = await spawn();
    b = await spawn();
    assert.notEqual(a.pid, b.pid);
    const f = labs[0];
    lab = await db.lab.create({
      data: {
        title: f.title,
        labType: 'CLI_SIMULATION',
        status: 'PUBLISHED',
        initialState: f.initialState,
        gradingSpec: f.gradingSpec,
      },
    });
    await db.aiRuntimePolicy.create({
      data: {
        environment: 'be04',
        admissionEnabled: true,
        dispatchEnabled: true,
        providerConfigId: 'synthetic-paid',
        eligibilityRules: { userIds: [], labIds: [lab.id] },
        limits,
      },
    });

    await t.test(
      'DB clock is UTC-correct in non-UTC sessions and settlement uses original reserved windows',
      async () => {
        const { clock } = require('./lifecycle');
        await db.$transaction(async (tx) => {
          await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'Asia/Bangkok'");
          assert.ok(Math.abs(+(await clock(tx)) - Date.now()) < 3000);
          await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'America/Los_Angeles'");
          assert.ok(Math.abs(+(await clock(tx)) - Date.now()) < 3000);
        });
        const j = await fresh();
        const input = await plan(j);
        await internal(input, 'claim', binding(input));
        const r = await db.aiReservation.findFirst({
          where: { requestId: j.id, bucket: { scopeType: 'USER_DAY' } },
          include: { bucket: true },
        });
        await db.aiQuotaBucket.update({
          where: { id: r.bucketId },
          data: {
            windowStart: new Date(+r.bucket.windowStart - 86400000),
            windowEnd: r.bucket.windowStart,
          },
        });
        await internal(input, 'receipt', receiptFor(input));
        await results.finalize(j.id);
        await assertAccounting(j.id, 5n, 1);
        assert.equal(
          (await api.info(j.principal, j.attemptId, true)).data.quota.remaining,
          limits.userDay
        );
      }
    );

    await t.test(
      'two workers claim once; death before dispatch reclaims same call with a new fence',
      async () => {
        const j = await fresh();
        const claimed = await Promise.all([a.rpc('claim'), b.rpc('claim')]);
        assert.equal(claimed.filter(Boolean).length, 1);
        const owner = claimed[0] ? a : b;
        const old = await owner.rpc('plan', j.id);
        await stop(owner);
        await expireLease(j.id);
        const survivor = owner === a ? b : a;
        await survivor.rpc('reap');
        const again = await survivor.rpc('claim');
        assert.equal(again.leaseVersion, old.leaseVersion + 1);
        const next = await survivor.rpc('plan', j.id);
        assert.equal(next.callId, old.callId);
        assert.equal((await internal(old, 'claim', binding(old), survivor)).status, 409);
        await assert.rejects(survivor.rpc('heartbeat', j.id, old.leaseVersion), {
          code: 'AI_LEASE_LOST',
        });
        await assert.rejects(
          dispatch(db, config).plan(
            j.id,
            `peer_${owner.pid}`,
            old.leaseVersion,
            fakePrepare(again)
          ),
          { code: 'AI_LEASE_LOST' }
        );
        await results.cancel(j.id, j.principal, j.attemptId);
        await assertAccounting(j.id, 0n, 0);
        if (owner === a) a = await spawn();
        else b = await spawn();
      }
    );

    await t.test(
      '20 permit/receipt races through two HTTP replicas settle and publish once',
      async () => {
        const j = await fresh();
        const input = await plan(j);
        const claims = await Promise.all(
          Array.from({ length: 20 }, (_, i) =>
            internal(input, 'claim', binding(input), i % 2 ? a : b)
          )
        );
        assert.equal(claims.filter((r) => r.status === 200).length, 1);
        await assert.rejects(
          results.reconcile(j.id, 'too_early', {
            status: 'FINAL',
            inputTokens: 2,
            outputTokens: 3,
            reasoningTokens: 0,
          }),
          { code: 'AI_INVALID_REQUEST' }
        );
        assert.equal(
          claims.filter((r) => r.value.error?.code === 'AI_DISPATCH_ALREADY_CLAIMED').length,
          19
        );
        const receipt = receiptFor(input);
        const saved = await Promise.all(
          Array.from({ length: 20 }, (_, i) => internal(input, 'receipt', receipt, i % 2 ? a : b))
        );
        assert.ok(saved.every((r) => r.status === 200));
        assert.equal(new Set(saved.map((r) => r.value.data.receiptHash)).size, 1);
        const finalized = await Promise.all([a.rpc('finalize', j.id), b.rpc('finalize', j.id)]);
        assert.equal(finalized.filter(Boolean).length, 1);
        assert.equal(
          await db.aiMessage.count({ where: { requestId: j.id, role: 'ASSISTANT' } }),
          1
        );
        await assertAccounting(j.id, 5n, 1);
        const response = await api.read(j.principal, j.attemptId, 'id', j.id);
        parseRequestResource(response.data);
        assert.equal(response.data.responseMode, 'LLM');
        const conflict = await internal(input, 'receipt', { ...receipt, finishReason: 'changed' });
        assert.equal(conflict.value.error.code, 'AI_RECEIPT_CONFLICT');
        assert.equal(
          await db.aiEventOutbox.count({
            where: { type: 'AI_RECEIPT_CONFLICT', payload: { path: ['requestId'], equals: j.id } },
          }),
          1
        );
        assert.equal(
          await db.aiEventOutbox.count({
            where: { type: 'AI_REQUEST_COMPLETED', payload: { path: ['requestId'], equals: j.id } },
          }),
          1
        );
      }
    );

    await t.test(
      'receipt survives worker death and lost analyze ACK; reaper finalizes without generation',
      async () => {
        const j = await fresh();
        const input = await plan(j);
        assert.equal((await internal(input, 'claim', binding(input))).status, 200);
        assert.equal((await internal(input, 'receipt', receiptFor(input))).status, 200);
        await stop(a);
        await expireLease(j.id);
        await b.rpc('reap');
        assert.equal((await db.aiRequest.findUnique({ where: { id: j.id } })).status, 'COMPLETED');
        assert.equal(await db.aiProviderCall.count({ where: { requestId: j.id } }), 1);
        await assertAccounting(j.id, 5n, 1);
        a = await spawn();
      }
    );

    await t.test(
      'death after permit holds slot until deadline/grace, becomes unknown and never redispatches',
      async () => {
        const j = await fresh();
        const input = await plan(j);
        await internal(input, 'claim', binding(input));
        await stop(a);
        await expireLease(j.id);
        await b.rpc('reap');
        assert.equal((await db.aiRequest.findUnique({ where: { id: j.id } })).status, 'RUNNING');
        assert.equal(await db.aiExecutionSlot.count({ where: { requestId: j.id } }), 1);
        assert.equal(await b.rpc('claim'), null);
        await expireExecution(input);
        await b.rpc('reap');
        assert.equal(
          (await db.aiRequest.findUnique({ where: { id: j.id } })).status,
          'OUTCOME_UNKNOWN'
        );
        assert.equal(await db.aiExecutionSlot.count({ where: { requestId: j.id } }), 0);
        await assertAccounting(j.id, 0n, 0, 20n);
        assert.equal((await internal(input, 'claim', binding(input), b)).status, 409);
        assert.equal((await internal(input, 'receipt', receiptFor(input), b)).status, 200);
        const call = await db.aiProviderCall.findUnique({ where: { id: input.callId } });
        assert.equal(call.receiptPayload, null);
        assert.equal(call.state, 'RECEIVED');
        assert.equal(
          await db.aiMessage.count({ where: { requestId: j.id, role: 'ASSISTANT' } }),
          0
        );
        assert.equal(
          (await db.aiRequest.findUnique({ where: { id: j.id } })).status,
          'OUTCOME_UNKNOWN'
        );
        await assertAccounting(j.id, 5n, 0);
        a = await spawn();
      }
    );

    await t.test(
      'cancel before dispatch releases; cancel after dispatch preserves money and suppresses late text',
      async () => {
        const early = await fresh();
        const x = await plan(early);
        await results.cancel(early.id, early.principal, early.attemptId);
        assert.equal((await internal(x, 'claim', binding(x))).status, 409);
        await assertAccounting(early.id, 0n, 0);
        const j = await fresh();
        const input = await plan(j);
        await internal(input, 'claim', binding(input));
        await Promise.all([
          results.cancel(j.id, j.principal, j.attemptId),
          results.cancel(j.id, j.principal, j.attemptId),
        ]);
        await assertAccounting(j.id, 0n, 0, 20n);
        assert.equal(await db.aiExecutionSlot.count({ where: { requestId: j.id } }), 1);
        await internal(input, 'receipt', receiptFor(input));
        await results.finalize(j.id);
        assert.equal((await db.aiRequest.findUnique({ where: { id: j.id } })).status, 'CANCELLED');
        assert.equal(
          (await db.aiProviderCall.findUnique({ where: { id: input.callId } })).receiptPayload,
          null
        );
        await assertAccounting(j.id, 5n, 0);
      }
    );

    await t.test(
      'session revoke and conversation delete suppress content but retain accounting',
      async () => {
        for (const deleted of [false, true]) {
          const j = await fresh();
          const input = await plan(j);
          await internal(input, 'claim', binding(input));
          const row = await db.aiRequest.findUnique({ where: { id: j.id } });
          if (deleted)
            await db.aiConversation.update({
              where: { id: row.conversationId },
              data: { deletedAt: new Date(), epoch: { increment: 1 } },
            });
          else
            await db.user.update({
              where: { id: j.user.id },
              data: { sessionVersion: { increment: 1 } },
            });
          await internal(input, 'receipt', receiptFor(input));
          await b.rpc('reap');
          assert.equal(
            (await db.aiRequest.findUnique({ where: { id: j.id } })).status,
            deleted ? 'DELETED' : 'REVOKED'
          );
          assert.equal(
            (await db.aiProviderCall.findUnique({ where: { id: input.callId } })).receiptPayload,
            null
          );
          assert.equal(
            await db.aiMessage.count({ where: { requestId: j.id, role: 'ASSISTANT' } }),
            0
          );
          await assertAccounting(j.id, 5n, 0);
        }
      }
    );

    await t.test(
      'internal authentication rejects user JWT, wrong operation, expired token and wrong call binding',
      async () => {
        const j = await fresh();
        const input = await plan(j);
        const oldClaims = jwt.decode(auth.sign('CLAIM', input, new Date(Date.now() + 60000)));
        for (const token of [
          createAccessToken(j.user),
          auth.sign('RECEIPT', input, new Date(Date.now() + 60000)),
          jwt.sign(
            { ...oldClaims, iat: oldClaims.iat - 120, exp: oldClaims.iat - 60 },
            config.auth.secret,
            { algorithm: 'HS256', header: { kid: 'local-v1' } }
          ),
          auth.sign('CLAIM', { ...input, callId: randomUUID() }, new Date(Date.now() + 60000)),
        ]) {
          assert.equal((await internal(input, 'claim', binding(input), a, token)).status, 401);
        }
        const policy = await db.aiRuntimePolicy.findUnique({ where: { environment: 'be04' } });
        await db.aiRuntimePolicy.update({
          where: { environment: 'be04' },
          data: { dispatchEnabled: false },
        });
        assert.equal((await internal(input, 'claim', binding(input))).status, 503);
        await db.aiRuntimePolicy.update({
          where: { environment: 'be04' },
          data: { dispatchEnabled: policy.dispatchEnabled },
        });
        await db.aiRuntimePolicy.update({
          where: { environment: 'be04' },
          data: { limits: { ...limits, globalDayMicros: 0 } },
        });
        assert.equal(
          (await internal(input, 'claim', binding(input))).value.error.code,
          'AI_BUDGET_PAUSED'
        );
        await db.aiRuntimePolicy.update({ where: { environment: 'be04' }, data: { limits } });
        await results.cancel(j.id, j.principal, j.attemptId);
      }
    );

    await t.test(
      'queue expiry, live heartbeat, current cohort and shared capacity are enforced',
      async () => {
        const expired = await fresh();
        await db.aiRequest.update({
          where: { id: expired.id },
          data: { createdAt: new Date(Date.now() - 11000) },
        });
        await b.rpc('reap');
        assert.equal(
          (await db.aiRequest.findUnique({ where: { id: expired.id } })).status,
          'EXPIRED'
        );
        await assertAccounting(expired.id, 0n, 0);
        const j = await fresh();
        const x = await plan(j);
        await a.rpc('heartbeat', j.id, x.leaseVersion);
        assert.ok(
          (await db.aiRequest.findUnique({ where: { id: j.id } })).leaseExpiresAt >
            new Date(Date.now() + 10000)
        );
        const policy = await db.aiRuntimePolicy.findUnique({ where: { environment: 'be04' } });
        await db.aiRuntimePolicy.update({
          where: { environment: 'be04' },
          data: {
            eligibilityRules: {
              ...policy.eligibilityRules,
              userIds: policy.eligibilityRules.userIds.filter((id) => id !== j.user.id),
            },
          },
        });
        assert.equal((await internal(x, 'claim', binding(x))).status, 503);
        await b.rpc('reap');
        await assertAccounting(j.id, 0n, 0);
        const one = await fresh();
        const i1 = await plan(one);
        await internal(i1, 'claim', binding(i1));
        const two = await fresh();
        const i2 = await plan(two);
        await internal(i2, 'claim', binding(i2));
        await internal(i1, 'receipt', receiptFor(i1));
        await results.finalize(one.id);
        const three = await fresh();
        const i3 = await plan(three);
        await db.aiRuntimePolicy.update({
          where: { environment: 'be04' },
          data: { limits: { ...limits, globalConcurrency: 1 } },
        });
        assert.equal(
          (await internal(i3, 'claim', binding(i3))).value.error.code,
          'AI_CAPACITY_EXHAUSTED'
        );
        await internal(i2, 'receipt', receiptFor(i2));
        await results.finalize(two.id);
        assert.equal((await internal(i3, 'claim', binding(i3))).status, 200);
        await internal(i3, 'receipt', receiptFor(i3));
        await results.finalize(three.id);
      }
    );

    await t.test(
      'invalid output still costs money; incomplete usage remains reserved without fabricated zeroes',
      async () => {
        const j = await fresh();
        const input = await plan(j);
        await internal(input, 'claim', binding(input));
        const invalid = receiptFor(input);
        invalid.output.evidenceIds = ['fabricated_evidence'];
        await internal(input, 'receipt', invalid);
        await results.finalize(j.id);
        assert.equal((await db.aiRequest.findUnique({ where: { id: j.id } })).status, 'FAILED');
        await assertAccounting(j.id, 5n, 0);
        const unknown = await fresh();
        const x = await plan(unknown);
        await internal(x, 'claim', binding(x));
        await internal(
          x,
          'receipt',
          receiptFor(x, {
            outcome: 'KNOWN_FAILURE',
            output: null,
            usage: {
              status: 'UNRESOLVED',
              inputTokens: null,
              outputTokens: null,
              reasoningTokens: null,
            },
          })
        );
        await results.finalize(unknown.id);
        const call = await db.aiProviderCall.findUnique({ where: { id: x.callId } });
        assert.equal(call.costMicros, null);
        assert.equal(call.inputTokens, null);
        await assertAccounting(unknown.id, 0n, 0, 20n);
        await results.reconcile(unknown.id, 'known_usage', {
          status: 'FINAL',
          inputTokens: 2,
          outputTokens: 3,
          reasoningTokens: 0,
        });
        await assertAccounting(unknown.id, 5n, 0);
      }
    );

    await t.test(
      'late usage receipt works after request identity and content have been purged',
      async () => {
        const j = await fresh();
        const input = await plan(j);
        await internal(input, 'claim', binding(input));
        await results.cancel(j.id, j.principal, j.attemptId);
        const row = await db.aiRequest.findUnique({ where: { id: j.id } });
        await db.aiMessage.deleteMany({ where: { requestId: j.id } });
        await db.$executeRaw`UPDATE ai_provider_calls SET analyze_input = NULL WHERE id = ${input.callId}::uuid`;
        await db.$executeRaw`UPDATE ai_requests SET user_id=NULL, attempt_id=NULL, conversation_id=NULL, snapshot=NULL, purged_at=clock_timestamp() WHERE id=${j.id}::uuid`;
        await db.aiConversation.update({
          where: { id: row.conversationId },
          data: { deletedAt: new Date(), userId: null, attemptId: null },
        });
        assert.equal((await internal(input, 'receipt', receiptFor(input))).status, 200);
        await assertAccounting(j.id, 5n, 0);
        assert.equal(
          (await db.aiProviderCall.findUnique({ where: { id: input.callId } })).receiptPayload,
          null
        );
        assert.equal(await db.aiMessage.count({ where: { requestId: j.id } }), 0);
      }
    );

    await t.test(
      'finalization DB failure rolls message, quota, request and outbox back together',
      async () => {
        const j = await fresh();
        const input = await plan(j);
        await internal(input, 'claim', binding(input));
        await internal(input, 'receipt', receiptFor(input));
        await db.$executeRawUnsafe(
          "CREATE FUNCTION be04_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type='AI_REQUEST_COMPLETED' THEN RAISE EXCEPTION 'synthetic fault'; END IF; RETURN NEW; END $$"
        );
        await db.$executeRawUnsafe(
          'CREATE TRIGGER be04_fault BEFORE INSERT ON ai_event_outbox FOR EACH ROW EXECUTE FUNCTION be04_fault()'
        );
        try {
          await assert.rejects(results.finalize(j.id));
          assert.equal((await db.aiRequest.findUnique({ where: { id: j.id } })).status, 'RUNNING');
          assert.equal(
            await db.aiMessage.count({ where: { requestId: j.id, role: 'ASSISTANT' } }),
            0
          );
          const r = await db.aiReservation.findFirst({ where: { requestId: j.id } });
          assert.equal(r.status, 'RESERVED');
          assert.equal(r.unitUsed, null);
        } finally {
          await db.$executeRawUnsafe('DROP TRIGGER be04_fault ON ai_event_outbox');
          await db.$executeRawUnsafe('DROP FUNCTION be04_fault()');
        }
        await results.finalize(j.id);
        await assertAccounting(j.id, 5n, 1);
      }
    );

    await t.test(
      'slow fake generation holds no attempt lock; real CLI runs before generation finishes',
      async () => {
        const j = await fresh();
        let done = false;
        const tick = a.rpc('tick', 6000).then(() => {
          done = true;
        });
        for (let i = 0; i < 200; i++) {
          const call = await db.aiProviderCall.findFirst({
            where: { requestId: j.id, state: 'DISPATCHED' },
          });
          if (call) break;
          if (i === 199 || done)
            assert.fail(
              `Worker did not dispatch: ${JSON.stringify(await db.aiRequest.findUnique({ where: { id: j.id }, select: { status: true, errorCode: true } }))}`
            );
          await delay(20);
        }
        const command = await fetch(`${b.base}/api/lab-attempts/${j.attemptId}/commands`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${createAccessToken(j.user)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ command: 'enable', deviceId: 'R1', expectedRevision: 0 }),
        });
        assert.equal(command.status, 200, JSON.stringify(await command.json()));
        assert.equal(done, false, 'CLI was blocked until model completion');
        await tick;
        const finished = await db.aiRequest.findUnique({ where: { id: j.id } });
        assert.ok(
          +finished.heartbeatAt - +finished.startedAt >= 4500,
          'Worker heartbeats during generation'
        );
        const response = await api.read(j.principal, j.attemptId, 'id', j.id);
        parseRequestResource(response.data);
        assert.equal(response.data.status, 'COMPLETED');
        assert.equal(response.data.stale, true);
        assert.equal(response.data.sourceRevision, 0);
        assert.equal(response.data.currentRevision, 1);
      }
    );

    await t.test(
      'unknown usage refunds unit, books original reservation after 24h, and adjusts final cost once',
      async () => {
        const j = await fresh();
        const input = await plan(j);
        await internal(input, 'claim', binding(input));
        await results.cancel(j.id, j.principal, j.attemptId);
        await db.aiProviderCall.update({
          where: { id: input.callId },
          data: { dispatchedAt: new Date(Date.now() - 25 * 3600000) },
        });
        await results.estimate(j.id);
        await results.estimate(j.id);
        await assertAccounting(j.id, 20n, 0);
        const usage = { status: 'FINAL', inputTokens: 2, outputTokens: 3, reasoningTokens: 0 };
        await Promise.all([
          results.reconcile(j.id, 'invoice_1', usage),
          results.reconcile(j.id, 'invoice_1', usage),
        ]);
        await assertAccounting(j.id, 5n, 0);
        assert.equal(
          await db.aiUsageAdjustment.count({
            where: { providerCallId: input.callId, reason: { startsWith: 'FINAL:' } },
          }),
          1
        );
        const reservation = await db.aiReservation.findFirst({ where: { requestId: j.id } });
        assert.equal(reservation.settledCostMicros, 20n);
        assert.equal((await db.aiRequest.findUnique({ where: { id: j.id } })).status, 'CANCELLED');
      }
    );
  } finally {
    await Promise.all(peers.map(stop));
    await disconnectDatabase();
  }
});
