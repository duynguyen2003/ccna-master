import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSseParser, readSse } from '../../browser/api/sse.js';
import { createAiLabApi } from '../../browser/api/aiLabApi.js';
import { request, ids } from '../../browser/fixtures/responses.js';

test('SSE parses split UTF-8, CRLF/CR/LF, multiline data and ignores comments/unfinished EOF', async () => {
  const found = [];
  const bytes = new TextEncoder().encode(
    ': heartbeat\r\nid: 7\revent: state\r\ndata: chào\r\ndata: R2\r\n\r\ndata: ignored'
  );
  await readSse(
    new ReadableStream({
      start(c) {
        for (const byte of bytes) c.enqueue(new Uint8Array([byte]));
        c.close();
      },
    }),
    (event) => found.push(event)
  );
  assert.deepEqual(found, [{ id: '7', type: 'state', data: 'chào\nR2' }]);
});
test('SSE bounds unterminated lines and accumulated multiline events', () => {
  for (const value of ['data: ' + 'a'.repeat(50), 'data: a\ndata: b\ndata: c\n']) {
    const parser = createSseParser(() => {}, { maxSize: 20 });
    assert.throws(() => parser.push(value), { code: 'AI_INVALID_RESPONSE' });
  }
});
test('aborting a stream cancels its reader without dispatching a partial event', async () => {
  const abort = new AbortController();
  let cancelled = false;
  const source = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode('data: partial'));
    },
    cancel() {
      cancelled = true;
    },
  });
  const reading = readSse(source, () => assert.fail('partial dispatch'), { signal: abort.signal });
  abort.abort();
  await reading;
  assert.equal(cancelled, true);
});

function streamed(status = 'COMPLETED', version = 4) {
  const data = request(status);
  data.progress = {
    streamVersion: version,
    phase: status === 'COMPLETED' ? 'FINISHED' : 'ANALYZING',
    unitStatus: status === 'COMPLETED' ? 'RELEASED' : 'RESERVED',
    reasonCode: null,
    deadlineAt: new Date(Date.now() + 60000).toISOString(),
  };
  const kind = status === 'COMPLETED' ? 'result' : 'state';
  return { data, kind, contractVersion: '1.0.0' };
}
const response = (event) =>
  new Response(
    `id: ${ids.request}:${event.data.progress.streamVersion}\nevent: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`,
    { headers: { 'Content-Type': 'text/event-stream', 'X-AI-Contract-Version': '1.0.0' } }
  );
test('fetch SSE keeps Bearer in headers, resumes same request and validates final result', async () => {
  let call;
  const events = [];
  const api = createAiLabApi({
    baseUrl: '/api',
    token: 'synthetic',
    fetchImpl: async (...args) => {
      call = args;
      return response(streamed());
    },
  });
  await api.events(ids.attempt, ids.request, {
    lastEventId: `${ids.request}:2`,
    onEvent: (e) => events.push(e),
  });
  assert.equal(events[0].data.result.messageId, request().result.messageId);
  assert.equal(call[1].headers.Authorization, 'Bearer synthetic');
  assert.equal(call[1].headers['Last-Event-ID'], `${ids.request}:2`);
  assert.equal(call[1].body, undefined);
  assert.ok(!call[0].includes('synthetic'));
});
test('SSE rejects mismatched request, event kind, ID and unresolved command references', async () => {
  for (const mutate of [
    (e) => {
      e.data.progress.unitStatus = 'CONSUMED';
    },
    (e) => {
      e.data.progress.phase = 'ANALYZING';
    },
    (e) => {
      e.data.requestId = ids.client;
    },
    (e) => {
      e.kind = 'state';
    },
    (e) => {
      e.data.result.answer.nextSteps[0].commandId = 'untrusted';
    },
  ]) {
    const event = streamed();
    mutate(event);
    const api = createAiLabApi({
      baseUrl: '/api',
      token: 'x',
      fetchImpl: async () => response(event),
    });
    await assert.rejects(
      api.events(ids.attempt, ids.request, { onEvent: () => assert.fail('invalid event') })
    );
  }
});
