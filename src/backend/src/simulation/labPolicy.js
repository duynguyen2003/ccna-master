const engine = require('@ccna/shared/simulation/networkEngine');
const { actionSchema } = require('@ccna/shared/cliLabSchema');
const clone = (v) => JSON.parse(JSON.stringify(v));
const MAX_ACTIONS = 500;
function captureDefinition(lab, env = process.env) {
  const definition = clone({
    initialState: lab.initialState,
    gradingSpec: lab.gradingSpec,
    simulatorVersion: lab.simulatorVersion || '1.0.0',
    schemaVersion: lab.schemaVersion || 1,
    labVersion: lab.labVersion || 1,
    labKey: lab.labKey || null,
    title: lab.title,
    objective: lab.objective || '',
    steps: lab.steps || [],
    guideContent: lab.guideContent || '',
    guideFormat: lab.guideFormat || 'html',
  });
  if (
    lab.schemaVersion >= 2 &&
    (definition.gradingSpec.masteryScore !== undefined ||
      definition.gradingSpec.checks.some((c) =>
        ['eigrp_passive_observed', 'eigrp_metric_exercise'].includes(c.type)
      ))
  ) {
    const observations = env.LAB_LEARNING_OBSERVATIONS_ENABLED === '1';
    const mastery = observations && env.LAB_MASTERY_ENABLED === '1';
    definition.features = { observations, mastery };
    if (!observations)
      definition.gradingSpec.checks = definition.gradingSpec.checks.filter(
        (c) => !['eigrp_passive_observed', 'eigrp_metric_exercise'].includes(c.type)
      );
    if (!mastery) {
      delete definition.gradingSpec.masteryScore;
      definition.gradingSpec.passingScore = 100;
    }
  }
  return definition;
}
const canPractice = (attempt) =>
  attempt.status === 'IN_PROGRESS' ||
  (attempt.definition?.features?.mastery === true &&
    ['PASSED', 'MASTERED'].includes(attempt.status));
function replayAttempt(definition, records, version = definition.simulatorVersion) {
  if (records.length > MAX_ACTIONS) throw new Error('Replay exceeds action limit');
  let state = engine.initial(definition.initialState, version || '2.1.0');
  records.forEach((record, index) => {
    if (record.sequence !== index + 1) throw new Error('Incomplete attempt journal');
    const { actorId, ...raw } = record.action || { type: 'command', command: record.command };
    const action = actionSchema.parse(raw);
    const result = engine.execute(state, action);
    state = result.state;
    state.revision = record.sequence;
  });
  return state;
}
function resultUpdate(attempt, grade, now = new Date()) {
  if (!attempt.definition?.features?.mastery)
    return {
      status: grade.passed ? 'PASSED' : 'IN_PROGRESS',
      score: grade.score,
      submittedAt: grade.passed ? now : null,
    };
  const attained = ['PASSED', 'MASTERED'].includes(attempt.status) || grade.passed;
  const mastered = attempt.status === 'MASTERED' || grade.mastered;
  return {
    status: mastered ? 'MASTERED' : attained ? 'PASSED' : 'IN_PROGRESS',
    bestScore: Math.max(attempt.bestScore ?? attempt.score ?? 0, grade.score),
    score: Math.max(attempt.bestScore ?? attempt.score ?? 0, grade.score),
    firstPassedAt: attempt.firstPassedAt || (attained ? now : null),
    masteredAt: attempt.masteredAt || (mastered ? now : null),
    submittedAt: attempt.submittedAt || (attained ? now : null),
  };
}
module.exports = { MAX_ACTIONS, captureDefinition, canPractice, replayAttempt, resultUpdate };
