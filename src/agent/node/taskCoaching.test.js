const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('@ccna/shared/simulation/networkEngine');
const lab = require('@ccna/shared/labs/eigrp01');
const { taskFocusFor } = require('./taskCoaching');
const { captureSnapshot } = require('./snapshot');
const { projectContext } = require('./context');
const { evidenceFor } = require('./evidence');
const { verifyOutput } = require('./outputVerifier');
const { examples } = require('../contracts/ai-lab/v1/fixtures/build-cases.cjs');

const attempt = () => ({
  id: 'attempt-test',
  lab,
  definition: lab,
  deviceState: engine.initial(lab.initialState),
});
const request = (level) => ({
  intent: 'NEXT_STEP',
  taskId: 'eigrp-as-r2',
  selectedDeviceId: 'R2',
  requestedHintLevel: level,
});

test('task/device binding rejects a different router; diagnosis does not inherit task focus', () => {
  assert.throws(
    () => taskFocusFor(attempt(), { ...request(1), selectedDeviceId: 'R1' }, 1),
    /AI_INVALID_REQUEST/
  );
  assert.throws(
    () => taskFocusFor(attempt(), { ...request(1), taskId: 'invented' }, 1),
    /AI_INVALID_REQUEST/
  );
  assert.equal(taskFocusFor(attempt(), { ...request(1), intent: 'DIAGNOSE' }, 1), null);
});

test('three disclosure levels use frozen checks, no solution commands at level 1 or filled parameters at level 2', () => {
  const a = attempt();
  assert.deepEqual(taskFocusFor(a, request(1), 1).commands, []);
  const syntax = taskFocusFor(a, request(2), 2).commands;
  assert.equal(syntax[0].command, 'router eigrp <AS>');
  assert.equal(syntax[0].template, true);
  const full = taskFocusFor(a, request(3), 3);
  assert.equal(full.commands[0].command, 'router eigrp 1');
  assert.equal(full.commands[0].mode, 'GLOBAL_CONFIG');
  assert.equal(full.deviceId, 'R2');
  assert.match(full.verification, /R2.*AS 1/);
  assert.doesNotMatch(full.guidance, /delay|metric/);
  const custom = structuredClone(a);
  custom.definition.gradingSpec.checks.find((c) => c.id === request(3).taskId).asNumber = 7;
  assert.equal(taskFocusFor(custom, request(3), 3).commands[0].command, 'router eigrp 7');
});

test('all EIGRP tasks expose parser-backed commands at level 3 without mutating the attempt', () => {
  const a = attempt();
  const before = structuredClone(a);
  for (const check of lab.gradingSpec.checks) {
    const focus = taskFocusFor(
      a,
      { intent: 'NEXT_STEP', taskId: check.id, selectedDeviceId: check.deviceId },
      3
    );
    assert.ok(focus.commands.length, check.id);
    for (const command of focus.commands) assert.equal(command.deviceId, check.deviceId);
  }
  assert.deepEqual(a, before);
});

test('projection carries blocked progress and focused command ceiling; verifier rejects wrong device/topic', () => {
  // Real snapshot/projection plus the shared wire fixture bindings.
  const a = attempt();
  const snapshot = captureSnapshot(a, 'NEXT_STEP');
  snapshot.request = request(1);
  snapshot.taskFocus = taskFocusFor(a, snapshot.request, 1);
  const fixture = structuredClone(examples.analyze);
  assert.ok(fixture, 'shared analyze fixture');
  const prepared = projectContext({
    snapshot,
    sourceProvenance: 'LIVE_SNAPSHOT',
    sourceRevision: snapshot.sourceRevision,
    versions: { simulatorVersion: lab.initialState.simulatorVersion },
  });
  assert.equal(prepared.context.taskFocus.deviceId, 'R2');
  assert.deepEqual(prepared.allowedCommands, []);
  assert.ok(prepared.context.progress.some((p) => p.status === 'blocked'));
  const input = {
    ...fixture,
    ...prepared,
    policy: { ...fixture.policy, effectiveHintLevel: 1 },
    versions: { ...fixture.versions, simulatorVersion: lab.initialState.simulatorVersion },
  };
  input.facts = evidenceFor(input.context, input.request);
  const receipt = {
    contractVersion: input.contractVersion,
    requestId: input.requestId,
    callId: input.callId,
    contextHash: input.contextHash,
    leaseVersion: input.leaseVersion,
    versions: input.versions,
    outcome: 'RECEIVED',
    providerRequestId: null,
    finishReason: 'test',
    usage: { status: 'FINAL', inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
    output: {
      summary: 'Bắt đầu từ routing process trên R2.',
      claimType: 'INSUFFICIENT_CONTEXT',
      evidenceIds: [],
      nextSteps: [{ text: 'Chọn đúng AS cho routing process.' }],
      verification: 'AS dùng để làm gì?',
      hintLevel: 1,
    },
  };
  assert.equal(verifyOutput(input, receipt), true);
  receipt.output.summary = 'Đọc trạng thái cổng trên R1.';
  assert.throws(() => verifyOutput(input, receipt), /AI_TASK_DEVICE_MISMATCH/);
  receipt.output.summary = 'Điều chỉnh delay và metric trên R2.';
  assert.throws(() => verifyOutput(input, receipt), /AI_TASK_TOPIC_MISMATCH/);
  receipt.output.summary = 'Bắt đầu từ routing process trên R2.';
  receipt.output.hintLevel = 2;
  assert.throws(() => verifyOutput(input, receipt));
});
