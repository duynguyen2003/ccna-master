const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { PrismaPgClient } = require('../config/prismaPgClient');
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test('Prisma relation queries wait per connection; errors do not prevent rollback', async (t) => {
  const gate = deferred(),
    started = [];
  t.mock.method(Client.prototype, 'query', async function (sql) {
    started.push(sql);
    if (sql === 'first') await gate.promise;
    if (sql === 'bad') throw new Error('statement failed');
    return { rows: [sql] };
  });
  const client = new PrismaPgClient();
  const first = client.query('first');
  const bad = client.query('bad');
  const error = assert.rejects(bad, /statement failed/);
  const rollback = client.query('ROLLBACK');
  await Promise.resolve();
  assert.deepEqual(started, ['first']);
  gate.resolve();
  await first;
  await error;
  assert.deepEqual(await rollback, { rows: ['ROLLBACK'] });
  assert.deepEqual(started, ['first', 'bad', 'ROLLBACK']);
});

test('Pool callback and Promise query forms share the queue without serializing different clients', async (t) => {
  const gate = deferred(),
    started = [];
  t.mock.method(Client.prototype, 'query', async function (sql) {
    started.push(sql);
    if (sql === 'slow') await gate.promise;
    return { rows: [sql] };
  });
  const a = new PrismaPgClient(),
    b = new PrismaPgClient();
  const slow = a.query('slow');
  const callback = new Promise((resolve, reject) =>
    a.query('callback', [], (err, value) => (err ? reject(err) : resolve(value)))
  );
  await b.query('independent');
  assert.deepEqual(started, ['slow', 'independent']);
  gate.resolve();
  await slow;
  assert.deepEqual(await callback, { rows: ['callback'] });
  assert.deepEqual(started, ['slow', 'independent', 'callback']);
});

test(
  'PostgreSQL: overlapping calls avoid pg warnings and a failed transaction can roll back and reuse its connection',
  { skip: process.env.LAB_INTEGRATION !== '1' },
  async () => {
    const { Pool } = require('pg');
    assert.match(new URL(process.env.DATABASE_URL).pathname, /_test$/);
    const pool = new Pool({
      Client: PrismaPgClient,
      connectionString: process.env.DATABASE_URL,
      max: 1,
    });
    const warnings = [];
    const onWarning = (warning) => {
      if (/client\.query\(\).*already executing/.test(warning.message)) warnings.push(warning);
    };
    process.on('warning', onWarning);
    try {
      const client = await pool.connect();
      let pid;
      try {
        pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await client.query('BEGIN');
        const reads = await Promise.all([
          client.query('SELECT pg_sleep(0.01), 1 AS value'),
          client.query('SELECT 2 AS value'),
          client.query('SELECT 3 AS value'),
        ]);
        assert.deepEqual(
          reads.map((read) => read.rows[0].value),
          [1, 2, 3]
        );
        const failed = assert.rejects(client.query('SELECT 1/0'), { code: '22012' });
        const rollback = client.query('ROLLBACK');
        await failed;
        await rollback;
      } finally {
        client.release();
      }
      assert.equal((await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid, pid);
      assert.deepEqual(warnings, []);
    } finally {
      await pool.end();
      process.off('warning', onWarning);
    }
  }
);
