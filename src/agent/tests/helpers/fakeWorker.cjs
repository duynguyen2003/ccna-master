// Test-only transport. Never imported by application runtime.
const { VERSION, schemas } = require('@ccna/shared/aiLabContract');
const { setTimeout: delay } = require('node:timers/promises');
const { projectContext } = require('../../node/context');
const { diagnosticAnswer } = require('../../node/diagnostics');
// Kept as a fixture helper for BE-04 crash/recovery tests. It now uses the real
// BE-05 public projection; only the execution transport below remains fake.
function fakePrepare(row) {
  return projectContext(row);
}
function fakeAnalyze(base, sleepMs = 300) {
  const url = new URL(base);
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/internal/v1/ai'
  )
    throw new Error('Fake worker internal URL must be loopback /internal/v1/ai');
  return async (input, tokens) => {
    const binding = schemas.ClaimRequest.parse({
      contractVersion: VERSION,
      requestId: input.requestId,
      callId: input.callId,
      contextHash: input.contextHash,
      leaseVersion: input.leaseVersion,
    });
    const send = async (operation, method, body, token) => {
      const response = await fetch(`${base}/provider-calls/${input.callId}/${operation}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-AI-Contract-Version': VERSION,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) throw new Error('AI_INTERNAL_CALL_REJECTED');
      return response.json();
    };
    await send('claim', 'POST', binding, tokens.claimToken);
    await delay(sleepMs);
    const receipt = {
      ...binding,
      outcome: 'RECEIVED',
      providerRequestId: null,
      usage: { status: 'FINAL', inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
      versions: input.versions,
      finishReason: 'fake',
      output: diagnosticAnswer(input) || {
        summary: 'Luồng AI giả đã hoàn tất. Chưa có phân tích bài lab bằng model thật.',
        claimType: 'INSUFFICIENT_CONTEXT',
        evidenceIds: [],
        nextSteps: [],
        verification: 'Tiếp tục kiểm tra bài lab bằng công cụ mô phỏng.',
        hintLevel: 1,
      },
    };
    const saved = schemas.ReceiptResponse.parse(
      await send('receipt', 'PUT', receipt, tokens.receiptToken)
    );
    return {
      contractVersion: VERSION,
      callId: input.callId,
      contextHash: input.contextHash,
      receiptHash: saved.data.receiptHash,
    };
  };
}

module.exports = { fakePrepare, fakeAnalyze };
