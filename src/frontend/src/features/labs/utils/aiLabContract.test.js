import { schemas, canTransitionRequest } from '@ccna/shared/aiLabContract';

// Test-only import: the application bundle imports schemas, never internal fixtures.
const fixtures = require('../../../../../agent/contracts/ai-lab/v1/fixtures/cases.json');

describe('AI wire contract in the browser runtime', () => {
  test.each(fixtures.schemaCases)('$id', ({ schema, value, valid }) => {
    expect(schemas[schema].safeParse(value).success).toBe(valid);
  });

  test('the UI cannot reopen a terminal result or retry an unknown dispatch', () => {
    expect(canTransitionRequest('COMPLETED', 'RUNNING')).toBe(false);
    expect(canTransitionRequest('OUTCOME_UNKNOWN', 'QUEUED')).toBe(false);
  });
});
