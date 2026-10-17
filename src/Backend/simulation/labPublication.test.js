const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertCourseModule,
  assertPublishReady,
  parseJsonArray,
  validateLabFields,
} = require('../validation/labPublication');

test('publish gate rejects incomplete Packet Tracer labs and accepts a runnable CLI lab', () => {
  assert.throws(
    () =>
      assertPublishReady({
        status: 'PUBLISHED',
        labType: 'PACKET_TRACER',
        objective: 'Configure routing',
        guideContent: '<p>Follow the guide</p>',
        steps: [],
        fileUrl: null,
        hasPacketTracerUpload: false,
      }),
    /file \.pkt/
  );
  assert.doesNotThrow(() =>
    assertPublishReady({
      status: 'PUBLISHED',
      labType: 'CLI_SIMULATION',
      objective: 'Configure EIGRP',
      guideContent: '<p>Use AS 1</p>',
      steps: [],
      gradingSpec: { checks: [{ id: 'eigrp' }] },
    })
  );
});

test('lab fields use typed tools/steps and reject invalid status', () => {
  const tools = parseJsonArray('["CLI Simulation"]', 'tools');
  const steps = parseJsonArray(
    '[{"title":"Configure","commands":["router eigrp 1"],"note":"AS 1"}]',
    'steps'
  );
  assert.doesNotThrow(() =>
    validateLabFields({ title: 'EIGRP', status: 'DRAFT', difficulty: 'MEDIUM', tools, steps })
  );
  assert.throws(
    () =>
      validateLabFields({ title: 'EIGRP', status: 'VISIBLE', difficulty: 'MEDIUM', tools, steps }),
    /Trạng thái/
  );
});

test('course-module validation requires the module to belong to the selected course', async () => {
  const prisma = {
    course: { findFirst: async ({ where }) => (where.id === 'SRW' ? { id: 'SRW' } : null) },
    module: {
      findFirst: async ({ where }) =>
        where.id === 'm1' && where.courseId === 'SRW' ? { id: 'm1' } : null,
    },
  };
  await assert.doesNotReject(assertCourseModule(prisma, 'SRW', 'm1'));
  await assert.rejects(assertCourseModule(prisma, 'SRW', 'other'), /không thuộc khóa học/);
});
