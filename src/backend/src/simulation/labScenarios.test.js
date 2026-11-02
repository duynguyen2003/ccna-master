const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('@ccna/shared/simulation/networkEngine');
const { gradeAttempt } = require('@ccna/shared/simulation/gradingEngine');
const { transmit } = require('@ccna/shared/simulation/networkPackets');
const { parseCliLabConfig } = require('@ccna/shared/cliLabSchema');

const directory = path.resolve(__dirname, '../../../shared/labs');
for (const filename of fs
  .readdirSync(directory)
  .filter((name) => name.endsWith('.js'))
  .sort()) {
  const lab = require(path.join(directory, filename));
  for (const scenario of lab.scenarios || []) {
    test(`${filename}: ${scenario.id}`, () => {
      const definition = parseCliLabConfig(lab.labRecord);
      let state = engine.initial(definition.initialState);
      for (const action of scenario.actions) {
        const result = engine.execute(state, action);
        assert.equal(
          result.isError,
          false,
          `${action.deviceId}: ${action.command}: ${result.output}`
        );
        state = result.state;
      }
      const grade = gradeAttempt(state, definition.gradingSpec);
      assert.equal(grade.passed, scenario.expected.passed);
      if (scenario.expected.score !== undefined) assert.equal(grade.score, scenario.expected.score);
      const checks = new Map(grade.checks.map((check) => [check.id, check]));
      for (const id of scenario.expected.failedChecks || []) {
        assert.ok(checks.has(id), `Unknown expected check: ${id}`);
        assert.equal(checks.get(id).passed, false, id);
        assert.notEqual(checks.get(id).status, 'blocked', `${id} must fail independently`);
      }
      for (const id of scenario.expected.blockedChecks || []) {
        assert.equal(checks.get(id)?.status, 'blocked', id);
        assert.equal(checks.get(id).pointsAwarded, 0, id);
      }
      for (const probe of scenario.expected.reachable || []) {
        assert.equal(
          transmit(structuredClone(state), probe.deviceId, probe.destination).success,
          true
        );
      }
    });
  }
}
