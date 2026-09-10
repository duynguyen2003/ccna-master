import { progressForTasks, safeTaskFromCheck, stripGradeCheck } from './labWorkspaceHelpers';
import networkEngineModule from '../../Backend/simulation/networkEngine';
import gradingEngineModule from '../../Backend/simulation/gradingEngine';

const moduleValue = (module) => module?.default || module;

/** Keep simulator loading behind an async boundary so preview setup remains
 * isolated from the server attempt lifecycle. The modules are pure and are
 * shared with the backend test suite.
 */
export const loadPreviewRuntime = async () => {
  return {
    engine: moduleValue(networkEngineModule),
    grade: moduleValue(gradingEngineModule).gradeAttempt,
  };
};

export const buildPreviewAttempt = ({ runtime, initialState = {}, gradingSpec = {}, lab = {} }) => {
  const state = runtime.engine.initial(initialState);
  const checks = Array.isArray(gradingSpec.checks) ? gradingSpec.checks : [];
  const tasks = checks.map(safeTaskFromCheck);
  let progress = progressForTasks(tasks);
  if (checks.length) {
    try {
      const initialGrade = runtime.grade(state, gradingSpec);
      progress = progressForTasks(tasks, initialGrade.checks.map(stripGradeCheck));
    } catch {
      // Keep the ungraded checklist visible while an incomplete draft is edited.
    }
  }
  return {
    id: 'preview-local',
    labId: lab.id || 'preview',
    ownerId: null,
    isOwner: false,
    members: [],
    status: 'IN_PROGRESS',
    score: null,
    feedback: null,
    progress,
    state,
    prompt: runtime.engine.prompt(state),
    commands: [],
    lab: {
      id: lab.id || 'preview',
      title: lab.title || 'Xem trước lab',
      objective: lab.objective || '',
      tasks,
    },
    preview: true,
  };
};

export const previewAction = ({ runtime, attempt, action }) => {
  const result = runtime.engine.execute(attempt.state, action);
  const sequence = attempt.commands.length + 1;
  const event = {
    sequence,
    action,
    command: action.command || `[${action.type}]`,
    output: result.output || '',
    isError: Boolean(result.isError),
    prompt: result.prompt || attempt.prompt,
  };
  const nextState = result.state || attempt.state;
  const next = {
    ...attempt,
    state: nextState,
    prompt: result.prompt || attempt.prompt,
    commands: [...attempt.commands, event],
  };
  if (!result.isError && !result.help) {
    next.state = { ...nextState, revision: attempt.state.revision + 1 };
  }
  return { attempt: next, result, event };
};

export const gradePreview = ({ runtime, attempt, gradingSpec }) => {
  const result = runtime.grade(attempt.state, gradingSpec || {});
  const tasks = attempt.lab.tasks || [];
  const safeChecks = result.checks.map(stripGradeCheck);
  return {
    ...attempt,
    score: result.score,
    feedback: {
      score: result.score,
      passed: result.passed,
      checks: safeChecks,
    },
    progress: progressForTasks(tasks, safeChecks),
  };
};
