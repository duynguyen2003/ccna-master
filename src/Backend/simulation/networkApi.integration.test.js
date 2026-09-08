const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

test('PostgreSQL + HTTP: snapshot, permissions, concurrent commands, replay, grading and load', { skip: process.env.LAB_INTEGRATION !== '1', timeout: 60000 }, async (t) => {
  const jwt = require('jsonwebtoken');
  const app = require('../Server');
  const { getPrisma } = require('../config/database');
  const prisma = getPrisma();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  let bases = [`http://127.0.0.1:${server.address().port}/api`];
  if (process.env.LAB_REPLICAS === '1') {
    const addresses = await require('node:dns').promises.resolve4('backend');
    assert.ok(new Set(addresses).size >= 2, 'Expected at least two backend replicas');
    bases = [...new Set(addresses)].map((ip) => `http://${ip}:5000/api`);
    console.log(`Testing ${bases.length} backend replicas against shared PostgreSQL`);
  }
  let replicaIndex = 0;
  const userIds = []; let courseId; let labId; let attemptId;
  const tokens = [];
  const request = async (path, index = 0, method = 'GET', body) => {
    const base = bases[replicaIndex++ % bases.length];
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(index >= 0 ? { Authorization: `Bearer ${tokens[index]}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, body: await r.json() };
  };
  try {
    for (let i = 0; i < 3; i++) {
      const user = await prisma.user.create({ data: { email: `lab-test-${randomUUID()}@example.invalid`, passwordHash: 'unusable-integration-test-hash', fullName: 'Temporary CLI integration test' } });
      userIds.push(user.id); tokens.push(jwt.sign({ id: user.id, role: i === 0 ? 'ADMIN' : 'STUDENT' }, process.env.JWT_SECRET, { expiresIn: '5m' }));
    }
    const course = await prisma.course.create({ data: { id: `t${randomUUID().replace(/-/g, '').slice(0, 9)}`, code: 'LABTEST', title: 'Temporary CLI integration course' } }); courseId = course.id;
    const initialState = { devices: [{ id: 'R1', deviceType: 'ROUTER', hostname: 'Router', interfaces: ['GigabitEthernet0/0'] }], links: [] };
    const gradingSpec = { passingScore: 100, checks: [{ id: 'name', type: 'hostname_equals', deviceId: 'R1', expected: 'Target', points: 100 }] };
    await t.test('admin can create network lab through real validation + Prisma', async () => {
      const result = await request('/learning/labs', 0, 'POST', { title: 'Temporary network lab', courseId, labType: 'CLI_SIMULATION', initialState, gradingSpec, status: 'PUBLISHED' });
      assert.equal(result.status, 201, JSON.stringify(result.body)); labId = result.body.lab.id;
    });
    await t.test('partial lab update preserves course link', async () => {
      const result = await request(`/learning/labs/${labId}`, 0, 'PUT', { title: 'Temporary network lab updated' });
      assert.equal(result.status, 200, JSON.stringify(result.body)); assert.equal(result.body.lab.courseId, courseId);
    });
    await t.test('concurrent starts resume exactly one attempt', async () => {
      const results = await Promise.all([request(`/lab-attempts/labs/${labId}/start`, 0, 'POST'), request(`/lab-attempts/labs/${labId}/start`, 0, 'POST')]);
      results.forEach((r) => assert.equal(r.status, 201, JSON.stringify(r.body)));
      attemptId = results[0].body.data.id; assert.equal(results[1].body.data.id, attemptId);
      assert.equal(await prisma.labAttempt.count({ where: { userId: userIds[0], labId } }), 1);
    });
    await t.test('public metadata hides rubric and unauthenticated attempt access fails', async () => {
      const r = await request('/learning/labs?limit=100', -1); assert.equal(r.status, 200);
      for (const lab of r.body.data) assert.equal('gradingSpec' in lab, false);
      assert.equal((await request(`/lab-attempts/${attemptId}`, -1)).status, 401);
      assert.equal((await request(`/lab-attempts/${attemptId}`, 2)).status, 404);
    });
    const path = () => `/lab-attempts/${attemptId}`;
    const command = async (text, index = 0) => {
      const state = (await request(path(), index)).body.data.state;
      return request(path() + '/commands', index, 'POST', { command: text, deviceId: 'R1', expectedRevision: state.revision });
    };
    await t.test('same revision from two requests has one winner and no lost update', async () => {
      const results = await Promise.all([1, 2].map(() => request(path() + '/commands', 0, 'POST', { command: 'enable', deviceId: 'R1', expectedRevision: 0 })));
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      assert.equal(await prisma.labCommand.count({ where: { attemptId } }), 1);
    });
    await t.test('owner adds member; member configures but cannot invite or submit', async () => {
      assert.equal((await request(path() + '/members', 0, 'POST', { userId: userIds[1] })).status, 200);
      assert.equal((await command('conf t', 1)).status, 200);
      assert.equal((await request(path() + '/members', 1, 'POST', { userId: userIds[2] })).status, 403);
      assert.equal((await request(path() + '/submit', 1, 'POST')).status, 403);
      assert.equal((await request(path() + '/restart', 1, 'POST')).status, 403);
    });
    await t.test('replay is read-only and immutable initial rubric survives admin edits', async () => {
      const before = (await request(path())).body.data.state;
      const replay = await request(path() + '/replay?sequence=1'); assert.equal(replay.status, 200); assert.equal(replay.body.data.state.devices.R1.mode, 'PRIVILEGED_EXEC');
      assert.deepEqual((await request(path())).body.data.state, before);
      await prisma.lab.update({ where: { id: labId }, data: { gradingSpec: { ...gradingSpec, checks: [{ ...gradingSpec.checks[0], expected: 'ChangedAfterStart' }] } } });
      assert.equal((await command('hostname Target', 1)).status, 200);
    });
    await t.test('revocation removes access immediately and direct progress bypass is rejected', async () => {
      assert.equal((await request(path() + '/members', 0, 'POST', { userId: userIds[1], remove: true })).status, 200);
      assert.equal((await request(path(), 1)).status, 404);
      const routes = require('node:fs').readFileSync(require('node:path').join(__dirname, '../routes/users.js'), 'utf8');
      assert.ok(routes.includes('updateProgress'));
      const response = await request('/users/progress', 0, 'POST', { labId, courseId, status: 'COMPLETED', progressPercent: 100 });
      assert.equal(response.status, 403, JSON.stringify(response.body));
    });
    await t.test('owner can abandon an in-progress attempt and start a fresh one', async () => {
      const previousAttemptId = attemptId;
      const abandoned = await request(path() + '/restart', 0, 'POST');
      assert.equal(abandoned.status, 200, JSON.stringify(abandoned.body)); assert.equal(abandoned.body.data.status, 'FAILED');
      const started = await request(`/lab-attempts/labs/${labId}/start`, 0, 'POST');
      assert.equal(started.status, 201, JSON.stringify(started.body)); assert.notEqual(started.body.data.id, previousAttemptId);
      assert.equal((await prisma.labAttempt.findUnique({ where: { id: previousAttemptId } })).status, 'FAILED');
      attemptId = started.body.data.id;
      await command('enable'); await command('conf t'); await command('hostname ChangedAfterStart');
      const ready = await request(path());
      assert.equal(ready.status, 200, JSON.stringify(ready.body));
      assert.equal(ready.body.data.state.devices.R1.hostname, 'ChangedAfterStart');
    });
    await t.test('concurrent submit awards completion once using snapshot rubric', async () => {
      const responses = await Promise.all([request(path() + '/submit', 0, 'POST'), request(path() + '/submit', 0, 'POST')]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]); assert.equal(responses.find((r) => r.status === 200).body.data.result.score, 100);
      assert.equal(await prisma.userProgress.count({ where: { userId: userIds[0], labId, status: 'COMPLETED' } }), 1);
      assert.equal(await prisma.userActivity.count({ where: { userId: userIds[0], referenceId: labId, type: 'LAB_COMPLETED' } }), 1);
      assert.equal((await command('end')).status, 409);
    });
    await t.test('achievements and feedback endpoints use server result', async () => {
      const r = await request('/lab-attempts/achievements'); assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.data.points, 100); assert.equal(r.body.data.completed, 1);
      // No live provider calls from this integration test.
      const saved = process.env.LAB_AI_URL; delete process.env.LAB_AI_URL;
      try { assert.equal((await request(path() + '/explain', 0, 'POST')).body.data.provider, 'deterministic'); } finally { if (saved) process.env.LAB_AI_URL = saved; }
    });
    await t.test('40 concurrent authenticated reads complete without errors', async () => {
      const samples = await Promise.all(Array.from({ length: 40 }, async () => {
        const start = performance.now();
        const response = await request(path());
        return { duration: performance.now() - start, status: response.status };
      }));
      const failures = samples.filter((sample) => sample.status !== 200);
      const durations = samples.map((sample) => sample.duration).sort((a, b) => a - b);
      const rssMiB = process.memoryUsage().rss / 1024 / 1024;
      console.log(`HTTP load: 40 reads, p50=${durations[19].toFixed(1)}ms, p95=${durations[37].toFixed(1)}ms, max=${durations[39].toFixed(1)}ms, errors=${failures.length}/40, RSS=${rssMiB.toFixed(1)}MiB`);
      assert.equal(failures.length, 0, JSON.stringify(failures));
    });
  } finally {
    // Delete only rows created above, identified by captured IDs; preserve all user data.
    if (labId) await prisma.lab.delete({ where: { id: labId } });
    for (const id of userIds) await prisma.user.delete({ where: { id } });
    if (courseId) await prisma.course.delete({ where: { id: courseId } });
    await new Promise((resolve) => server.close(resolve)); await prisma.$disconnect();
  }
});
