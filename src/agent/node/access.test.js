const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { readPrincipal, withAiAccess } = require('./access');
const { canRetain, eligible } = require('./lifecycle');
const { mayTestLockedLab } = require('./eligibility');
const id = '00000000-0000-4000-8000-000000000001';
const secret = 'synthetic-test-only';
const token = jwt.sign({ id: 1, sessionVersion: 2 }, secret);
test('AI authentication accepts only a single Bearer credential and verifies its signature', () => {
  assert.deepEqual(readPrincipal(`Bearer ${token}`, secret), { id: 1, sessionVersion: 2 });
  for (const header of [undefined, '', token, `Bearer ${token} extra`])
    assert.throws(() => readPrincipal(header, secret), { status: 401 });
  assert.throws(() => readPrincipal(`Bearer ${token}`, 'wrong'), { status: 401 });
});
function fixture() {
  const attempt = { id, userId: 1, members: [2], labId: 4, lab: { status: 'PUBLISHED' } };
  const user = { id: 1, isActive: true, sessionVersion: 2 };
  const policy = { admissionEnabled: true, eligibilityRules: { userIds: [1, 2], labIds: [4] } };
  const tx = {
    $queryRaw: async () => [],
    labAttempt: { findUnique: async () => attempt },
    user: { findUnique: async () => user },
    aiRuntimePolicy: { findUnique: async () => policy },
    aiConversation: { findFirst: async () => null },
  };
  return {
    attempt,
    user,
    policy,
    tx,
    db: { user: tx.user, $transaction: async (fn) => fn(tx) },
    scope: { principal: { id: 1, sessionVersion: 2 }, attemptId: id, environment: 'test' },
  };
}
test('current membership, account and session are checked before the callback', async () => {
  const f = fixture();
  let calls = 0;
  const run = () => withAiAccess(f.db, f.scope, async () => ++calls);
  assert.equal(await run(), 1);
  f.user.isActive = false;
  await assert.rejects(run(), { status: 401 });
  f.user.isActive = true;
  f.user.sessionVersion = 3;
  await assert.rejects(run(), { status: 401 });
  f.user.sessionVersion = 2;
  f.attempt.userId = 9;
  await assert.rejects(run(), { status: 404 });
  assert.equal(calls, 1);
});
test('missing cohort and someone else’s conversation fail closed', async () => {
  const f = fixture();
  f.policy.eligibilityRules = {};
  await assert.rejects(
    withAiAccess(f.db, f.scope, async () => {}),
    { status: 403 }
  );
  f.scope.conversationId = id;
  await assert.rejects(
    withAiAccess(f.db, f.scope, async () => {}),
    { status: 404 }
  );
});

test('admin opt-in uses DB role and still enforces account, membership and kill switch', async () => {
  const f = fixture();
  f.policy.eligibilityRules = { adminAccess: true, userIds: [], labIds: [] };
  // A signed role claim is insufficient: it must be the current database role.
  f.scope.principal = readPrincipal(
    `Bearer ${jwt.sign({ id: 1, sessionVersion: 2, role: 'ADMIN' }, secret)}`,
    secret
  );
  const run = () => withAiAccess(f.db, f.scope, async (_, c) => c.user.role);
  f.user.role = 'STUDENT';
  await assert.rejects(run(), { status: 403 });
  f.user.role = 'ADMIN';
  assert.equal(await run(), 'ADMIN');
  f.policy.eligibilityRules.adminAccess = false;
  await assert.rejects(run(), { status: 403 });
  f.policy.eligibilityRules.adminAccess = true;
  f.policy.admissionEnabled = false;
  await assert.rejects(run(), { status: 403 });
  f.policy.admissionEnabled = true;
  f.user.isActive = false;
  await assert.rejects(run(), { status: 401 });
  f.user.isActive = true;
  f.scope.conversationId = id;
  await assert.rejects(run(), { status: 404 });
  delete f.scope.conversationId;
  f.attempt.userId = 9;
  await assert.rejects(run(), { status: 404 });
});

test('admin role and cohort are rechecked before worker retains or delivers a result', () => {
  const f = fixture();
  f.user.role = 'ADMIN';
  f.policy.eligibilityRules = { adminAccess: true, userIds: [], labIds: [] };
  const c = {
    ...f,
    row: { userId: 1, attemptId: id, conversationEpoch: 0, sessionVersionAtAdmission: 2 },
    conversation: { userId: 1, attemptId: id, epoch: 0 },
  };
  assert.equal(eligible(c), true);
  f.user.role = 'STUDENT';
  assert.equal(canRetain(c), false);
  assert.equal(eligible(c), false);
  // Existing student cohorts continue to work independently of admin opt-in.
  f.policy.eligibilityRules = { userIds: [1], labIds: [4] };
  assert.equal(eligible(c), true);
  f.policy.admissionEnabled = false;
  assert.equal(eligible(c), false);
  f.user.sessionVersion++;
  assert.equal(canRetain(c), false);
});

test('locked lab test exception is opt-in, dev only, active DB admin only', async () => {
  const f = fixture();
  const env = { AI_ENVIRONMENT: 'admin-test' };
  f.user.role = 'ADMIN';
  f.policy.eligibilityRules = { adminAccess: true };
  assert.equal(await mayTestLockedLab(f.tx, 1, env), true);
  assert.equal(await mayTestLockedLab(f.tx, 1, { ...env, NODE_ENV: 'production' }), false);
  assert.equal(await mayTestLockedLab(f.tx, 1, { AI_ENVIRONMENT: 'local' }), false);
  f.user.role = 'STUDENT';
  assert.equal(await mayTestLockedLab(f.tx, 1, env), false);
  f.user.role = 'ADMIN';
  f.user.isActive = false;
  assert.equal(await mayTestLockedLab(f.tx, 1, env), false);
  f.user.isActive = true;
  f.policy.admissionEnabled = false;
  assert.equal(await mayTestLockedLab(f.tx, 1, env), false);
});
