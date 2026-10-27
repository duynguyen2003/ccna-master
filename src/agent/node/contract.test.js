const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const {
  schemas,
  VERSION,
  createSchemaDocuments,
  RequestTransitions,
  ProviderTransitions,
  ErrorStatuses,
  canTransitionRequest,
  canonicalAdmissionPayload,
  assertBindings,
  parseAnalyzeInput,
  parseRequestResource,
} = require('@ccna/shared/aiLabContract');
const root = path.resolve(__dirname, '../contracts/ai-lab/v1');
const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/cases.json'), 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));
const example = (id) => fixtures.schemaCases.find((entry) => entry.id === id).value;
for (const entry of fixtures.schemaCases) {
  test(`contract schema ${entry.id}: ${entry.valid ? 'accept' : 'reject'}`, () => {
    const before = clone(entry.value);
    assert.equal(schemas[entry.schema].safeParse(entry.value).success, entry.valid);
    assert.deepEqual(entry.value, before, 'Validation must not modify caller data');
  });
}
for (const entry of fixtures.bindingCases) {
  test(`contract binding rejects ${entry.id}`, () => {
    assert.throws(() => assertBindings(entry.input, entry.receipt));
  });
}
test('generated JSON Schema, state machine, error map and fixtures stay synchronized', () => {
  const index = JSON.parse(fs.readFileSync(path.join(root, 'schema-index.json'), 'utf8'));
  assert.equal(index.contractVersion, VERSION);
  assert.deepEqual(Object.keys(index.schemas).sort(), Object.keys(schemas).sort());
  for (const [name, document] of Object.entries(createSchemaDocuments()))
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(root, index.schemas[name]), 'utf8')),
      document
    );
  const state = JSON.parse(fs.readFileSync(path.join(root, 'state-machine.json'), 'utf8'));
  assert.deepEqual(state.request, RequestTransitions);
  assert.deepEqual(state.providerCall, ProviderTransitions);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(root, 'error-statuses.json'), 'utf8')),
    ErrorStatuses
  );
  const builder = require('../contracts/ai-lab/v1/fixtures/build-cases.cjs');
  assert.deepEqual(fixtures, builder.buildCases());
});
test('admission fingerprints preserve identity across retries and normalize only the defined text/null fields', () => {
  const attemptId = '11111111-1111-4111-8111-111111111111';
  const original = {
    ...clone(example('create-diagnose')),
    message: 'Tại sao?\r\nKiểm tra.',
    taskId: null,
  };
  const retry = { ...original, message: original.message.normalize('NFD').replace(/\r\n/g, '\n') };
  delete retry.taskId;
  const hash = (body) =>
    createHash('sha256').update(canonicalAdmissionPayload(attemptId, body)).digest('hex');
  assert.equal(hash(original), hash(retry));
  assert.equal(hash(original), hash(Object.fromEntries(Object.entries(original).reverse())));
  assert.notEqual(hash(original), hash({ ...original, message: `${original.message} ` }));
  assert.notEqual(hash(original), hash({ ...original, expectedRevision: 13 }));
  assert.notEqual(
    canonicalAdmissionPayload(attemptId, original),
    canonicalAdmissionPayload('22222222-2222-4222-8222-222222222222', original)
  );
  assert.throws(() => hash({ ...original, userId: 5 }));
  // A live revision changing is outside this fingerprint. Admission looks up the existing ID before stale checks.
});
test('request terminal states cannot be reopened; late receipts can reconcile only the call state', () => {
  for (const state of [
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'EXPIRED',
    'REVOKED',
    'OUTCOME_UNKNOWN',
    'DELETED',
  ]) {
    for (const destination of Object.keys(RequestTransitions))
      assert.equal(canTransitionRequest(state, destination), false);
  }
  assert.ok(ProviderTransitions.OUTCOME_UNKNOWN.includes('RECEIVED'));
  assert.ok(!ProviderTransitions.OUTCOME_UNKNOWN.includes('DISPATCHED'));
  assert.ok(Object.isFrozen(RequestTransitions.DELETED));
});
test('requeue requires an expired fence, remaining deadline and proof of no dispatch', () => {
  for (const callState of [null, 'PLANNED'])
    assert.equal(
      canTransitionRequest('RUNNING', 'QUEUED', {
        leaseExpired: true,
        deadlineRemaining: true,
        callState,
      }),
      true
    );
  for (const callState of ['DISPATCHED', 'RECEIVED', 'OUTCOME_UNKNOWN', 'KNOWN_FAILURE', undefined])
    assert.equal(
      canTransitionRequest('RUNNING', 'QUEUED', {
        leaseExpired: true,
        deadlineRemaining: true,
        callState,
      }),
      false
    );
  assert.equal(
    canTransitionRequest('RUNNING', 'QUEUED', {
      leaseExpired: false,
      deadlineRemaining: true,
      callState: null,
    }),
    false
  );
  assert.equal(
    canTransitionRequest('RUNNING', 'QUEUED', {
      leaseExpired: true,
      deadlineRemaining: false,
      callState: null,
    }),
    false
  );
});
test('source revision stays fixed and stale is derived from current revision; legacy provenance stays explicit', () => {
  const resource = clone(example('request-resource'));
  assert.equal(parseRequestResource(resource).stale, true);
  assert.throws(() => parseRequestResource({ ...resource, stale: false }));
  assert.throws(() => parseRequestResource({ ...resource, sourceProvenance: 'LEGACY_FEEDBACK' }));
  const legacy = {
    ...resource,
    sourceRevision: null,
    stale: null,
    sourceProvenance: 'LEGACY_FEEDBACK',
    responseMode: 'DETERMINISTIC',
    result: {
      ...resource.result,
      evidence: [],
      commands: [],
      answer: {
        ...resource.result.answer,
        claimType: 'INSUFFICIENT_CONTEXT',
        evidenceIds: [],
        nextSteps: [],
      },
    },
  };
  assert.equal(parseRequestResource(legacy).sourceRevision, null);
  assert.throws(() => parseRequestResource({ ...legacy, responseMode: 'LLM' }));
});
test('known output with missing usage keeps UNRESOLVED counts and an unknown call cannot carry LLM output', () => {
  const receipt = clone(example('provider-receipt'));
  receipt.usage = {
    status: 'UNRESOLVED',
    inputTokens: null,
    outputTokens: null,
    reasoningTokens: null,
  };
  assert.equal(assertBindings(example('internal-analyze'), receipt).usage.inputTokens, null);
  assert.throws(() => schemas.ProviderReceipt.parse({ ...receipt, outcome: 'OUTCOME_UNKNOWN' }));
});
test('64 KiB byte cap is independent of per-field and character limits', () => {
  const input = clone(example('internal-analyze'));
  input.history = Array(6).fill({ role: 'USER', text: '🙂'.repeat(6000), sourceRevision: 1 });
  assert.equal(schemas.InternalAnalyzeRequest.safeParse(input).success, true);
  assert.throws(() => parseAnalyzeInput(input), /context bytes/);
});
test('public and internal errors use one HTTP status map without exposing budget totals', () => {
  assert.equal(ErrorStatuses.AI_IDEMPOTENCY_CONFLICT, 409);
  assert.equal(ErrorStatuses.AI_QUOTA_EXHAUSTED, 429);
  assert.equal(ErrorStatuses.AI_RESOURCE_NOT_FOUND, 404);
  assert.equal(ErrorStatuses.AI_BUDGET_PAUSED, 503);
  const quota = clone(example('quota'));
  quota.data.globalBudgetMicros = 1000000;
  assert.equal(schemas.QuotaResponse.safeParse(quota).success, false);
});
