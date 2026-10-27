const { buildLabTasks, buildLabProgress } = require('../../backend/src/simulation/labProgress');
const { snapshotSupport } = require('./diagnostics/capabilities');
const clone = (v) => JSON.parse(JSON.stringify(v));
const pick = (value, keys) =>
  Object.fromEntries(keys.filter((k) => value?.[k] !== undefined).map((k) => [k, value[k]]));
function publicMetadata(lab, definition) {
  return {
    title: lab.title,
    objective: lab.objective || '',
    tasks: buildLabTasks(definition?.gradingSpec),
    commandProfile: 'ccna-network-v2',
  };
}
function safeFeedback(feedback) {
  return {
    checks: (feedback?.checks || []).map((c) => pick(c, ['id', 'passed', 'message', 'hint'])),
  };
}
function stateSnapshot(state) {
  return {
    revision: state.revision,
    devices: Object.fromEntries(
      Object.entries(state.devices || {}).map(([id, d]) => [
        id,
        {
          ...pick(d, ['hostname', 'deviceType', 'defaultGateway']),
          interfaces: Object.fromEntries(
            Object.entries(d.interfaces || {}).map(([name, p]) => [
              name,
              pick(p, [
                'ipAddress',
                'subnetMask',
                'shutdown',
                'switchportMode',
                'accessVlan',
                'allowedVlans',
                'nativeVlan',
              ]),
            ])
          ),
          staticRoutes: (d.staticRoutes || []).map((r) =>
            pick(r, ['network', 'mask', 'nextHop', 'adminDistance'])
          ),
          vlans: Object.fromEntries(
            Object.entries(d.vlans || {}).map(([key, v]) => [key, pick(v, ['name'])])
          ),
        },
      ])
    ),
    links: (state.links || []).map((l) => ({
      ...pick(l, ['id', 'enabled']),
      a: pick(l.a, ['deviceId', 'interface']),
      b: pick(l.b, ['deviceId', 'interface']),
    })),
  };
}
// Internal snapshot, never an endpoint response or provider payload. BE-05 builds context.
function captureSnapshot(attempt, intent = 'DIAGNOSE') {
  const definition = attempt.definition;
  const metadata = attempt.publicMetadata || publicMetadata(attempt.lab, definition);
  if (intent === 'LAB_REVIEW') {
    const known =
      Number.isInteger(attempt.feedbackRevision) &&
      attempt.feedbackRecordedAt &&
      attempt.safeFeedbackSnapshot &&
      attempt.feedbackProvenance === 'FEEDBACK_SNAPSHOT';
    return clone({
      attemptId: attempt.id,
      sourceRevision: known ? attempt.feedbackRevision : null,
      sourceProvenance: known ? 'FEEDBACK_SNAPSHOT' : 'LEGACY_FEEDBACK',
      feedback: safeFeedback(known ? attempt.safeFeedbackSnapshot : attempt.feedback),
      recordedAt: known ? attempt.feedbackRecordedAt : null,
    });
  }
  if (!definition || !Number.isInteger(attempt.deviceState?.revision))
    throw Object.assign(new Error('AI_NOT_ELIGIBLE'), { status: 403, code: 'AI_NOT_ELIGIBLE' });
  return clone({
    attemptId: attempt.id,
    sourceRevision: attempt.deviceState.revision,
    sourceProvenance: 'LIVE_SNAPSHOT',
    publicMetadata: metadata,
    publicMetadataProvenance: attempt.publicMetadataProvenance || 'CAPTURED_AT_AI_REQUEST',
    state: stateSnapshot(attempt.deviceState),
    diagnosticSupport: snapshotSupport(attempt.deviceState),
    progress: buildLabProgress(attempt.deviceState, definition.gradingSpec),
  });
}
module.exports = { publicMetadata, safeFeedback, captureSnapshot };
