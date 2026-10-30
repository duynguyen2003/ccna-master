import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiLabApi } from '../../browser/api/aiLabApi.js';
import { ids, request } from '../../browser/fixtures/responses.js';

const response = (data, headers = { 'X-AI-Contract-Version': '1.0.0' }) =>
  new Response(JSON.stringify({ contractVersion: '1.0.0', data }), { headers });
test('strict adapter uses bearer/header, no shared cache and returns validated resource', async () => {
  let call;
  const api = createAiLabApi({
    baseUrl: '/api',
    token: 'synthetic',
    fetchImpl: async (...args) => {
      call = args;
      return response(request());
    },
  });
  assert.equal((await api.read(ids.attempt, ids.request)).status, 'COMPLETED');
  assert.equal(call[1].headers.Authorization, 'Bearer synthetic');
  assert.equal(call[1].cache, 'no-store');
  assert.ok(!call[0].includes('synthetic'));
});
test('version mismatch, unknown fields and unresolved command/evidence IDs fail closed', async () => {
  for (const value of [
    () => response(request(), {}),
    () => response({ ...request(), hiddenField: true }),
    () => {
      const data = structuredClone(request());
      data.result.answer.nextSteps[0].commandId = 'fake';
      return response(data);
    },
  ]) {
    const api = createAiLabApi({ baseUrl: '/api', token: 'x', fetchImpl: async () => value() });
    await assert.rejects(api.read(ids.attempt, ids.request));
  }
});
test('legacy 401 clears application auth, malformed proxy responses stay errors', async () => {
  let cleared = 0;
  const api = createAiLabApi({
    baseUrl: '/api',
    token: 'x',
    onUnauthorized: () => cleared++,
    fetchImpl: async () => new Response('{"message":"expired"}', { status: 401 }),
  });
  await assert.rejects(api.capabilities(ids.attempt), { status: 401 });
  assert.equal(cleared, 1);
  const proxy = createAiLabApi({
    baseUrl: '/api',
    token: 'x',
    fetchImpl: async () => new Response('<html>proxy</html>', { status: 502 }),
  });
  await assert.rejects(proxy.recover(ids.attempt, ids.client), {
    status: 502,
    code: 'AI_HTTP_ERROR',
  });
});
