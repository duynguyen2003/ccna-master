const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createRequestStreamHub, encode } = require('./requestStream');
const { examples } = require('../contracts/ai-lab/v1/fixtures/build-cases.cjs');
const resource = (status = 'RUNNING', version = 2) => ({
  ...structuredClone(examples.resource),
  status,
  ...(status === 'RUNNING' ? { responseMode: 'NONE', result: null, pollAfterMs: 2000 } : {}),
  progress: {
    streamVersion: version,
    phase: status === 'RUNNING' ? 'ANALYZING' : 'FINISHED',
    unitStatus: status === 'RUNNING' ? 'RESERVED' : 'CONSUMED',
    reasonCode: null,
    deadlineAt: new Date(Date.now() + 60000).toISOString(),
  },
});
class Response extends EventEmitter {
  chunks = [];
  writableLength = 0;
  writableEnded = false;
  status() {
    return this;
  }
  set(headers) {
    this.headers = headers;
    return this;
  }
  flushHeaders() {
    this.headersSent = true;
  }
  write(text) {
    this.chunks.push(text);
    return true;
  }
  end() {
    this.writableEnded = true;
  }
}
function harness(read, options = {}) {
  const timers = new Map();
  let id = 0;
  const hub = createRequestStreamHub({
    read,
    setTimer: (fn) => {
      timers.set(++id, fn);
      return id;
    },
    clearTimer: (i) => timers.delete(i),
    ...options,
  });
  const attach = (res = new Response(), principal = { id: 1, sessionVersion: 1 }) =>
    hub
      .attach({ principal, attemptId: 'attempt', requestId: examples.resource.requestId, res })
      .then(() => res);
  const tick = async () => {
    const [key, fn] = [...timers][0];
    timers.delete(key);
    fn();
    for (let i = 0; i < 15; i++) await Promise.resolve();
  };
  return { hub, timers, attach, tick };
}
test('tabs share reads, reconnect receives committed result and connections are bounded', async () => {
  let data = resource();
  const h = harness(async () => ({ data }));
  const a = await h.attach();
  const b = await h.attach();
  assert.equal(h.hub.stats().groups, 1);
  await assert.rejects(h.attach(), { code: 'AI_CONCURRENT_LIMIT' });
  const before = h.hub.stats().queries;
  await h.tick();
  assert.equal(h.hub.stats().queries - before, 1);
  data = resource('COMPLETED', 3);
  await h.tick();
  assert.ok(a.chunks.join('').includes('event: result'));
  assert.ok(b.writableEnded);
  assert.deepEqual(h.hub.stats(), { groups: 0, connections: 0, queries: before + 2 });
  const reconnected = await h.attach();
  assert.ok(reconnected.chunks.join('').includes('event: result'));
  assert.equal(reconnected.writableEnded, true);
});
test('access is rechecked before publication; revocation closes all subscribers', async () => {
  let revoked = false;
  const h = harness(async () => {
    if (revoked) throw Object.assign(new Error(), { code: 'AI_RESOURCE_NOT_FOUND' });
    return { data: resource() };
  });
  const res = await h.attach();
  revoked = true;
  await h.tick();
  assert.ok(res.chunks.join('').includes('event: error'));
  assert.ok(!res.chunks.join('').includes('event: result'));
  assert.equal(h.hub.stats().connections, 0);
});
test('slow readers, disconnected sockets and token expiry release timers and memory', async () => {
  let now = 100;
  const h = harness(async () => ({ data: resource() }), { now: () => now });
  const slow = new Response();
  slow.write = () => false;
  await h.attach(slow);
  assert.equal(h.hub.stats().connections, 0);
  const res = await h.attach();
  res.emit('close');
  assert.equal(h.timers.size, 0);
  const expired = await h.attach(new Response(), { id: 1, sessionVersion: 1, tokenExpiresAt: 200 });
  now = 201;
  await h.tick();
  assert.ok(expired.writableEnded);
  assert.equal(h.hub.stats().connections, 0);
});
test('encoding is contract checked, not a channel for arbitrary model text', () => {
  const data = resource();
  data.progress.phase = 'raw model text';
  assert.throws(() => encode(data));
});
test('initial access failure releases the count before headers; heartbeat carries no event ID', async () => {
  const denied = harness(async () => {
    throw Object.assign(new Error(), { code: 'AI_RESOURCE_NOT_FOUND' });
  });
  const response = new Response();
  await assert.rejects(denied.attach(response), { code: 'AI_RESOURCE_NOT_FOUND' });
  assert.equal(response.headersSent, undefined);
  assert.equal(denied.hub.stats().connections, 0);
  let now = 0;
  const h = harness(async () => ({ data: resource() }), { now: () => now });
  const res = await h.attach();
  now = 11000;
  await h.tick();
  assert.match(res.chunks.at(-1), /^: heartbeat/);
  assert.ok(!res.chunks.at(-1).includes('id:'));
  h.hub.close();
  assert.equal(h.timers.size, 0);
});
test('connection TTL still closes when an authorization read is stalled', async () => {
  let expire, finish;
  const h = harness(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    {
      setDeadlineTimer: (fn) => {
        expire = fn;
        return 1;
      },
      clearDeadlineTimer: () => {},
    }
  );
  const res = new Response();
  const attaching = h.attach(res);
  expire();
  assert.equal(res.writableEnded, true);
  assert.equal(h.hub.stats().connections, 0);
  finish({ data: resource() });
  await attaching;
  assert.equal(h.hub.stats().groups, 0);
});
