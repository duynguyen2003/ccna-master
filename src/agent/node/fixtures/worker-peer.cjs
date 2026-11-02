const assert = require('node:assert/strict');
const target = new URL(process.env.AI_TEST_DATABASE_URL);
assert.equal(target.hostname, '127.0.0.1');
assert.match(target.pathname, /^\/ai_lab_be01_(fresh|upgrade)_[a-f0-9]+$/);
assert.equal(process.env.DATABASE_URL, target.toString());
assert.equal(process.env.LAB_AI_MODE, 'deterministic');
const express = require('express');
const { getPrisma } = require('../../../backend/src/config/database');
const config = require('./worker-config.cjs')();
// The isolated peer explicitly injects its synthetic test provider into HTTP wiring.
require('../workerConfig').runtimeConfig = () => config;
const db = getPrisma();
const queue = require('../leases').leases(db, config);
const permits = require('../dispatch').dispatch(db, config);
const results = require('../receipts').receipts(db, config);
const { createWorker } = require('../../workers/aiWorker');
const { fakePrepare, fakeAnalyze } = require('../../tests/helpers/fakeWorker.cjs');
const app = express();
app.use('/internal/v1/ai', require('../../routes/aiInternal')(db, config));
app.use(express.json());
app.use('/api/lab-attempts', require('../../../backend/src/routes/labAttempts'));
const server = app.listen(0, '127.0.0.1', () => {
  process.send({ ready: true, port: server.address().port, pid: process.pid });
});
const workerId = `peer_${process.pid}`;
process.on('disconnect', () => {
  server.close();
  db.$disconnect().finally(() => process.exit(0));
});
process.on('message', async ({ id, action, args = [] }) => {
  try {
    let value;
    if (action === 'claim') value = await queue.claim(workerId);
    else if (action === 'plan') {
      const row = await db.aiRequest.findUnique({ where: { id: args[0] } });
      value = await permits.plan(row.id, workerId, row.leaseVersion, fakePrepare(row));
    } else if (action === 'reap') value = await queue.reap();
    else if (action === 'heartbeat') value = await queue.heartbeat(args[0], workerId, args[1]);
    else if (action === 'finalize') value = await results.finalize(...args);
    else if (action === 'tick')
      value = await createWorker(db, config, {
        workerId,
        prepare: fakePrepare,
        onError: (error) => console.error('Synthetic worker failure:', error.message),
        analyze: fakeAnalyze(
          `http://127.0.0.1:${server.address().port}/internal/v1/ai`,
          args[0] || 300
        ),
      }).tick();
    else throw new Error('Unknown fixture action');
    process.send({ id, value });
  } catch (error) {
    process.send({ id, error: error.code || error.message });
  }
});
