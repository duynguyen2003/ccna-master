const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createDevRuntime } = require('../scripts/start-dev-ai.cjs');

function harness(overrides = {}, settings = {}) {
  const children = [];
  const events = [];
  const stopped = [];
  let time = 0;
  const backendUrl = new URL('http://127.0.0.1:5500/api/health/ready');
  const pythonUrl = new URL('http://127.0.0.1:8001/health/ready');
  const runtime = createDevRuntime(
    { root: process.cwd(), backendUrl, pythonUrl, ...settings },
    {
      spawn(_node, [script], options) {
        assert.equal(options.windowsHide, true);
        assert.equal(options.stdio, 'inherit');
        assert.equal(options.shell, undefined);
        const child = Object.assign(new EventEmitter(), {
          pid: children.length + 200,
          exitCode: null,
          signalCode: null,
        });
        children.push(child);
        events.push(script);
        return child;
      },
      portOccupied: async () => false,
      now: () => time,
      delay: async (milliseconds) => {
        time += milliseconds;
      },
      fetch: async (url) => {
        events.push(`ready:${url.port}`);
        return {
          ok: true,
          json: async () =>
            url.port === '5500'
              ? { status: 'ok' }
              : { service: 'ai-python', status: 'ready', adapter: 'gemini' },
        };
      },
      stopChild: async (child) => {
        stopped.push(child.pid);
        child.exitCode = 0;
        child.emit('exit', 0);
      },
      log() {},
      ...overrides,
    }
  );
  return { runtime, children, events, stopped };
}

test('dev runtime waits for backend and Gemini readiness before starting the worker', async () => {
  const h = harness();
  await h.runtime.start();
  assert.deepEqual(h.events, [
    'src/backend/src/Server.js',
    'ready:5500',
    'src/agent/scripts/start-python.cjs',
    'ready:8001',
    'src/agent/workers/aiWorker.js',
  ]);
  await h.runtime.stop();
  assert.deepEqual(h.stopped, [202, 201, 200]);
  assert.equal(await h.runtime.done, undefined);
});

test('attaching to an existing backend never starts or stops that backend', async () => {
  const h = harness({}, { existingBackend: true });
  await h.runtime.start();
  assert.equal(h.children.length, 2);
  assert.equal(h.events[0], 'ready:5500');
  await Promise.all([h.runtime.stop(), h.runtime.stop()]);
  assert.deepEqual(h.stopped, [201, 200]);
});

test('explicit dev runtime starts and owns the independent sweeper', async () => {
  const h = harness({}, { sweeper: true });
  await h.runtime.start();
  assert.equal(h.events.at(-1), 'src/agent/workers/aiSweeper.js');
  await h.runtime.stop();
  assert.deepEqual(h.stopped, [203, 202, 201, 200]);
});

for (const port of ['5500', '8001']) {
  test(`occupied port ${port} fails without stopping any existing process`, async () => {
    const h = harness({ portOccupied: async (url) => url.port === port });
    await assert.rejects(h.runtime.start(), /đang/);
    assert.equal(h.children.length, 0);
    assert.deepEqual(h.stopped, []);
  });
}

test('failed backend readiness cleans up and never starts Python or worker', async () => {
  const h = harness(
    {
      fetch: async () => ({ ok: false }),
    },
    { readyTimeoutMs: 1 }
  );
  await assert.rejects(h.runtime.start(), /chưa sẵn sàng/);
  assert.equal(h.children.length, 1);
  assert.deepEqual(h.stopped, [200]);
});

test('Python without Gemini readiness cannot start a worker; owned backend is cleaned up', async () => {
  const h = harness(
    {
      fetch: async (url) => ({
        ok: true,
        json: async () =>
          url.port === '5500'
            ? { status: 'ok' }
            : { service: 'ai-python', status: 'disabled', adapter: null },
      }),
    },
    { readyTimeoutMs: 1 }
  );
  await assert.rejects(h.runtime.start(), /chưa sẵn sàng/);
  assert.equal(h.children.length, 2);
  assert.deepEqual(h.stopped, [201, 200]);
});

test('worker failure stops all owned services and surfaces a safe error', async () => {
  const h = harness();
  await h.runtime.start();
  h.children[2].emit('exit', 1);
  assert.match((await h.runtime.done).message, /worker AI đã dừng/);
  assert.deepEqual(h.stopped, [202, 201, 200]);
});

test('spawn error cancels readiness promptly and cleans up started services', async () => {
  let h;
  h = harness({
    fetch: async (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        queueMicrotask(() => h.children[0].emit('error', new Error('sensitive native details')));
      }),
  });
  await assert.rejects(h.runtime.start(), /^Error: Không khởi động được backend\.$/);
  assert.deepEqual(h.stopped, [200]);
});

test('Ctrl+C during readiness never starts another service', async () => {
  let h;
  h = harness({
    fetch: async (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        queueMicrotask(() => {
          void h.runtime.stop();
        });
      }),
  });
  await h.runtime.start();
  assert.equal(await h.runtime.done, undefined);
  assert.equal(h.children.length, 1);
  assert.deepEqual(h.stopped, [200]);
});

test('cleanup errors are reported without exposing native details', async () => {
  const h = harness({
    stopChild: async () => {
      throw new Error('sensitive native details');
    },
  });
  await h.runtime.start();
  await h.runtime.stop();
  assert.equal((await h.runtime.done).message, 'Không dừng được toàn bộ tiến trình AI.');
});
