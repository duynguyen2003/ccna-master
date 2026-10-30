// Dedicated child process for the isolated admission integration test.
const assert = require('node:assert/strict');
const url = new URL(process.env.AI_TEST_DATABASE_URL);
assert.equal(url.hostname, '127.0.0.1');
assert.match(url.pathname, /^\/ai_lab_be01_(fresh|upgrade)_[a-f0-9]+$/);
assert.equal(process.env.DATABASE_URL, url.toString());
assert.equal(process.env.LAB_AI_MODE, 'deterministic');
// Admission-only test process: no worker/provider is dispatched here.
const workerConfig = require('../workerConfig');
const { runtimeConfig } = workerConfig;
workerConfig.runtimeConfig = () => ({ ...runtimeConfig(), enabled: true, providers: undefined });
const server = require('../../../backend/src/Server').listen(0, '127.0.0.1', () => {
  process.send({ port: server.address().port, pid: process.pid });
});
