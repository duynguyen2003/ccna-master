const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('@ccna/shared/simulation/networkEngine');
const single = require('@ccna/shared/simulation/deviceState');
const { gradeAttempt, evaluateCheck } = require('@ccna/shared/simulation/gradingEngine');
const { gradingSpecSchema } = require('@ccna/shared/cliLabSchema');
const {
  configurationSnapshot,
  startupMatchesRunning,
} = require('@ccna/shared/simulation/configSnapshot');
const { transmit } = require('@ccna/shared/simulation/networkPackets');
const { buildLabProgress } = require('./labProgress');
const lab = require('@ccna/shared/labs/eigrp01');

const run = (actions, initial = engine.initial(lab.initialState)) => {
  let state = initial;
  for (const action of actions) {
    const result = engine.execute(state, action);
    assert.equal(result.isError, false, `${action.deviceId}: ${action.command}: ${result.output}`);
    state = result.state;
  }
  return state;
};
const commands = (deviceId, list) =>
  list.map((command) => ({ type: 'command', deviceId, command }));
const golden = () => run(lab.solutionActions);
const results = (state) =>
  Object.fromEntries(gradeAttempt(state, lab.gradingSpec).checks.map((c) => [c.id, c]));

test('new EIGRP policy parses, scores 100, and records its policy version', () => {
  const spec = gradingSpecSchema.parse(lab.gradingSpec);
  const grade = gradeAttempt(golden(), spec);
  assert.equal(grade.score, 100);
  assert.equal(grade.passed, true);
  assert.equal(grade.policyVersion, 3);
});

test('static-only connectivity cannot pass EIGRP routes or dependent pings', () => {
  let state = golden();
  const staticActions = Object.entries(state.devices).flatMap(([id, d]) =>
    commands(id, [
      'configure terminal',
      'no router eigrp 1',
      ...d.eigrpRoutes.map((r) => `ip route ${r.network} ${r.mask} ${r.nextHop}`),
      'end',
      'write memory',
    ])
  );
  state = run(staticActions, state);
  assert.equal(transmit(structuredClone(state), 'R1', '4.4.4.4').success, true);
  const checks = results(state);
  for (const id of ['route-r1', 'route-r4']) assert.equal(checks[id].passed, false);
  for (const id of ['ping-r1', 'ping-r4']) {
    assert.equal(checks[id].status, 'blocked');
    assert.equal(checks[id].pointsAwarded, 0);
  }
  // Legacy checks retain their original, protocol-independent meaning.
  assert.equal(
    evaluateCheck(state, { type: 'route_exists', deviceId: 'R1', destination: '4.4.4.4' }).passed,
    true
  );
});

test('a static route shadowing EIGRP preserves learned credit but blocks forwarding and ping credit', () => {
  const state = run(
    commands('R1', [
      'configure terminal',
      'ip route 4.0.0.0 255.0.0.0 192.1.12.2',
      'end',
      'write memory',
    ]),
    golden()
  );
  const checks = results(state);
  assert.equal(checks['route-r1'].passed, true);
  assert.equal(checks['forwarding-r1'].passed, false);
  assert.equal(checks['ping-r1'].status, 'blocked');
  assert.equal(transmit(structuredClone(state), 'R1', '4.4.4.4').success, true);
});

test('static route on a transit router is detected from structured packet events', () => {
  const state = run(
    commands('R2', [
      'configure terminal',
      'ip route 4.0.0.0 255.0.0.0 192.1.23.3',
      'end',
      'write memory',
    ]),
    golden()
  );
  const checks = results(state);
  assert.equal(checks['forwarding-r1'].passed, true);
  assert.equal(checks['forwarding-r4'].passed, true);
  assert.equal(checks['ping-r1'].actual.reachable, true);
  assert.equal(checks['ping-r1'].passed, false);
  assert.ok(
    checks['ping-r1'].actual.unexpectedRoutes.some((r) => r.deviceId === 'R2' && r.protocol === 'S')
  );
});

for (const variant of ['classful', 'subnet wildcard', 'host wildcard']) {
  test(variant + ' enables the same EIGRP interfaces and earns 100', () => {
    const actions = lab.solutionActions.map((action) => {
      if (!action.command.startsWith('network ')) return action;
      const [, network] = action.command.split(' ');
      if (variant === 'classful') return { ...action, command: 'network ' + network };
      if (variant === 'subnet wildcard') return action;
      const { networkAddress } = require('@ccna/shared/labDefinition');
      const port = lab.initialState.devices
        .find((d) => d.id === action.deviceId)
        .interfaces.find((p) => networkAddress(p.ipAddress, p.subnetMask) === network);
      return { ...action, command: 'network ' + port.ipAddress + ' 0.0.0.0' };
    });
    const state = run(actions);
    assert.equal(gradeAttempt(state, lab.gradingSpec).score, 100);
    assert.equal(Object.keys(state.eigrpNeighbors).length, 6);
  });
}

test('initial startup configuration is absent; saving, editing, and saving again is graded correctly', () => {
  const initial = engine.initial(lab.initialState);
  assert.equal(initial.devices.R1.startupConfigModel, null);
  assert.equal(results(initial)['save-r1'].passed, false);
  let state = golden();
  const snapshot = structuredClone(state.devices.R1.startupConfigModel);
  state = run(commands('R1', ['configure terminal', 'hostname Changed', 'end']), state);
  assert.deepEqual(state.devices.R1.startupConfigModel, snapshot);
  assert.equal(results(state)['save-r1'].passed, false);
  assert.equal(evaluateCheck(state, { type: 'startup_config_saved', deviceId: 'R1' }).passed, true);
  state = run(commands('R1', ['write memory']), state);
  assert.equal(results(state)['save-r1'].passed, true);
});

test('normalized saved config ignores display text, independent ordering, and operational state', () => {
  const state = golden();
  const d = state.devices.R2;
  d.startupConfig = '! different comments and formatting';
  d.eigrp.networks.reverse();
  d.interfaces = Object.fromEntries(Object.entries(d.interfaces).reverse());
  d.mode = 'GLOBAL_CONFIG';
  d.context = { interface: null, vlanId: null };
  d.eigrpRoutes = [];
  d.arp = { cached: { tick: 100 } };
  assert.equal(startupMatchesRunning(d), true);
});

test('ACL ordering remains significant in configuration snapshots', () => {
  const d = golden().devices.R1;
  d.acls = {
    FILTER: [
      { action: 'permit', protocol: 'ip', text: 'permit ip any any' },
      { action: 'deny', protocol: 'ip', text: 'deny ip any any' },
    ],
  };
  d.startupConfigModel = configurationSnapshot(d);
  d.acls.FILTER[0].text = 'permit   ip any any';
  assert.equal(startupMatchesRunning(d), true);
  d.acls.FILTER.reverse();
  assert.equal(startupMatchesRunning(d), false);
});

test('single-device save also records a normalized snapshot', () => {
  let state = single.createInitialState();
  for (const command of ['enable', 'write memory']) {
    const result = single.executeCommand(state, command);
    assert.equal(result.isError, false);
    state = result.state;
  }
  assert.equal(startupMatchesRunning(state), true);
});

test('dependency ordering is independent of declaration order and progress skips blocked tasks', () => {
  const spec = {
    checks: [
      { id: 'child', type: 'hostname_equals', expected: 'Router', points: 10, dependsOn: ['root'] },
      { id: 'root', type: 'hostname_equals', expected: 'R1', points: 10 },
    ],
  };
  const state = single.createInitialState();
  const result = gradeAttempt(state, spec);
  assert.deepEqual(result.checks[0].blockedBy, ['root']);
  assert.equal(result.checks[0].actual, null);
  const progress = buildLabProgress(state, spec);
  assert.equal(progress.nextTaskId, 'root');
  assert.equal(progress.checks[0].status, 'blocked');
});

test('invalid dependency graphs and invalid learned-route sources are rejected', () => {
  const root = { id: 'a', type: 'hostname_equals', expected: 'R1', points: 1 };
  for (const checks of [
    [{ ...root, dependsOn: ['missing'] }],
    [{ ...root, dependsOn: ['a'] }],
    [
      { ...root, dependsOn: ['b'] },
      { ...root, id: 'b', dependsOn: ['a'] },
    ],
  ]) {
    assert.equal(gradingSpecSchema.safeParse({ checks }).success, false);
    assert.throws(() => gradeAttempt(single.createInitialState(), { checks }));
  }
  assert.equal(
    gradingSpecSchema.safeParse({
      checks: [
        {
          id: 'route',
          type: 'route_exists',
          deviceId: 'R1',
          destination: '4.4.4.4',
          points: 1,
          source: 'learned',
          protocol: 'S',
        },
      ],
    }).success,
    false
  );
});
