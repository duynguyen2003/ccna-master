const test = require('node:test');
const assert = require('node:assert/strict');
const { buildLabProgress, buildLabTasks } = require('./labProgress');
const { createInitialState, executeCommand } = require('./deviceState');
const networkEngine = require('./networkEngine');

test('progress is authoritative, ordered and free of expected/actual values', () => {
  let state = createInitialState({ interfaces: ['GigabitEthernet0/0'] });
  state = executeCommand(executeCommand(state, 'enable').state, 'conf t').state;
  state = executeCommand(state, 'hostname R1').state;
  const gradingSpec = {
    checks: [
      { id: 'host', type: 'hostname_equals', expected: 'R1', points: 60, hint: 'Set hostname' },
      { id: 'up', type: 'interface_enabled', interface: 'GigabitEthernet0/0', points: 40 },
    ],
  };
  const before = JSON.stringify(state);
  const progress = buildLabProgress(state, gradingSpec);
  assert.deepEqual(progress, {
    completed: 1,
    total: 2,
    checks: [
      { id: 'host', status: 'completed', passed: true },
      { id: 'up', status: 'in_progress', passed: false },
    ],
    nextTaskId: 'up',
  });
  assert.equal(JSON.stringify(state), before);
  assert.equal(JSON.stringify(progress).includes('expected'), false);
  assert.equal(JSON.stringify(progress).includes('actual'), false);
  assert.deepEqual(buildLabTasks(gradingSpec), [
    {
      id: 'host',
      title: 'host',
      points: 60,
      hint: 'Set hostname',
      deviceId: null,
      type: 'hostname_equals',
      interface: null,
    },
    {
      id: 'up',
      title: 'up',
      points: 40,
      hint: null,
      deviceId: null,
      type: 'interface_enabled',
      interface: 'GigabitEthernet0/0',
    },
  ]);
});

test('reachability progress grades a clone and does not mutate packet state', () => {
  const definition = {
    devices: [
      {
        id: 'R1',
        deviceType: 'ROUTER',
        interfaces: [
          {
            name: 'GigabitEthernet0/0',
            ipAddress: '10.0.0.1',
            subnetMask: '255.255.255.0',
            shutdown: false,
          },
        ],
      },
      {
        id: 'R2',
        deviceType: 'ROUTER',
        interfaces: [
          {
            name: 'GigabitEthernet0/0',
            ipAddress: '10.0.0.2',
            subnetMask: '255.255.255.0',
            shutdown: false,
          },
        ],
      },
    ],
    links: [
      {
        id: 'L1',
        a: { deviceId: 'R1', interface: 'GigabitEthernet0/0' },
        b: { deviceId: 'R2', interface: 'GigabitEthernet0/0' },
        enabled: true,
      },
    ],
  };
  const state = networkEngine.initial(definition);
  const before = JSON.stringify(state);
  const progress = buildLabProgress(state, {
    checks: [
      { id: 'reach', type: 'reachable', deviceId: 'R1', destination: '10.0.0.2', points: 100 },
    ],
  });
  assert.equal(progress.total, 1);
  assert.equal(progress.checks[0].id, 'reach');
  assert.equal(JSON.stringify(state), before);
});
