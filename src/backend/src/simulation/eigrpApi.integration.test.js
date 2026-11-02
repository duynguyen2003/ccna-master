const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

test(
  'EIGRP v3 HTTP: immutable import, replay evidence, hints and persistent mastery',
  { skip: process.env.LAB_INTEGRATION !== '1', timeout: 90000 },
  async () => {
    const app = require('../Server');
    const jwt = require('jsonwebtoken');
    const { getPrisma } = require('../config/database');
    const { publishLab } = require('../../../scripts/import-eigrp01.cjs');
    const lab = require('@ccna/shared/labs/eigrp01');
    const prisma = getPrisma();
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const previousFlags = [
      process.env.LAB_LEARNING_OBSERVATIONS_ENABLED,
      process.env.LAB_MASTERY_ENABLED,
    ];
    const previousCourse = lab.labRecord.courseId;
    const previousTitle = lab.labRecord.title;
    let user, course, imported, draftId;
    let token;
    const request = async (path, method = 'GET', body) => {
      const r = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, body: await r.json() };
    };
    try {
      process.env.LAB_LEARNING_OBSERVATIONS_ENABLED = '1';
      process.env.LAB_MASTERY_ENABLED = '1';
      user = await prisma.user.create({
        data: {
          email: `eigrp-${randomUUID()}@example.invalid`,
          passwordHash: 'test-only',
          fullName: 'EIGRP test',
          role: 'ADMIN',
        },
      });
      token = jwt.sign(
        { id: user.id, sessionVersion: user.sessionVersion, role: 'ADMIN' },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );
      course = await prisma.course.create({
        data: {
          id: `t${randomUUID().replace(/-/g, '').slice(0, 9)}`,
          code: 'EIGRPTEST',
          title: 'Temporary EIGRP course',
          status: 'PUBLISHED',
        },
      });
      lab.labRecord.courseId = course.id;
      const draft = await request('/learning/labs', 'POST', {
        ...lab.labRecord,
        schemaVersion: 1,
        status: 'DRAFT',
        title: 'Admin EIGRP copy',
      });
      assert.equal(draft.status, 201, JSON.stringify(draft.body));
      draftId = draft.body.lab.id;
      assert.equal(draft.body.lab.schemaVersion, 2);
      assert.equal(draft.body.lab.contentSource, 'ADMIN');
      assert.equal(draft.body.lab.labKey, null);
      assert.equal(draft.body.lab.durationMinutes, 50);
      assert.deepEqual(draft.body.lab.steps[0].commands[0], { deviceId: 'R1', command: 'enable' });
      // This test requires its own empty test database: never adopt an existing revision.
      assert.equal(await prisma.lab.count({ where: { labKey: lab.labRecord.labKey } }), 0);
      imported = await publishLab(prisma);
      assert.equal(imported.action, 'created');
      assert.equal((await publishLab(prisma)).action, 'unchanged');
      lab.labRecord.title = 'Changed without version bump';
      await assert.rejects(() => publishLab(prisma), /Increment labVersion/);
      lab.labRecord.title = previousTitle;
      assert.equal(
        (await request(`/learning/labs/${imported.id}`, 'PUT', { title: 'Mutable' })).status,
        409
      );
      const start = await request(`/lab-attempts/labs/${imported.id}/start`, 'POST');
      assert.equal(start.status, 201, JSON.stringify(start.body));
      const id = start.body.data.id;
      const path = `/lab-attempts/${id}`;
      assert.equal(start.body.data.simulatorVersion, '3.0.0');
      assert.equal(start.body.data.features.mastery, true);
      assert.equal(start.body.data.lab.guideFormat, 'markdown');
      assert.equal(start.body.data.lab.tasks[0].hints.length, 0);
      // Rollout flags and later lab edits cannot change a captured attempt.
      process.env.LAB_MASTERY_ENABLED = '0';
      await prisma.lab.update({
        where: { id: imported.id },
        data: {
          guideContent: 'Later revision',
          gradingSpec: {
            passingScore: 100,
            checks: [
              {
                id: 'impossible',
                type: 'hostname_equals',
                deviceId: 'R1',
                expected: 'Impossible',
                points: 100,
              },
            ],
          },
        },
      });
      let revision = 0;
      const action = async (action) => {
        const r = await request(path + '/commands', 'POST', { action, expectedRevision: revision });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.data.event.isError, false, r.body.data.event.output);
        revision = r.body.data.state.revision;
        return r.body.data;
      };
      const checkId = start.body.data.lab.tasks[0].id;
      const skipped = await request(path + '/commands', 'POST', {
        action: { type: 'hint', checkId, level: 3 },
        expectedRevision: revision,
      });
      assert.equal(skipped.status, 400);
      const hint = await action({ type: 'hint', checkId, level: 1 });
      assert.equal(hint.tasks[0].hints.length, 1);
      for (const a of lab.scenarios.find((s) => s.id === 'without-metric').actions) await action(a);
      const records = await prisma.labCommand.findMany({ where: { attemptId: id } });
      assert.ok(
        records.some((r) =>
          r.events?.some(
            (e) => e.type === 'neighbor_down' && e.cause?.handler === 'eigrp_passive_interface'
          )
        )
      );
      const submit = async (body) => {
        const r = await request(path + '/submit', 'POST', body);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        return r.body.data;
      };
      const passed = await submit();
      assert.equal(passed.result.score, 80);
      assert.equal(passed.result.passed, true);
      assert.equal(passed.result.withoutHints, false);
      assert.equal(passed.result.policyVersion, 3);
      assert.equal(passed.attempt.status, 'PASSED');
      assert.equal(passed.attempt.canPractice, true);
      const firstPassedAt = passed.attempt.firstPassedAt;
      assert.equal(
        (await request(`/lab-attempts/labs/${imported.id}/start`, 'POST')).body.data.id,
        id
      );
      for (const a of lab.stages.find((s) => s.id === 'metric').actions) await action(a);
      await action({ type: 'command', deviceId: 'R1', command: 'write memory' });
      const mastered = await submit();
      assert.equal(mastered.result.score, 100);
      assert.equal(mastered.attempt.status, 'MASTERED');
      assert.equal(mastered.attempt.firstPassedAt, firstPassedAt);
      for (const command of [
        'configure terminal',
        'interface GigabitEthernet1/12',
        'shutdown',
        'end',
      ])
        await action({ type: 'command', deviceId: 'R1', command });
      // A forged body and even a stale persisted cache cannot override the server journal.
      await prisma.labAttempt.update({
        where: { id },
        data: { deviceState: mastered.attempt.state },
      });
      const later = await submit({ state: mastered.attempt.state, score: 100 });
      assert.equal(later.result.passed, false);
      assert.equal(later.attempt.status, 'MASTERED');
      assert.equal(later.attempt.bestScore, 100);
      assert.equal(later.attempt.masteredAt, mastered.attempt.masteredAt);
      assert.equal(later.attempt.state.devices.R1.interfaces['GigabitEthernet1/12'].shutdown, true);
      const replay = await request(path + '/replay?sequence=' + revision);
      assert.deepEqual(replay.body.data.state, later.attempt.state);
      assert.equal(
        await prisma.userActivity.count({
          where: { userId: user.id, referenceId: imported.id, type: 'LAB_COMPLETED' },
        }),
        1
      );
      const achievements = await request('/lab-attempts/achievements');
      assert.equal(achievements.body.data.points, 100);
      assert.equal(achievements.body.data.completed, 1);
    } finally {
      lab.labRecord.title = previousTitle;
      lab.labRecord.courseId = previousCourse;
      ['LAB_LEARNING_OBSERVATIONS_ENABLED', 'LAB_MASTERY_ENABLED'].forEach((key, i) => {
        if (previousFlags[i] === undefined) delete process.env[key];
        else process.env[key] = previousFlags[i];
      });
      if (imported) await prisma.lab.delete({ where: { id: imported.id } });
      if (draftId) await prisma.lab.delete({ where: { id: draftId } });
      if (user) await prisma.user.delete({ where: { id: user.id } });
      if (course) await prisma.course.delete({ where: { id: course.id } });
      await new Promise((resolve) => server.close(resolve));
      await prisma.$disconnect();
    }
  }
);
