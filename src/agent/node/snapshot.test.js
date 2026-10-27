const { test } = require('node:test');
const assert = require('node:assert/strict');
const { captureSnapshot } = require('./snapshot');
const fixture = () => ({
  id: 'synthetic',
  lab: { title: 'Old lab', objective: 'Public' },
  definition: { gradingSpec: { checks: [] }, secret: 'PRIVATE_CANARY' },
  deviceState: {
    revision: 4,
    devices: {
      R1: {
        hostname: 'R1',
        password: 'PRIVATE_CANARY',
        defaultGateway: '10.0.0.1',
        interfaces: { e0: { ipAddress: '10.0.0.2', password: 'PRIVATE_CANARY' } },
      },
    },
    links: [],
  },
  feedback: { checks: [{ id: 'a', passed: false, message: 'Public', expected: 'PRIVATE_CANARY' }] },
});
test('legacy metadata is explicit; snapshot strips hidden fields and detaches nested state', () => {
  const a = fixture();
  const s = captureSnapshot(a);
  assert.equal(s.publicMetadataProvenance, 'CAPTURED_AT_AI_REQUEST');
  assert.doesNotMatch(JSON.stringify(s), /PRIVATE_CANARY/);
  a.deviceState.devices.R1.interfaces.e0.ipAddress = '10.0.0.9';
  a.lab.title = 'Changed';
  assert.equal(s.state.devices.R1.interfaces.e0.ipAddress, '10.0.0.2');
  assert.equal(s.publicMetadata.title, 'Old lab');
});
test('legacy feedback never borrows live revision or missing provenance', () => {
  const a = fixture();
  a.feedbackRevision = 3;
  a.feedbackRecordedAt = new Date();
  a.safeFeedbackSnapshot = a.feedback;
  const legacy = captureSnapshot(a, 'LAB_REVIEW');
  assert.equal(legacy.sourceRevision, null);
  assert.equal(legacy.sourceProvenance, 'LEGACY_FEEDBACK');
  assert.doesNotMatch(JSON.stringify(legacy), /PRIVATE_CANARY/);
  a.feedbackProvenance = 'FEEDBACK_SNAPSHOT';
  assert.equal(captureSnapshot(a, 'LAB_REVIEW').sourceRevision, 3);
});
test('live snapshot rejects absent frozen definition rather than grading against changed lab', () => {
  const a = fixture();
  delete a.definition;
  assert.throws(() => captureSnapshot(a), { status: 403 });
});

test('snapshot records only diagnostic support, not omitted advanced settings', () => {
  const a = fixture();
  a.deviceState.devices.R1.deviceType = 'ROUTER';
  a.deviceState.devices.R1.acls = { PRIVATE_ACL_CANARY: [{ text: 'PRIVATE_RULE_CANARY' }] };
  const captured = captureSnapshot(a);
  assert.equal(captured.diagnosticSupport.supported, false);
  assert.match(captured.diagnosticSupport.version, /^sim01-/);
  assert.doesNotMatch(JSON.stringify(captured), /PRIVATE_ACL_CANARY|PRIVATE_RULE_CANARY/);
});
