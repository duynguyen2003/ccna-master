const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { getActivityCalendar } = require('./activityCalendar');

test(
  'activity calendar: real PostgreSQL deduplication, timezone and private HTTP access',
  {
    skip: process.env.CORE_INTEGRATION !== '1',
    timeout: 30000,
  },
  async (t) => {
    assert.match(new URL(process.env.DATABASE_URL).pathname, /_test$/);
    const app = require('../Server');
    const jwt = require('jsonwebtoken');
    const { getPrisma, disconnectDatabase } = require('../config/database');
    const prisma = getPrisma();
    const users = [];
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const request = (path, token) =>
      new Promise((resolve, reject) => {
        const req = http.get(
          {
            host: '127.0.0.1',
            port: server.address().port,
            path: `/api/users/stats/activity-calendar${path}`,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
          (res) => {
            let body = '';
            res.on('data', (chunk) => {
              body += chunk;
            });
            res.on('end', () =>
              resolve({ status: res.statusCode, body: JSON.parse(body), headers: res.headers })
            );
          }
        );
        req.on('error', reject);
      });
    try {
      for (let i = 0; i < 2; i++)
        users.push(
          await prisma.user.create({
            data: {
              email: `calendar-${randomUUID()}@example.invalid`,
              passwordHash: 'synthetic-unusable',
              createdAt: new Date('2024-01-01T00:00:00Z'),
            },
          })
        );
      const events = [
        ['LESSON_COMPLETED', 1, '2026-10-27T16:59:59.999Z'],
        ['LESSON_COMPLETED', 1, '2026-10-28T01:00:00Z'],
        ['LESSON_COMPLETED', 2, '2026-10-27T17:00:00Z'],
        ['LAB_COMPLETED', 1, '2026-10-28T01:00:00Z'],
        ['LESSON_COMPLETED', 4, '2025-10-28T16:59:59Z'],
        ['LESSON_COMPLETED', 4, '2026-10-28T01:00:00Z'],
        ['MODULE_COMPLETED', 5, '2026-10-28T01:00:00Z'],
        ['COURSE_COMPLETED', 6, '2026-10-28T01:00:00Z'],
        ['LESSON_COMPLETED', null, '2026-10-28T01:00:00Z'],
        ['LESSON_COMPLETED', 0, '2026-10-28T01:00:00Z'],
        ['LESSON_COMPLETED', 8, '2026-10-28T15:00:00Z'],
        ['LESSON_COMPLETED', 9, '2024-02-28T17:00:00Z'],
      ];
      await prisma.userActivity.createMany({
        data: events.map(([type, referenceId, date]) => ({
          userId: users[0].id,
          type,
          referenceId,
          title: 'Synthetic',
          createdAt: new Date(date),
        })),
      });
      await prisma.userActivity.create({
        data: {
          userId: users[1].id,
          type: 'LAB_COMPLETED',
          referenceId: 1,
          title: 'Other account',
          createdAt: new Date('2026-10-28T01:00:00Z'),
        },
      });
      const fixedNow = new Date('2026-10-28T12:00:00Z');
      await t.test(
        'deduplicates before range filtering, separates types, and never infers a missing history',
        async () => {
          const data = await getActivityCalendar(prisma, users[0].id, {}, fixedNow);
          assert.equal(data.total, 3);
          assert.equal(data.activeDays, 2);
          assert.deepEqual(data.days, [
            { date: '2026-10-27', lesson: 1, lab: 0, count: 1 },
            { date: '2026-10-28', lesson: 1, lab: 1, count: 2 },
          ]);
          assert.equal(data.historyCompleteness, 'unknown');
          assert.deepEqual(data.availableYears, [2026, 2025, 2024]);
          assert.equal(
            (await getActivityCalendar(prisma, users[0].id, { type: 'lesson' }, fixedNow)).total,
            2
          );
          assert.equal(
            (await getActivityCalendar(prisma, users[0].id, { type: 'lab' }, fixedNow)).total,
            1
          );
          assert.equal((await getActivityCalendar(prisma, users[1].id, {}, fixedNow)).total, 1);
          const leap = await getActivityCalendar(
            prisma,
            users[0].id,
            { range: 'year', year: '2024' },
            fixedNow
          );
          assert.equal(leap.days[0].date, '2024-02-29');
        }
      );
      const token = jwt.sign(
        { id: users[0].id, sessionVersion: users[0].sessionVersion },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );
      await t.test('HTTP requires a current session and only returns its owner data', async () => {
        assert.equal((await request('')).status, 401);
        const response = await request('?type=lab', token);
        assert.equal(response.status, 200);
        assert.match(response.headers['cache-control'], /private, no-store/);
        const expected = await getActivityCalendar(prisma, users[0].id, { type: 'lab' });
        assert.deepEqual(response.body.data, expected);
        assert.equal(JSON.stringify(response.body).includes('Other account'), false);
        assert.equal((await request(`?userId=${users[1].id}`, token)).status, 400);
        assert.equal((await request('?range=year&year=9999', token)).status, 400);
        await prisma.user.update({
          where: { id: users[0].id },
          data: { sessionVersion: { increment: 1 } },
        });
        assert.equal((await request('', token)).status, 401);
      });
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
      await new Promise((resolve) => server.close(resolve));
      await disconnectDatabase();
    }
  }
);
