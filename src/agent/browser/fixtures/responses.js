// Synthetic, browser-safe fixtures. Not imported by the production panel.
export const ids = {
  attempt: '11111111-1111-4111-8111-111111111111',
  conversation: '22222222-2222-4222-8222-222222222222',
  request: '33333333-3333-4333-8333-333333333333',
  message: '44444444-4444-4444-8444-444444444444',
  client: '55555555-5555-4555-8555-555555555555',
};
export const quota = { remaining: 9, reserved: 0, resetAt: '2026-10-29T00:00:00.000Z' };
export const capabilities = {
  eligible: true,
  conversationId: null,
  conversationEpoch: 0,
  recoveryEpoch: 'epoch_test',
  intents: ['NEXT_STEP', 'DIAGNOSE', 'EXPLAIN_CONCEPT', 'LAB_REVIEW'],
  supportedDeviceIds: ['R1', 'PC1'],
  supportedTopics: [],
  limits: { questionCharacters: 2000, contextBytes: 65536, userConcurrent: 1 },
  serverTime: '2026-10-28T09:00:00.000Z',
};
export const result = {
  messageId: ids.message,
  answer: {
    summary: 'Kiểm tra trạng thái cổng trước khi thử kết nối.',
    claimType: 'HYPOTHESIS',
    evidenceIds: ['eR1'],
    nextSteps: [{ text: 'Đọc trạng thái cổng trên R1.', commandId: 'cmdR1' }],
    verification: 'Dùng ping để kiểm tra lại sau khi điều chỉnh.',
    hintLevel: 1,
  },
  evidence: [
    {
      evidenceId: 'eR1',
      kind: 'INTERFACE',
      deviceId: 'R1',
      interface: 'GigabitEthernet0/0',
      sourceRevision: 3,
      observation: 'Cổng đang tắt.',
      confidenceClass: 'OBSERVED',
      scope: 'Cổng R1',
    },
  ],
  commands: [
    { commandId: 'cmdR1', deviceId: 'R1', mode: 'USER_EXEC', command: 'show ip interface brief' },
  ],
  versions: {
    contextSchemaVersion: '1.0.0',
    simulatorVersion: 'test-v1',
    diagnosticVersion: 'sim01-r1-v1',
    promptVersion: 'r1',
    policyVersion: '1',
    modelVersion: 'fake',
    priceVersion: 'test',
    appCommit: '0'.repeat(40),
  },
};
export function request(status = 'COMPLETED', overrides = {}) {
  const pending = ['QUEUED', 'RUNNING'].includes(status);
  return {
    requestId: ids.request,
    conversationId: ids.conversation,
    conversationEpoch: 0,
    recoveryEpoch: 'epoch_test',
    intent: 'NEXT_STEP',
    sourceRevision: 3,
    currentRevision: 3,
    stale: false,
    sourceProvenance: 'LIVE_SNAPSHOT',
    quota,
    serverTime: capabilities.serverTime,
    status,
    responseMode: status === 'COMPLETED' ? 'DETERMINISTIC' : 'NONE',
    result: status === 'COMPLETED' ? result : null,
    ...(pending ? { pollAfterMs: 2000 } : {}),
    ...overrides,
  };
}
