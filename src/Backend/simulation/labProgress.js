const { gradeAttempt } = require('./gradingEngine');

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

/**
 * Return only the task fields that are safe to send while a learner is still
 * working. In particular, expected and actual values belong to submit
 * feedback and must never be copied into this DTO.
 */
const taskMetadata = (check) => ({
  id: check.id,
  title: check.title || check.id,
  points: check.points,
  hint: check.hint || null,
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

const buildLabTasks = (gradingSpec) =>
  (Array.isArray(gradingSpec?.checks) ? gradingSpec.checks : []).map(taskMetadata);

module.exports = {
  buildLabProgress,
  buildLabTasks,
  calculateLabProgress: buildLabProgress,
  getLabProgress: buildLabProgress,
  taskMetadata,
};
