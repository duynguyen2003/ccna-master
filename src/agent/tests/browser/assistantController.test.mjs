import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAssistantController } from '../../browser/state/assistantController.js';
import { ids, capabilities, quota, request } from '../../browser/fixtures/responses.js';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function harness(overrides = {}, store = new Map()) {
  const timers = new Map();
  let next = 0;
  const calls = [];
  const api = {
    capabilities: async () => ({
      ...capabilities,
      conversationId: calls.length ? ids.conversation : null,
    }),
    quota: async () => ({ quota }),
    history: async () => ({
      conversationId: ids.conversation,
      conversationEpoch: 0,
      items: [],
      nextCursor: null,
    }),
    create: async (_, body) => {
      calls.push(body);
      return request('QUEUED');
    },
    read: async () => request(),
    recover: async () => request(),
    cancel: async () => request('CANCELLED'),
    feedback: async (_, messageId, input) => ({ messageId, helpful: input.helpful }),
    ...overrides,
  };
  const controller = createAssistantController({
    api,
    userId: 1,
    attemptId: ids.attempt,
    uuid: () => ids.client,
    storage: {
      getItem: (key) => store.get(key),
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key),
    },
    setTimer: (fn, delay) => {
      timers.set(++next, { fn, delay });
      return next;
    },
    clearTimer: (id) => timers.delete(id),
    random: () => 0,
  });
  return { controller, timers, store, calls };
}

test('conversation reset fences late requests, clears private state and reconnects at the new epoch', async () => {
  let epoch = 0;
  const late = deferred();
  const h = harness({
    capabilities: async () => ({
      ...capabilities,
      conversationId: ids.conversation,
      conversationEpoch: epoch,
    }),
    read: async () => late.promise,
    reset: async (attempt, conversation, expected) => {
      assert.equal(attempt, ids.attempt);
      assert.equal(conversation, ids.conversation);
      assert.equal(expected, 0);
      epoch = 1;
      return { deleted: true, conversationEpoch: epoch };
    },
    history: async () => ({
      conversationId: ids.conversation,
      conversationEpoch: epoch,
      items: [],
      nextCursor: null,
    }),
  });
  await h.controller.start();
  await h.controller.send({ intent: 'NEXT_STEP' }, 3);
  const polling = h.controller.retry();
  await flush();
  assert.equal(await h.controller.resetConversation(), true);
  late.resolve(request());
  await polling;
  assert.equal(h.controller.getSnapshot().capabilities.conversationEpoch, 1);
  assert.equal(h.controller.getSnapshot().request, null);
  assert.equal(h.controller.getSnapshot().pending, null);
  assert.equal(h.controller.getSnapshot().resetting, false);
  assert.equal(h.store.size, 0);
});

test('double submit has one stable ID, no question/token/result enters session storage', async () => {
  const h = harness();
  await h.controller.start();
  const one = h.controller.send({ intent: 'NEXT_STEP', message: 'private question' }, 3);
  await h.controller.send({ intent: 'NEXT_STEP' }, 3);
  await one;
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].clientRequestId, ids.client);
  assert.equal(h.controller.getSnapshot().phase, 'pending');
  const saved = [...h.store.values()][0];
  assert.ok(saved.includes(ids.client));
  assert.ok(!saved.includes('private question'));
  assert.ok(!saved.includes('token'));
  assert.ok(!saved.includes('summary'));
  h.controller.stop();
  assert.equal(h.timers.size, 0);
});

test('lost POST response and reload recover the original request without another POST', async () => {
  let posts = 0;
  let recovered;
  const h = harness({
    create: async () => {
      posts++;
      throw new Error('network');
    },
  });
  await h.controller.start();
  await h.controller.send({ intent: 'NEXT_STEP' }, 3);
  assert.equal(h.controller.getSnapshot().phase, 'uncertain');
  h.controller.stop();
  const reopened = harness(
    {
      recover: async (_, id) => {
        recovered = id;
        return request();
      },
      create: async () => {
        posts++;
      },
    },
    h.store
  );
  await reopened.controller.start();
  assert.equal(recovered, ids.client);
  assert.equal(posts, 1);
  assert.equal(reopened.controller.getSnapshot().request.status, 'COMPLETED');
  assert.equal(h.store.size, 0);
  reopened.controller.stop();
});

test('retry after confirmed lookup miss resends the identical body and ID after revision changes', async () => {
  const bodies = [];
  let count = 0;
  const h = harness({
    create: async (_, body) => {
      bodies.push(body);
      if (++count === 1) throw new Error('network');
      return request('QUEUED');
    },
    recover: async () => {
      throw { status: 404, code: 'AI_RESOURCE_NOT_FOUND' };
    },
  });
  await h.controller.start();
  await h.controller.send({ intent: 'NEXT_STEP', message: 'original' }, 3);
  await h.controller.retry();
  assert.equal(bodies.length, 2);
  assert.deepEqual(bodies[0], bodies[1]);
  assert.equal(bodies[1].expectedRevision, 3);
  h.controller.stop();
});

test('late owner response is ignored after stop; new owner starts without content', async () => {
  const late = deferred();
  const h = harness({ create: () => late.promise });
  await h.controller.start();
  const pending = h.controller.send({ intent: 'NEXT_STEP' }, 3);
  h.controller.stop({ forgetPending: true });
  late.resolve(request());
  await pending;
  assert.equal(h.controller.getSnapshot().request, null);
  assert.equal(h.store.size, 0);
});

test('hidden/offline/closed panels stop IO, reopening resumes one poll loop', async () => {
  const h = harness({
    read: async () => request('RUNNING'),
    recover: async () => request('RUNNING'),
  });
  await h.controller.start();
  await h.controller.send({ intent: 'NEXT_STEP' }, 3);
  assert.equal(h.timers.size, 1);
  h.controller.setEnvironment({ isVisible: false });
  assert.equal(h.timers.size, 0);
  h.controller.setEnvironment({ isVisible: true });
  await flush();
  assert.equal(h.timers.size, 1);
  h.controller.setEnvironment({ isOnline: false });
  assert.equal(h.timers.size, 0);
  assert.equal(h.controller.getSnapshot().phase, 'offline');
  h.controller.stop();
});

test('cancel stays terminal even if an older GET arrives late', async () => {
  const late = deferred();
  const h = harness({ read: () => late.promise });
  await h.controller.start();
  await h.controller.send({ intent: 'NEXT_STEP' }, 3);
  const read = h.controller.retry();
  await flush();
  await h.controller.cancel();
  late.resolve(request('RUNNING'));
  await read;
  assert.equal(h.controller.getSnapshot().request.status, 'CANCELLED');
  assert.equal(h.controller.getSnapshot().pending, null);
  h.controller.stop();
});

test('revoked history clears content and invalidates in-flight output', async () => {
  const late = deferred();
  const h = harness({
    create: () => late.promise,
    history: async () => {
      throw { status: 403, code: 'AI_NOT_ELIGIBLE' };
    },
  });
  await h.controller.start();
  const post = h.controller.send({ intent: 'NEXT_STEP' }, 3);
  // A read after the first accepted request now sees a conversation, then revocation.
  late.resolve(request());
  await post;
  await flush();
  assert.equal(h.controller.getSnapshot().phase, 'blocked');
  assert.deepEqual(h.controller.getSnapshot().messages, []);
  assert.equal(h.controller.getSnapshot().request, null);
  h.controller.stop();
});

test('invalid intent data is rejected before persisting or sending', async () => {
  const h = harness();
  await h.controller.start();
  await h.controller.send({ intent: 'DIAGNOSE', selectedDeviceId: 'R1' }, 3);
  assert.equal(h.calls.length, 0);
  assert.equal(h.store.size, 0);
  assert.equal(h.controller.getSnapshot().error.code, 'AI_INVALID_REQUEST');
  h.controller.stop();
});

test('cancel clicked before POST acknowledgement is applied as soon as request ID arrives', async () => {
  const late = deferred();
  let cancellations = 0;
  const h = harness({
    create: () => late.promise,
    cancel: async () => {
      cancellations++;
      return request('CANCELLED');
    },
  });
  await h.controller.start();
  const pending = h.controller.send({ intent: 'NEXT_STEP' }, 3);
  await h.controller.cancel();
  assert.equal(cancellations, 0);
  late.resolve(request('QUEUED'));
  await pending;
  await flush();
  assert.equal(cancellations, 1);
  assert.equal(h.controller.getSnapshot().request.status, 'CANCELLED');
  assert.equal(h.timers.size, 0);
  h.controller.stop();
});

test('structured service-unavailable rejection is not mistaken for an admitted request', async () => {
  const h = harness({
    create: async () => {
      throw { status: 503, code: 'AI_DISABLED' };
    },
  });
  await h.controller.start();
  await h.controller.send({ intent: 'NEXT_STEP' }, 3);
  assert.equal(h.controller.getSnapshot().pending, null);
  assert.equal(h.controller.getSnapshot().error.code, 'AI_DISABLED');
  assert.equal(h.timers.size, 0);
  assert.equal(h.store.size, 0);
  h.controller.stop();
});

test('poll honors a longer server Retry-After instead of clamping it to 30 seconds', async () => {
  const h = harness({
    read: async () => {
      throw { status: 429, code: 'AI_USER_RATE_LIMITED', retryAfterMs: 45000 };
    },
  });
  await h.controller.start();
  await h.controller.send({ intent: 'NEXT_STEP' }, 3);
  await h.controller.retry();
  assert.ok([...h.timers.values()].every((timer) => timer.delay >= 45000));
  h.controller.stop();
});

test('manual retry cannot overlap a GET already in flight or leave the old timer armed', async () => {
  const late = deferred();
  let reads = 0;
  const h = harness({
    read: () => {
      reads++;
      return late.promise;
    },
  });
  await h.controller.start();
  await h.controller.send({ intent: 'NEXT_STEP' }, 3);
  const first = h.controller.retry();
  await h.controller.retry();
  assert.equal(reads, 1);
  assert.equal(h.timers.size, 0);
  late.resolve(request('RUNNING'));
  await first;
  assert.equal(h.timers.size, 1);
  h.controller.stop();
});

test('lookup 404 rechecks access so a removed member cannot retain history or resend', async () => {
  let checks = 0;
  const h = harness({
    capabilities: async () => {
      if (++checks > 1) throw { status: 404, code: 'AI_RESOURCE_NOT_FOUND' };
      return capabilities;
    },
    create: async () => {
      throw new Error('lost');
    },
    recover: async () => {
      throw { status: 404, code: 'AI_RESOURCE_NOT_FOUND' };
    },
  });
  await h.controller.start();
  await h.controller.send({ intent: 'NEXT_STEP' }, 3);
  await h.controller.retry();
  assert.equal(h.controller.getSnapshot().phase, 'blocked');
  assert.equal(h.controller.getSnapshot().pending, null);
  assert.deepEqual(h.controller.getSnapshot().messages, []);
  assert.equal(h.store.size, 0);
  h.controller.stop();
});
