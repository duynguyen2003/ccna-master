const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCommand } = require('./cliParser');
const {
  MODES,
  createInitialState,
  executeCommand,
  getCompletionResult,
  getPrompt,
} = require('./deviceState');
const { gradeAttempt } = require('./gradingEngine');
const { parseCliLabConfig } = require('../validation/cliLabSchema');

const run = (initialState, ...commands) =>
  commands.reduce((state, command) => executeCommand(state, command).state, initialState);

test('prefix matching moves through modes and updates hostname', () => {
  const state = run(createInitialState(), 'en', 'conf t', 'host R1');
  assert.equal(state.mode, MODES.GLOBAL);
  assert.equal(state.hostname, 'R1');
  assert.equal(getPrompt(state), 'R1(config)#');
});

test('parser detects incomplete and ambiguous commands', () => {
  const privileged = run(createInitialState(), 'enable');
  const incomplete = parseCommand('ccna-basic-v1', privileged, 'configure');
  const ambiguous = parseCommand('ccna-basic-v1', privileged, 'show i');
  assert.equal(incomplete.code, 'INCOMPLETE_COMMAND');
  assert.equal(ambiguous.code, 'AMBIGUOUS_COMMAND');
});

test('invalid parameter includes the offending token position', () => {
  const interfaceState = run(
    createInitialState(),
    'enable',
    'configure terminal',
    'interface g0/0'
  );
  const result = executeCommand(interfaceState, 'ip address 999.1.1.1 255.255.255.0');
  assert.equal(result.isError, true);
  assert.equal(result.errorCode, 'INVALID_PARAMETER');
  assert.equal(result.errorPosition, 11);
});

test('interface commands mutate state and no form reverses configuration', () => {
  const configured = run(
    createInitialState(),
    'enable',
    'configure terminal',
    'interface g0/0',
    'ip address 192.168.1.1 255.255.255.0',
    'description LAN interface',
    'no shutdown'
  );
  assert.deepEqual(
    {
      ipAddress: configured.interfaces['GigabitEthernet0/0'].ipAddress,
      shutdown: configured.interfaces['GigabitEthernet0/0'].shutdown,
      description: configured.interfaces['GigabitEthernet0/0'].description,
    },
    { ipAddress: '192.168.1.1', shutdown: false, description: 'LAN interface' }
  );

  const cleared = run(configured, 'no ip address', 'no description');
  assert.equal(cleared.interfaces['GigabitEthernet0/0'].ipAddress, null);
  assert.equal(cleared.interfaces['GigabitEthernet0/0'].description, '');
});

test('switch VLAN and access port configuration appears in show output', () => {
  const state = run(
    createInitialState({ deviceType: 'SWITCH' }),
    'enable',
    'conf t',
    'vlan 10',
    'name SALES',
    'exit',
    'interface gi0/1',
    'switchport mode access',
    'switchport access vlan 10',
    'end'
  );
  const output = executeCommand(state, 'show vlan brief').output;
  assert.match(output, /10\s+SALES\s+active\s+Gi0\/1/);
});

test('completion is mode aware and provides a unique replacement', () => {
  const privileged = run(createInitialState(), 'enable');
  const completion = getCompletionResult(privileged, 'conf t');
  assert.equal(completion.completion, 'conf terminal ');
  assert.deepEqual(
    completion.candidates.map((candidate) => candidate.value),
    ['terminal']
  );
});

test('show commands reflect running state and saved startup config', () => {
  const state = run(
    createInitialState(),
    'enable',
    'conf t',
    'hostname R1',
    'interface g0/0',
    'ip address 10.0.0.1 255.255.255.0',
    'no shutdown',
    'end',
    'copy running-config startup-config'
  );
  assert.match(executeCommand(state, 'show running-config').output, /hostname R1/);
  assert.match(executeCommand(state, 'show startup-config').output, /ip address 10\.0\.0\.1/);
});

test('semantic grader awards deterministic partial and passing scores', () => {
  const state = run(createInitialState(), 'enable', 'conf t', 'hostname R1');
  const result = gradeAttempt(state, {
    passingScore: 60,
    checks: [
      { id: 'hostname', type: 'hostname_equals', expected: 'R1', points: 60 },
      { id: 'interface', type: 'interface_enabled', interface: 'GigabitEthernet0/0', points: 40 },
    ],
  });
  assert.equal(result.score, 60);
  assert.equal(result.passed, true);
  assert.equal(result.checks[1].passed, false);
});

test('CLI lab definition validation rejects incomplete grading checks', () => {
  assert.throws(
    () =>
      parseCliLabConfig({
        labType: 'CLI_SIMULATION',
        courseId: 'c1',
        initialState: { deviceType: 'ROUTER', interfaces: ['GigabitEthernet0/0'] },
        gradingSpec: {
          passingScore: 70,
          checks: [
            { id: 'ip', type: 'interface_ip_equals', interface: 'GigabitEthernet0/0', points: 100 },
          ],
        },
      }),
    /expectedIp/
  );
});

test('CLI lab definition accepts the Phase 1 declarative contract', () => {
  const config = parseCliLabConfig({
    labType: 'CLI_SIMULATION',
    courseId: 'c1',
    commandProfile: 'ccna-basic-v1',
    initialState: { deviceType: 'ROUTER', hostname: 'Router', interfaces: ['GigabitEthernet0/0'] },
    gradingSpec: {
      passingScore: 70,
      checks: [{ id: 'hostname', type: 'hostname_equals', expected: 'R1', points: 100 }],
    },
  });
  assert.equal(config.simulatorVersion, '1.0.0');
  assert.equal(config.commandProfile, 'ccna-basic-v1');
});
