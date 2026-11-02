import { normalizeProgress, progressForTasks, nextTaskForDevice } from './labWorkspaceHelpers';

const tasks = [
  { id: 'ping', title: 'Ping qua EIGRP', deviceId: 'R1' },
  { id: 'route', title: 'Học route EIGRP', deviceId: 'R2' },
];
const checks = [
  { id: 'ping', status: 'blocked', passed: false, blockedBy: ['route'] },
  { id: 'route', passed: false },
];

test('server feedback and local preview retain blocked dependencies and choose the root task', () => {
  const progress = normalizeProgress({ lab: { tasks }, feedback: { checks } });
  expect(progress.nextTaskId).toBe('route');
  expect(progress.checks[0]).toEqual(checks[0]);
  expect(nextTaskForDevice(tasks, progress, 'R1').id).toBe('route');
  const preview = progressForTasks(tasks, checks);
  expect(preview.nextTaskId).toBe('route');
  expect(preview.checks[0]).toEqual(checks[0]);
});
