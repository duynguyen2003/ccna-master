const { test } = require('node:test');
const assert = require('node:assert/strict');
const { labs } = require('./fixtures/foundationLabs');
const { parseCliLabConfig } = require('../validation/cliLabSchema');
const engine = require('@ccna/shared/simulation/networkEngine');
const { gradeAttempt } = require('@ccna/shared/simulation/gradingEngine');
for (const fixture of labs)
  test(`${fixture.key}: real simulator solution and broken-link regression`, () => {
    const definition = parseCliLabConfig({ ...fixture.data, courseId: 'ITN' });
    let state = engine.initial(definition.initialState);
    assert.equal(gradeAttempt(state, definition.gradingSpec).score, 0);
    for (const action of fixture.solution) {
      const result = engine.execute(state, action);
      assert.equal(result.isError, false, result.output);
      state = result.state;
    }
    const before = JSON.stringify(state);
    assert.equal(gradeAttempt(state, definition.gradingSpec).score, 100);
    assert.equal(JSON.stringify(state), before);
    state.links[0].enabled = false;
    assert.equal(gradeAttempt(state, definition.gradingSpec).passed, false);
  });
