const { gradeAttempt } = require('@ccna/shared/simulation/gradingEngine');

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

/**
 * Return only the task fields that are safe to send while a learner is still
 * working. In particular, expected and actual values belong to submit
 * feedback and must never be copied into this DTO.
 */
const taskMetadata = (check, state = {}) => ({
  id: check.id,
  title: check.title || check.id,
  points: check.points,
  hint: check.hints?.[0] || check.hint || null,
  ...(check.hints
    ? {
        hintCount: check.hints.length,
        hints: check.hints.slice(0, state.learningEvidence?.hints?.[check.id] || 0),
      }
    : {}),
  ...(check.objective ? { objective: check.objective } : {}),
  ...(check.skill ? { skill: check.skill } : {}),
  ...(check.required !== undefined ? { required: check.required } : {}),
  deviceId: check.deviceId || null,
  type: check.type,
  interface: check.interface || null,
});

/**
 * Grade a snapshot of the current state and project the result into a safe,
 * UI-oriented progress contract. The one clone is deliberate: a grader may
 * inspect packet reachability and should never age ARP/MAC/NAT state while a
 * read-only progress calculation is running.
 */
const buildLabProgress = (state, gradingSpec) => {
  const checks = Array.isArray(gradingSpec?.checks) ? gradingSpec.checks : [];
  if (!checks.length) {
    return { completed: 0, total: 0, checks: [], nextTaskId: null };
  }

  const result = gradeAttempt(cloneJson(state), gradingSpec);
  let nextTaskId = null;
  const safeChecks = result.checks.map((check) => {
    if (check.status === 'blocked') {
      return { id: check.id, status: 'blocked', passed: false, blockedBy: check.blockedBy };
    }
    const passed = check.passed === true;
    const status = passed
      ? 'completed'
      : nextTaskId === null
        ? ((nextTaskId = check.id), 'in_progress')
        : 'not_started';
    return { id: check.id, status, passed };
  });

  return {
    completed: safeChecks.reduce((count, check) => count + (check.passed ? 1 : 0), 0),
    total: safeChecks.length,
    checks: safeChecks,
    nextTaskId,
  };
};

const buildLabTasks = (gradingSpec, state) =>
  (Array.isArray(gradingSpec?.checks) ? gradingSpec.checks : []).map((check) =>
    taskMetadata(check, state)
  );

module.exports = {
  buildLabProgress,
  buildLabTasks,
  calculateLabProgress: buildLabProgress,
  getLabProgress: buildLabProgress,
  taskMetadata,
};
