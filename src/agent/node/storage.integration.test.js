// Invoked only by the isolated BE-01 runner, never by a live-provider test.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool, Client } = require('pg');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const stateMachine = require('../contracts/ai-lab/v1/state-machine.json');

const uuid = () => crypto.randomUUID();
const digest = (s) => crypto.createHash('sha256').update(s).digest('hex');
const url = new URL(process.env.AI_TEST_DATABASE_URL || 'http://invalid');
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
assert.equal(url.hostname, '127.0.0.1');
assert.match(url.pathname, /^\/ai_lab_be01_(fresh|upgrade)_[a-f0-9]+$/);
const pool = new Pool({
  connectionString: url.toString(),
  max: 6,
  connectionTimeoutMillis: 5000,
  statement_timeout: 5000,
});
const q = (name) => `"${name.replaceAll('"', '""')}"`;

async function insert(table, data, db = pool) {
  const keys = Object.keys(data);
  const { rows } = await db.query(
    `INSERT INTO ${q(table)} (${keys.map(q).join(',')})
    VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
    Object.values(data).map((value) => (Array.isArray(value) ? JSON.stringify(value) : value))
  );
  return rows[0];
}
async function rejects(operation, code) {
  await assert.rejects(operation, (e) => e.code === code);
}
async function scope() {
  const user = await insert('users', {
    email: `be01-${uuid()}@example.invalid`,
    password_hash: 'synthetic-only',
    updated_at: new Date(),
  });
  const lab = await insert('labs', {
    title: 'BE01 constraint fixture',
    lab_type: 'CLI_SIMULATION',
  });
  const attempt = await insert('lab_attempts', {
    id: uuid(),
    user_id: user.id,
    lab_id: lab.id,
    simulator_version: '1.0.0',
    device_state: { revision: 0 },
    updated_at: new Date(),
  });
  const owner = digest(String(user.id));
  const conversation = await insert('ai_conversations', {
    id: uuid(),
    user_id: user.id,
    attempt_id: attempt.id,
    owner_key: owner,
    updated_at: new Date(),
  });
  return { user, lab, attempt, conversation, owner };
}
function requestData(s, overrides = {}) {
  const status = overrides.status || 'QUEUED';
  return {
    id: uuid(),
    user_id: s.user.id,
    attempt_id: s.attempt.id,
    conversation_id: s.conversation.id,
    owner_key: s.owner,
    conversation_epoch: 0,
    recovery_epoch: 'be01-epoch',
    client_request_id: uuid(),
    payload_hash: digest('payload'),
    context_hash: digest(s.attempt.id),
    intent: 'DIAGNOSE',
    source_revision: 0,
    source_provenance: 'LIVE_SNAPSHOT',
    snapshot: { synthetic: true },
    versions: { synthetic: true },
    session_version_at_admission: 0,
    max_cost_micros: 1000n,
    deadline_at: new Date(Date.now() + 60000),
    updated_at: new Date(),
    status,
    response_mode: status === 'COMPLETED' ? 'DETERMINISTIC' : 'NONE',
    ...(status === 'QUEUED' || status === 'RUNNING' ? {} : { finished_at: new Date() }),
    ...overrides,
  };
}
const request = (s, extra) => insert('ai_requests', requestData(s, extra));
const call = (r, extra = {}) =>
  insert('ai_provider_calls', {
    id: uuid(),
    request_id: r.id,
    context_hash: r.context_hash,
    provider: 'synthetic',
    model: 'no-network',
    price_version: 'be01-v1',
    lease_version: 1,
    max_cost_micros: 1000n,
    ...extra,
  });
const bucket = (extra = {}) =>
  insert('ai_quota_buckets', {
    id: uuid(),
    scope_type: 'USER_DAY',
    scope_key: `be01:${uuid()}`,
    window_start: new Date('2026-10-22T00:00:00Z'),
    window_end: new Date('2026-10-23T00:00:00Z'),
    limit_units: 20,
    limit_micros: 10000n,
    ...extra,
  });
const message = (s, r, extra = {}) =>
  insert('ai_messages', {
    id: uuid(),
    conversation_id: s.conversation.id,
    epoch: 0,
    request_id: r.id,
    role: 'ASSISTANT',
    structured_answer: { summary: 'Synthetic answer' },
    ...extra,
  });

before(async () => {
  assert.equal(
    (await pool.query('SELECT current_database() AS db')).rows[0].db,
    url.pathname.slice(1)
  );
});
after(async () => {
  await pool.end();
});

test('all 11 AI tables exist; status enums match v1 and partial indexes are present', async () => {
  const { rows } = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'ai_%'`
  );
  assert.deepEqual(
    rows.map((r) => r.tablename).sort(),
    [
      'ai_conversations',
      'ai_requests',
      'ai_messages',
      'ai_provider_calls',
      'ai_quota_buckets',
      'ai_reservations',
      'ai_usage_adjustments',
      'ai_runtime_policies',
      'ai_execution_slots',
      'ai_feedback',
      'ai_event_outbox',
    ].sort()
  );
  for (const [name, expected] of [
    ['AiRequestStatus', Object.keys(stateMachine.request)],
    ['AiProviderCallState', Object.keys(stateMachine.providerCall)],
  ]) {
    const result = await pool.query(
      `SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid=enumtypid WHERE typname=$1`,
      [name]
    );
    assert.deepEqual(result.rows.map((r) => r.enumlabel).sort(), expected.sort());
  }
  const indices =
    await pool.query(`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public'
    AND indexname IN ('ai_requests_one_active_user','ai_event_outbox_pending_idx')`);
  assert.equal(indices.rowCount, 2);
  assert.ok(indices.rows.every((r) => /WHERE/.test(r.indexdef)));
});

test('legacy attempts retain NULL metadata and invalid provenance/revision is rejected', async () => {
  const s = await scope();
  for (const key of [
    'public_metadata',
    'public_metadata_provenance',
    'public_metadata_captured_at',
    'feedback_revision',
    'feedback_recorded_at',
    'safe_feedback_snapshot',
    'feedback_provenance',
  ])
    assert.equal(s.attempt[key], null);
  await rejects(
    pool.query('UPDATE lab_attempts SET feedback_revision=0 WHERE id=$1', [s.attempt.id]),
    '23514'
  );
  await rejects(
    pool.query("UPDATE lab_attempts SET public_metadata_provenance='LIVE_SNAPSHOT' WHERE id=$1", [
      s.attempt.id,
    ]),
    '23514'
  );
  await rejects(
    pool.query('UPDATE lab_attempts SET public_metadata=$2 WHERE id=$1', [s.attempt.id, '[]']),
    '23514'
  );
});

test('one conversation per user/attempt and request ownership scope cannot be mixed', async () => {
  const s = await scope();
  const other = await scope();
  await rejects(
    insert('ai_conversations', {
      id: uuid(),
      user_id: s.user.id,
      attempt_id: s.attempt.id,
      owner_key: s.owner,
      updated_at: new Date(),
    }),
    '23505'
  );
  await rejects(request(s, { conversation_id: other.conversation.id }), '23503');
  await rejects(request(s, { user_id: null }), '23514');
});

test('client request IDs remain idempotent after terminal identity is detached', async () => {
  const s = await scope();
  const first = await request(s, { status: 'COMPLETED' });
  await rejects(
    request(s, { status: 'COMPLETED', client_request_id: first.client_request_id }),
    '23505'
  );
  await pool.query(
    'UPDATE ai_requests SET user_id=NULL,attempt_id=NULL,conversation_id=NULL,snapshot=NULL WHERE id=$1',
    [first.id]
  );
  await rejects(
    request(s, { status: 'COMPLETED', client_request_id: first.client_request_id }),
    '23505'
  );
});

test('two PostgreSQL connections cannot admit two QUEUED/RUNNING requests for one user', async () => {
  const s = await scope();
  const a = new Client({ connectionString: url.toString(), statement_timeout: 5000 });
  const b = new Client({ connectionString: url.toString(), statement_timeout: 5000 });
  await a.connect();
  await b.connect();
  try {
    assert.notEqual(
      (await a.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
      (await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
    );
    const results = await Promise.allSettled([
      insert('ai_requests', requestData(s), a),
      insert('ai_requests', requestData(s, { status: 'RUNNING' }), b),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.find((r) => r.status === 'rejected').reason.code, '23505');
    const winner = results.find((r) => r.status === 'fulfilled').value;
    await pool.query(
      "UPDATE ai_requests SET status='OUTCOME_UNKNOWN',finished_at=now() WHERE id=$1",
      [winner.id]
    );
    assert.ok((await request(s)).id);
  } finally {
    await a.end();
    await b.end();
  }
});

test('request hint/hash/source/result checks reject structurally invalid stored requests', async () => {
  const s = await scope();
  for (const extra of [
    { effective_hint_level: 4 },
    { source_revision: -1 },
    { payload_hash: 'x'.repeat(64) },
    { versions: [] },
    { snapshot: null },
    { max_cost_micros: -1n },
    { status: 'COMPLETED', response_mode: 'NONE' },
    { source_provenance: 'LEGACY_FEEDBACK' },
  ])
    await rejects(request(s, extra), '23514');
  const legacy = await request(s, {
    status: 'COMPLETED',
    intent: 'LAB_REVIEW',
    source_provenance: 'LEGACY_FEEDBACK',
    source_revision: null,
  });
  assert.equal(legacy.source_revision, null);
  await rejects(
    request(s, {
      status: 'COMPLETED',
      intent: 'LAB_REVIEW',
      source_provenance: 'LEGACY_FEEDBACK',
      source_revision: null,
      response_mode: 'LLM',
    }),
    '23514'
  );
});

test('one message per request/role with conversation and historical epoch binding', async () => {
  const s = await scope();
  const r = await request(s);
  await message(s, r);
  await rejects(message(s, r), '23505');
  await rejects(
    message(s, r, { role: 'USER', structured_answer: null, content: 'Question', epoch: 1 }),
    '23503'
  );
  const other = await scope();
  await rejects(
    message(other, r, { role: 'USER', structured_answer: null, content: 'Question' }),
    '23503'
  );
  await message(s, r, { role: 'USER', structured_answer: null, content: 'Question' });
});

test('provider calls are unique at R1 step zero and bind to the request context hash', async () => {
  const s = await scope();
  const r = await request(s);
  await call(r);
  await rejects(call(r), '23505');
  await rejects(call(r, { step_index: 1 }), '23514');
  const other = await scope();
  const r2 = await request(other);
  await rejects(call(r2, { context_hash: digest('wrong context') }), '23503');
});

test('unknown usage stays NULL, FINAL requires all counts/cost, receipt text can be purged independently', async () => {
  const s = await scope();
  const r = await request(s);
  const c = await call(r, {
    state: 'OUTCOME_UNKNOWN',
    dispatched_at: new Date(),
    usage_status: 'UNRESOLVED',
  });
  assert.equal(c.input_tokens, null);
  assert.equal(c.cost_micros, null);
  await rejects(
    pool.query("UPDATE ai_provider_calls SET usage_status='FINAL' WHERE id=$1", [c.id]),
    '23514'
  );
  await pool.query(
    `UPDATE ai_provider_calls SET usage_status='FINAL',input_tokens=10,output_tokens=2,
    reasoning_tokens=0,cost_micros=5,state='RECEIVED',received_at=now(),receipt_hash=$2,
    receipt_payload='{"synthetic":"temporary"}',receipt_expires_at=now()+interval '1 day' WHERE id=$1`,
    [c.id, digest('receipt')]
  );
  await pool.query('UPDATE ai_provider_calls SET receipt_payload=NULL WHERE id=$1', [c.id]);
  const saved = (await pool.query('SELECT * FROM ai_provider_calls WHERE id=$1', [c.id])).rows[0];
  assert.equal(saved.cost_micros, '5');
  assert.equal(saved.receipt_payload, null);
  assert.ok(saved.receipt_hash);
});

test('quota counters cannot be negative or exceed limits; windows are ordered and scoped uniquely', async () => {
  for (const field of [
    'limit_units',
    'used_units',
    'reserved_units',
    'limit_micros',
    'spent_micros',
    'reserved_micros',
  ])
    await rejects(bucket({ [field]: -1 }), '23514');
  await rejects(bucket({ used_units: 19, reserved_units: 2 }), '23514');
  await rejects(bucket({ spent_micros: 9000n, reserved_micros: 1001n }), '23514');
  await rejects(bucket({ window_end: new Date('2026-10-21T00:00:00Z') }), '23514');
  const b = await bucket({ limit_micros: 10000000000n });
  assert.equal(b.limit_micros, '10000000000');
  await rejects(bucket({ scope_key: b.scope_key, window_start: b.window_start }), '23505');
});

test('reservation and settlement keys are unique and settled records require complete accounting', async () => {
  const s = await scope();
  const r = await request(s);
  const b = await bucket();
  const values = { request_id: r.id, bucket_id: b.id, units: 1, cost_micros: 100n };
  const reservation = await insert('ai_reservations', { id: uuid(), ...values });
  await rejects(insert('ai_reservations', { id: uuid(), ...values }), '23505');
  await rejects(
    pool.query("UPDATE ai_reservations SET status='SETTLED' WHERE id=$1", [reservation.id]),
    '23514'
  );
  await pool.query(
    `UPDATE ai_reservations SET status='SETTLED',settlement_key='be01-settlement',settled_at=now(),
    settled_units=1,settled_cost_micros=10 WHERE id=$1`,
    [reservation.id]
  );
  const b2 = await bucket();
  await rejects(
    insert('ai_reservations', {
      id: uuid(),
      ...values,
      bucket_id: b2.id,
      status: 'SETTLED',
      settlement_key: 'be01-settlement',
      settled_at: new Date(),
      settled_units: 1,
      settled_cost_micros: 10n,
    }),
    '23505'
  );
  await rejects(pool.query('DELETE FROM ai_quota_buckets WHERE id=$1', [b.id]), '23503');
});

test('usage adjustments allow signed corrections and deduplicate by idempotency key', async () => {
  const s = await scope();
  const r = await request(s);
  const c = await call(r);
  const value = {
    provider_call_id: c.id,
    idempotency_key: uuid(),
    delta_micros: -10n,
    reason: 'SYNTHETIC_CORRECTION',
  };
  assert.equal(
    (await insert('ai_usage_adjustments', { id: uuid(), ...value })).delta_micros,
    '-10'
  );
  await rejects(insert('ai_usage_adjustments', { id: uuid(), ...value }), '23505');
});

test('execution slots have consistent occupancy and bind call/request pairs', async () => {
  const s = await scope();
  const r = await request(s);
  const c = await call(r);
  const environment = `test-${uuid()}`.slice(0, 40);
  await insert('ai_runtime_policies', { environment, updated_at: new Date() });
  await rejects(
    insert('ai_execution_slots', { environment, slot_number: 0, request_id: r.id }),
    '23514'
  );
  await insert('ai_execution_slots', {
    environment,
    slot_number: 0,
    request_id: r.id,
    call_id: c.id,
    lease_version: 1,
    acquired_at: new Date(),
    expires_at: new Date(Date.now() + 30000),
  });
  await rejects(
    insert('ai_execution_slots', {
      environment,
      slot_number: 1,
      request_id: r.id,
      call_id: c.id,
      lease_version: 1,
      acquired_at: new Date(),
      expires_at: new Date(Date.now() + 30000),
    }),
    '23505'
  );
  const other = await scope();
  const r2 = await request(other);
  await rejects(
    insert('ai_execution_slots', {
      environment,
      slot_number: 2,
      request_id: r2.id,
      call_id: c.id,
      lease_version: 1,
      acquired_at: new Date(),
      expires_at: new Date(Date.now() + 30000),
    }),
    '23505'
  );
  await pool.query(
    'UPDATE ai_execution_slots SET request_id=NULL,call_id=NULL,acquired_at=NULL,expires_at=NULL WHERE environment=$1',
    [environment]
  );
  await rejects(
    insert('ai_execution_slots', {
      environment,
      slot_number: 2,
      request_id: r2.id,
      call_id: c.id,
      lease_version: 1,
      acquired_at: new Date(),
      expires_at: new Date(Date.now() + 30000),
    }),
    '23503'
  );
});

test('runtime policy starts disabled and deleting an updater preserves the policy', async () => {
  const user = await insert('users', {
    email: `${uuid()}@example.invalid`,
    password_hash: 'synthetic',
    updated_at: new Date(),
  });
  const env = uuid();
  const p = await insert('ai_runtime_policies', {
    environment: env,
    updated_by: user.id,
    updated_at: new Date(),
  });
  assert.equal(p.admission_enabled, false);
  assert.equal(p.dispatch_enabled, false);
  await rejects(
    pool.query('UPDATE ai_runtime_policies SET dispatch_enabled=true WHERE environment=$1', [env]),
    '23514'
  );
  await pool.query('DELETE FROM users WHERE id=$1', [user.id]);
  assert.equal(
    (await pool.query('SELECT updated_by FROM ai_runtime_policies WHERE environment=$1', [env]))
      .rows[0].updated_by,
    null
  );
});

test('outbox events deduplicate and reject invalid payload/counters', async () => {
  const event = { event_id: uuid(), type: 'SYNTHETIC', payload: { requestId: uuid() } };
  await insert('ai_event_outbox', event);
  await rejects(insert('ai_event_outbox', event), '23505');
  await rejects(insert('ai_event_outbox', { ...event, event_id: uuid(), payload: [] }), '23514');
  await rejects(
    insert('ai_event_outbox', { ...event, event_id: uuid(), retry_count: -1 }),
    '23514'
  );
});

test('account/attempt/lab deletes are guarded; explicit content purge keeps calls/reservations/adjustments', async () => {
  const s = await scope();
  const r = await request(s);
  const c = await call(r);
  const m = await message(s, r);
  const b = await bucket();
  const reservation = await insert('ai_reservations', {
    id: uuid(),
    request_id: r.id,
    bucket_id: b.id,
    cost_micros: 100n,
  });
  const adjustment = await insert('ai_usage_adjustments', {
    id: uuid(),
    provider_call_id: c.id,
    idempotency_key: uuid(),
    delta_micros: 5n,
    reason: 'SYNTHETIC',
  });
  const f = {
    message_id: m.id,
    user_id: s.user.id,
    helpful: true,
    optional_comment: 'Synthetic comment',
    updated_at: new Date(),
  };
  await insert('ai_feedback', { id: uuid(), ...f });
  await rejects(insert('ai_feedback', { id: uuid(), ...f }), '23505');
  for (const [table, id] of [
    ['users', s.user.id],
    ['lab_attempts', s.attempt.id],
    ['labs', s.lab.id],
  ])
    await rejects(pool.query(`DELETE FROM ${q(table)} WHERE id=$1`, [id]), '23503');
  await pool.query('UPDATE ai_conversations SET deleted_at=now(),epoch=epoch+1 WHERE id=$1', [
    s.conversation.id,
  ]);
  await pool.query(
    "UPDATE ai_requests SET status='DELETED',finished_at=now(),snapshot=NULL WHERE id=$1",
    [r.id]
  );
  await pool.query('DELETE FROM ai_messages WHERE conversation_id=$1', [s.conversation.id]);
  await pool.query(
    'UPDATE ai_requests SET user_id=NULL,attempt_id=NULL,conversation_id=NULL WHERE id=$1',
    [r.id]
  );
  await pool.query('DELETE FROM ai_conversations WHERE id=$1', [s.conversation.id]);
  await pool.query('DELETE FROM users WHERE id=$1', [s.user.id]);
  await pool.query('DELETE FROM labs WHERE id=$1', [s.lab.id]);
  assert.equal(
    (await pool.query('SELECT 1 FROM ai_feedback WHERE message_id=$1', [m.id])).rowCount,
    0
  );
  assert.equal(
    (await pool.query('SELECT 1 FROM ai_provider_calls WHERE id=$1', [c.id])).rowCount,
    1
  );
  assert.equal(
    (await pool.query('SELECT 1 FROM ai_reservations WHERE id=$1', [reservation.id])).rowCount,
    1
  );
  assert.equal(
    (await pool.query('SELECT 1 FROM ai_usage_adjustments WHERE id=$1', [adjustment.id])).rowCount,
    1
  );
  await pool.query(
    `UPDATE ai_provider_calls SET state='RECEIVED',dispatched_at=now(),received_at=now(),receipt_hash=$2,
    usage_status='FINAL',input_tokens=10,output_tokens=2,reasoning_tokens=0,cost_micros=12 WHERE id=$1`,
    [c.id, digest('late receipt')]
  );
  await rejects(pool.query('DELETE FROM ai_requests WHERE id=$1', [r.id]), '23503');
});

test('generated Prisma client reads/writes nullable metadata and 64-bit micro-USD', async () => {
  const s = await scope();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  try {
    const a = await prisma.labAttempt.findUniqueOrThrow({ where: { id: s.attempt.id } });
    assert.equal(a.feedbackRevision, null);
    await prisma.labAttempt.update({
      where: { id: a.id },
      data: {
        publicMetadata: { title: 'Synthetic' },
        publicMetadataProvenance: 'CAPTURED_AT_ATTEMPT_START',
        publicMetadataCapturedAt: new Date(),
        feedbackRevision: 0,
        feedbackRecordedAt: new Date(),
        safeFeedbackSnapshot: { checks: [] },
        feedbackProvenance: 'FEEDBACK_SNAPSHOT',
      },
    });
    const b = await prisma.aiQuotaBucket.create({
      data: {
        scopeType: 'GLOBAL_MONTH',
        scopeKey: uuid(),
        windowStart: new Date('2026-10-01T00:00:00Z'),
        windowEnd: new Date('2026-11-01T00:00:00Z'),
        limitMicros: 10000000000n,
      },
    });
    assert.equal(b.limitMicros, 10000000000n);
  } finally {
    await prisma.$disconnect();
  }
});
