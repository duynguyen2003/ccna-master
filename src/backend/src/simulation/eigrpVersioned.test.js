const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('@ccna/shared/simulation/networkEngine');
const lab = require('@ccna/shared/labs/eigrp01');
const { buildEigrpLab } = require('@ccna/shared/labs/eigrp01Definition');
const { classicMetric, interfaceMetric } = require('@ccna/shared/simulation/eigrpClassic');
const { normalizeCommands } = require('@ccna/shared/labDefinition');
const { gradeAttempt } = require('@ccna/shared/simulation/gradingEngine');
const { captureDefinition, replayAttempt, canPractice, resultUpdate } = require('./labPolicy');
const run = (actions, state = engine.initial(lab.initialState)) => {
  for (const action of actions) {
    const result = engine.execute(state, action);
    assert.equal(result.isError, false, `${action.command}: ${result.output}`);
    state = result.state;
  }
  return state;
};
const configured = () => run(lab.stages[0].actions);
const route = (s, id, network) => s.devices[id].eigrpTopology.find((r) => r.network === network);

test('classic hand-calculated reference metrics include destination interface and integer truncation', () => {
  const s = configured();
  assert.equal(route(s, 'R3', '4.0.0.0').cost, 130816);
  assert.equal(route(s, 'R2', '4.0.0.0').cost, 131072);
  assert.equal(route(s, 'R1', '4.0.0.0').cost, 131328);
  assert.equal(route(s, 'R1', '192.1.23.0').cost, 3072);
  assert.equal(route(s, 'R1', '192.1.34.0').cost, 3328);
  assert.equal(route(s, 'R3', '4.0.0.0').reportedDistance, 128256);
  assert.equal(route(s, 'R4', '4.0.0.0').cost, 128256);
  assert.equal(classicMetric(1544, 25000), 2297856);
  assert.equal(classicMetric(1544, 20000), 2169856);
  assert.deepEqual(interfaceMetric('Serial0/0'), { bandwidthKbps: 1544, delayMicroseconds: 20000 });
  assert.equal(classicMetric(8000000, 5009), 128256);
});

test('serial one-hop engine route and topology output expose FD/RD', () => {
  const definition = structuredClone(lab.initialState);
  definition.devices = definition.devices.slice(2);
  definition.links = definition.links.slice(2);
  for (const d of definition.devices)
    d.interfaces = d.interfaces
      .filter((p) => p.name !== 'GigabitEthernet1/23')
      .map((p) => ({ ...p, name: p.name === 'GigabitEthernet1/34' ? 'Serial0/0' : p.name }));
  definition.links[0].a.interface = definition.links[0].b.interface = 'Serial0/0';
  const commands = definition.devices.flatMap((d) =>
    [
      'enable',
      'configure terminal',
      'router eigrp 1',
      'network 192.1.34.0 0.0.0.255',
      `network ${d.id === 'R3' ? '3' : '4'}.0.0.0 0.255.255.255`,
      'end',
    ].map((command) => ({ type: 'command', deviceId: d.id, command }))
  );
  const s = run(commands, engine.initial(definition));
  assert.equal(route(s, 'R3', '4.0.0.0').cost, 2297856);
  const result = engine.execute(s, {
    type: 'command',
    deviceId: 'R3',
    command: 'show ip eigrp topology',
  });
  assert.match(result.output, /2297856\/128256/);
});

test('bandwidth bottleneck and delay overrides reset to frozen defaults; legacy commands stay unchanged', () => {
  const action = (command) => ({ type: 'command', deviceId: 'R1', command });
  let state = run(
    [
      'configure terminal',
      'interface GigabitEthernet1/12',
      'bandwidth 1000',
      'delay 11',
      'end',
    ].map(action),
    configured()
  );
  // floor(10^7/1000) + 110/10 + remaining delay 502 = 10513.
  assert.equal(route(state, 'R1', '4.0.0.0').cost, 2691328);
  state = run(
    ['configure terminal', 'interface GigabitEthernet1/12', 'no bandwidth', 'no delay', 'end'].map(
      action
    ),
    state
  );
  assert.equal(route(state, 'R1', '4.0.0.0').cost, 131328);
  const legacy = run(
    ['enable', 'configure terminal', 'interface GigabitEthernet1/12'].map(action),
    engine.initial(lab.initialState, '2.1.0')
  );
  assert.equal(engine.execute(legacy, action('bandwidth 1000')).isError, true);
});

test('stages run sequentially and changing a transit address updates guide, networks and neighbors', () => {
  const changed = structuredClone(lab.initialState);
  for (const d of changed.devices)
    for (const p of d.interfaces) p.ipAddress = p.ipAddress.replace('192.1.12.', '172.16.12.');
  const rebuilt = buildEigrpLab(changed);
  assert.ok(rebuilt.labRecord.guideContent.includes('172.16.12.1/24'));
  assert.ok(!rebuilt.labRecord.guideContent.includes('192.1.12.'));
  let state = engine.initial(rebuilt.initialState);
  for (const step of rebuilt.labRecord.steps)
    state = run(
      normalizeCommands(step.commands).map((a) => ({ type: 'command', ...a })),
      state
    );
  assert.equal(gradeAttempt(state, rebuilt.gradingSpec).score, 100);
  assert.deepEqual(normalizeCommands(['R1/R2: show ip route']), [
    { deviceId: 'R1', command: 'show ip route' },
    { deviceId: 'R2', command: 'show ip route' },
  ]);
});

test('server replay uses captured engine version and rejects gaps/oversized journals', () => {
  const records = lab.stages[0].actions.map((action, i) => ({ sequence: i + 1, action }));
  const definition = { initialState: lab.initialState, simulatorVersion: '2.1.0' };
  const legacy = replayAttempt(definition, records);
  assert.equal(legacy.devices.R1.eigrpRoutes.find((r) => r.network === '4.0.0.0').cost, 8448);
  const modern = replayAttempt({ ...definition, simulatorVersion: '3.0.0' }, records);
  assert.equal(route(modern, 'R1', '4.0.0.0').cost, 131328);
  assert.throws(() => replayAttempt(definition, [{ ...records[0], sequence: 2 }]), /Incomplete/);
  assert.throws(() => replayAttempt(definition, Array(501).fill(records[0])), /limit/);
  assert.throws(() => engine.initial(lab.initialState, '999.0.0'), /Unsupported/);
});

test('required checks, hint usage and immutable achievement milestones', () => {
  const definition = captureDefinition(lab.labRecord, {
    LAB_LEARNING_OBSERVATIONS_ENABLED: '1',
    LAB_MASTERY_ENABLED: '1',
  });
  const noMetric = lab.scenarios.find((s) => s.id === 'without-metric');
  const s = run(noMetric.actions);
  const grade = gradeAttempt(s, definition.gradingSpec);
  assert.equal(grade.score, 80);
  assert.equal(grade.passed, true);
  assert.equal(grade.mastered, false);
  const time = new Date('2026-11-01T00:00:00Z');
  const a = { status: 'IN_PROGRESS', definition };
  const passed = { ...a, ...resultUpdate(a, grade, time) };
  assert.equal(canPractice(passed), true);
  const failed = resultUpdate(passed, { score: 0, passed: false, mastered: false }, new Date());
  assert.equal(failed.status, 'PASSED');
  assert.equal(failed.bestScore, 80);
  assert.equal(failed.firstPassedAt, time);
  const mastered = {
    ...passed,
    ...resultUpdate(passed, { score: 100, passed: true, mastered: true }, time),
  };
  assert.equal(resultUpdate(mastered, { score: 0, passed: false }, new Date()).status, 'MASTERED');
  assert.equal(canPractice({ status: 'PASSED', definition: {} }), false);
  const hinted = engine.execute(s, { type: 'hint', checkId: 'metric-r1', level: 1 }).state;
  assert.equal(gradeAttempt(hinted, definition.gradingSpec).score, 80);
  assert.equal(hinted.learningEvidence.hints['metric-r1'], 1);
});

test('feature flags are captured and rollout can omit observation/mastery for new attempts', () => {
  const env = { LAB_LEARNING_OBSERVATIONS_ENABLED: '1', LAB_MASTERY_ENABLED: '1' };
  const active = captureDefinition(lab.labRecord, env);
  env.LAB_MASTERY_ENABLED = '0';
  assert.equal(active.features.mastery, true);
  const fallback = captureDefinition(lab.labRecord, {});
  assert.equal(fallback.features.mastery, false);
  assert.equal(fallback.gradingSpec.passingScore, 100);
  assert.ok(!fallback.gradingSpec.checks.some((c) => c.type === 'eigrp_passive_observed'));
  const ordinary = captureDefinition(
    {
      ...lab.labRecord,
      gradingSpec: {
        passingScore: 70,
        checks: [{ id: 'name', type: 'hostname_equals', expected: 'R1', points: 100 }],
      },
    },
    {}
  );
  assert.equal(ordinary.gradingSpec.passingScore, 70);
  assert.equal(ordinary.features, undefined);
});
