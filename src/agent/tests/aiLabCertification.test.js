const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('@ccna/shared/simulation/networkEngine');
const { transmit } = require('@ccna/shared/simulation/networkPackets');
const { layer2Path, routeTable } = require('@ccna/shared/simulation/networkProtocols');
const { gradeAttempt } = require('@ccna/shared/simulation/gradingEngine');
const { parseCliLabConfig, actionSchema } = require('@ccna/shared/cliLabSchema');
const { buildLabProgress } = require('../../backend/src/simulation/labProgress');
const { labs } = require('../fixtures/labs/disc03');
const { buildPublicDataset } = require('../fixtures/labs/publicFixture');
const clone = (value) => JSON.parse(JSON.stringify(value));
const execute = (state, actions) => {
  for (const action of actions) {
    actionSchema.parse(action);
    const before = clone(state);
    const result = engine.execute(state, action);
    assert.equal(result.isError, false, `${action.deviceId}: ${action.command}: ${result.output}`);
    assert.deepEqual(state, before, 'Engine actions must not mutate their input snapshot');
    state = result.state;
  }
  return state;
};
const inspect = (state, lab) => {
  const before = clone(state);
  const grade = gradeAttempt(state, lab.gradingSpec);
  const progress = buildLabProgress(state, lab.gradingSpec);
  const probes = lab.probes.map((probe) =>
    transmit(clone(state), probe.sourceId, probe.destination)
  );
  assert.deepEqual(state, before, 'Grading/progress and clone probes must leave state unchanged');
  assert.deepEqual(
    gradeAttempt(state, lab.gradingSpec),
    grade,
    'Inspection must not change scores'
  );
  assert.equal(progress.total, grade.checks.length);
  return { grade, probes };
};

for (const lab of labs) {
  test(`${lab.id}: valid definition, golden actions, and isolated read-only inspection`, () => {
    const parsed = parseCliLabConfig({
      labType: 'CLI_SIMULATION',
      courseId: 'synthetic-ai-certification',
      ...lab,
    });
    assert.equal(parsed.simulatorVersion, lab.simulatorVersion);
    const initial = engine.initial(parsed.initialState);
    assert.equal(gradeAttempt(initial, lab.gradingSpec).passed, false);
    const solved = execute(initial, lab.goldenActions);
    const { grade, probes } = inspect(solved, lab);
    assert.equal(grade.score, 100);
    assert.equal(grade.passed, true);
    assert.deepEqual(
      probes.map((p) => p.success),
      lab.probes.map((p) => p.success)
    );
    assert.ok(lab.cases.filter((c) => c.kind === 'correct').length >= 2);
    assert.ok(lab.cases.filter((c) => c.kind === 'fault').length >= 5);
  });

  for (const scenario of lab.cases) {
    test(`${lab.id}/${scenario.id}: ${scenario.label}`, () => {
      const solved = execute(engine.initial(lab.initialState), lab.goldenActions);
      const state = execute(solved, scenario.actions);
      const { grade, probes } = inspect(state, lab);
      const requestProbe = scenario.requestProbe || lab.probes[0];
      assert.equal(
        transmit(clone(state), requestProbe.sourceId, requestProbe.destination).success,
        scenario.kind === 'correct',
        'The eval question must address the affected connection, not an unrelated healthy VLAN'
      );
      if (scenario.kind === 'fault') {
        assert.equal(grade.passed, false);
        const failures = new Set(grade.checks.filter((c) => !c.passed).map((c) => c.id));
        for (const id of scenario.failedChecks)
          assert.ok(failures.has(id), `Expected failure: ${id}`);
        assert.ok(probes.some((probe, i) => lab.probes[i].success && !probe.success));
        const repaired = execute(state, scenario.repairActions);
        const recovered = inspect(repaired, lab);
        assert.equal(recovered.grade.score, 100, 'Targeted repair must restore all requirements');
        assert.deepEqual(
          recovered.probes.map((p) => p.success),
          lab.probes.map((p) => p.success)
        );
      } else {
        assert.equal(grade.score, 100);
        assert.deepEqual(
          probes.map((p) => p.success),
          lab.probes.map((p) => p.success)
        );
      }
      if (scenario.unusedShutdown !== undefined) {
        assert.equal(
          state.devices.R1.interfaces['GigabitEthernet0/3'].shutdown,
          scenario.unusedShutdown
        );
        assert.ok(
          !state.links.some((link) =>
            [link.a, link.b].some(
              (end) => end.deviceId === 'R1' && end.interface === 'GigabitEthernet0/3'
            )
          )
        );
      }
      if (scenario.defaultRoutes) {
        for (const id of ['R1', 'R2']) {
          const statics = routeTable(state, id).filter((route) => route.protocol === 'S');
          assert.equal(statics.length, 1);
          assert.equal(statics[0].mask, '0.0.0.0');
        }
        assert.ok(
          probes[0].events.some(
            (event) => event.type === 'ROUTE' && event.detail.startsWith('S 0.0.0.0/0.0.0.0')
          )
        );
      }
      if (scenario.requestDelivered) {
        assert.ok(probes[0].events.some((event) => event.type === 'DELIVERED'));
        assert.ok(!probes[0].events.some((event) => event.type === 'REPLY_DELIVERED'));
        assert.match(probes[0].reason, /Return path/);
      }
      if (scenario.unaffectedProbe) {
        assert.equal(
          transmit(
            clone(state),
            scenario.unaffectedProbe.sourceId,
            scenario.unaffectedProbe.destination
          ).success,
          true
        );
      }
    });
  }

  test(`${lab.id}: public fixture is reproducible and excludes private rubric/solution/canaries`, () => {
    const canary = 'PRIVATE_RUBRIC_DO_NOT_EXPORT_7c94';
    const tagged = clone(lab);
    tagged.hiddenRubric = canary;
    tagged.gradingSpec.checks[0].message = canary;
    tagged.cases[0].privateComment = canary;
    tagged.initialState.devices[0].privateActorId = canary;
    tagged.initialState.devices[0].interfaces[0].privateCredential = canary;
    const before = clone(tagged);
    const exported = buildPublicDataset(tagged);
    assert.deepEqual(tagged, before);
    const contents = JSON.stringify(exported);
    assert.ok(!contents.includes(canary));
    assert.doesNotMatch(
      contents,
      /"(?:gradingSpec|goldenActions|repairActions|failedChecks|expected|actual|kind|label|startupConfig|privateActorId|privateCredential)"/
    );
    assert.doesNotMatch(contents, /configure terminal|copy running-config|no ip route/);
    const file = path.resolve(__dirname, '../python/evals/fixtures/disc-03', `${lab.id}.json`);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), buildPublicDataset(lab));
    assert.deepEqual(
      exported.cases.map((c) => c.id),
      lab.cases.map((c) => c.id)
    );
  });
}

test('VLAN correct cases have actual L2 separation, even when cross-VLAN hosts use one IP subnet', () => {
  const lab = labs.find((item) => item.id === 'AI-VLAN-01');
  for (const scenario of lab.cases.filter((item) => item.kind === 'correct')) {
    const state = execute(
      execute(engine.initial(lab.initialState), lab.goldenActions),
      scenario.actions
    );
    const a = { deviceId: 'PC1', interface: 'GigabitEthernet0/0' };
    const b = { deviceId: 'PC3', interface: 'GigabitEthernet0/0' };
    assert.equal(layer2Path(state, a, b), null);
    const sameSubnet = clone(state);
    sameSubnet.devices.PC3.interfaces['GigabitEthernet0/0'].ipAddress = '192.0.2.20';
    assert.equal(transmit(sameSubnet, 'PC1', '192.0.2.20').success, false);
  }
});
