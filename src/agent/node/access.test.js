const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { readPrincipal, withAiAccess } = require('./access');
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
