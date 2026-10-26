// Synthetic examples; no production identities, credentials, provider, or database calls.
const clone = (value) => JSON.parse(JSON.stringify(value));
const VERSION = '1.0.0';
const requestId = '7ea5187b-5dd0-42c7-960a-8106fcfb439d';
const callId = 'b5988e7c-ff06-4efa-9e06-8efa64166e37';
const conversationId = '9506ee20-d092-462e-888f-078338aef96e';
const now = '2026-10-19T05:00:00Z';
const versions = {
  contextSchemaVersion: VERSION,
  simulatorVersion: '2.1.0',
  diagnosticVersion: 'diagnostics-v1',
  promptVersion: 'prompt-v1',
  policyVersion: 'policy-v1',
  modelVersion: 'fake-v1',
  priceVersion: 'fake-price-v1',
  appCommit: '0'.repeat(40),
};
const create = {
  contractVersion: VERSION,
  clientRequestId: 'e1975f55-815c-4da2-ae4b-2699b2e427e6',
  intent: 'DIAGNOSE',
  message: 'Vì sao PC1 chưa ping được PC2?',
  selectedDeviceId: 'PC1',
  target: { deviceId: 'PC2' },
  requestedHintLevel: 2,
  expectedRevision: 12,
  conversationEpoch: 1,
  recoveryEpoch: 'recovery-test-v1',
};
const answer = {
  summary: 'Cổng liên quan đang bị tắt bằng cấu hình.',
  claimType: 'SUPPORTED_FINDING',
  evidenceIds: ['fact-r12-r1-g00'],
  nextSteps: [{ text: 'Kiểm tra trạng thái cổng trên R1.', commandId: 'show-r1-interfaces' }],
  verification: 'Đối chiếu trạng thái cổng rồi kiểm tra lại kết nối.',
  hintLevel: 2,
};
const evidence = {
  evidenceId: 'fact-r12-r1-g00',
  kind: 'INTERFACE',
  deviceId: 'R1',
  interface: 'GigabitEthernet0/0',
  sourceRevision: 12,
  observation: 'administratively down',
  confidenceClass: 'OBSERVED',
  scope: 'PC1-PC2',
};
const allowed = {
  commandId: 'show-r1-interfaces',
  deviceId: 'R1',
  mode: 'PRIVILEGED_EXEC',
  command: 'show ip interface brief',
};
const binding = {
  contractVersion: VERSION,
  requestId,
  callId,
  contextHash: 'a'.repeat(64),
  leaseVersion: 1,
};
const iface = (ipAddress = null) => ({
  name: 'GigabitEthernet0/0',
  ipAddress,
  subnetMask: ipAddress ? '255.255.255.0' : null,
  shutdown: true,
  switchportMode: null,
  accessVlan: null,
});
const analyze = {
  ...binding,
  deadlineAt: '2026-10-19T05:00:35Z',
  providerConfigId: 'fake-r1',
  request: {
    intent: 'DIAGNOSE',
    message: create.message,
    selectedDeviceId: 'PC1',
    target: { deviceId: 'PC2' },
    taskId: null,
  },
  policy: {
    effectiveHintLevel: 2,
    maxProviderCalls: 1,
    maxInputTokens: 6000,
    maxOutputTokens: 800,
    maxReasoningTokens: 0,
    maxCostMicros: 1000,
  },
  context: {
    sourceRevision: 12,
    lab: {
      id: 'AI-IPV4-01',
      title: 'IPv4/interface',
      objective: 'Kiểm tra kết nối PC1-PC2.',
      commandProfile: 'ccna-network-v2',
      simulatorVersion: '2.1.0',
      publicMetadataProvenance: 'ATTEMPT_SNAPSHOT',
    },
    devices: ['PC1', 'R1', 'PC2'].map((id) => ({
      id,
      deviceType: id === 'R1' ? 'ROUTER' : 'PC',
      hostname: id,
      interfaces: [iface()],
      vlans: [],
      routes: [],
    })),
    links: [],
    progress: [],
    recentCommands: [],
    contextTruncated: false,
  },
  facts: [
    {
      ...evidence,
      provenance: {
        source: 'SNAPSHOT',
        reference: 'devices.R1.interfaces.GigabitEthernet0/0.shutdown',
        version: 'context-v1',
      },
    },
  ],
  allowedCommands: [allowed],
  history: [],
  versions,
};
const receipt = {
  ...binding,
  providerRequestId: 'fake-provider-request-1',
  usage: { status: 'FINAL', inputTokens: 400, outputTokens: 100, reasoningTokens: 0 },
  versions,
  outcome: 'RECEIVED',
  output: answer,
  finishReason: 'stop',
};
const quota = { remaining: 17, reserved: 1, resetAt: '2026-10-20T00:00:00Z' };
const resource = {
  requestId,
  conversationId,
  conversationEpoch: 1,
  recoveryEpoch: 'recovery-test-v1',
  intent: 'DIAGNOSE',
  sourceRevision: 12,
  currentRevision: 13,
  stale: true,
  sourceProvenance: 'LIVE_SNAPSHOT',
  quota,
  serverTime: now,
  status: 'COMPLETED',
  responseMode: 'LLM',
  result: { messageId: callId, answer, evidence: [evidence], commands: [allowed], versions },
};
const envelope = (data) => ({ contractVersion: VERSION, data });
const schemaCases = [];
const add = (id, schema, valid, value) =>
  schemaCases.push({ id, schema, valid, value: clone(value) });
const invalid = (id, schema, source, change) => {
  const value = clone(source);
  change(value);
  add(id, schema, false, value);
};
add('create-diagnose', 'CreateRequest', true, create);
add('create-next-step', 'CreateRequest', true, {
  ...create,
  intent: 'NEXT_STEP',
  target: undefined,
});
add('create-concept', 'CreateRequest', true, {
  ...create,
  intent: 'EXPLAIN_CONCEPT',
  target: undefined,
  requestedHintLevel: undefined,
});
add('create-review', 'CreateRequest', true, {
  ...create,
  intent: 'LAB_REVIEW',
  selectedDeviceId: undefined,
  target: undefined,
  requestedHintLevel: undefined,
});
add('create-emoji-boundary', 'CreateRequest', true, { ...create, message: '🙂'.repeat(2000) });
add('create-ip-target', 'CreateRequest', true, { ...create, target: { ipv4: '192.0.2.10' } });
add('request-resource', 'RequestResource', true, resource);
add('completed-response', 'RequestResponse', true, envelope(resource));
const pending = {
  ...resource,
  status: 'QUEUED',
  responseMode: 'NONE',
  result: null,
  pollAfterMs: 2000,
};
add('queued-response', 'RequestResponse', true, envelope(pending));
add(
  'unknown-fallback',
  'RequestResponse',
  true,
  envelope({ ...resource, status: 'OUTCOME_UNKNOWN', responseMode: 'DETERMINISTIC' })
);
for (const status of ['FAILED', 'CANCELLED', 'EXPIRED', 'REVOKED', 'DELETED'])
  add(
    `terminal-${status.toLowerCase()}`,
    'RequestResponse',
    true,
    envelope({ ...resource, status, responseMode: 'NONE', result: null })
  );
add('error-quota', 'ErrorResponse', true, {
  contractVersion: VERSION,
  error: { code: 'AI_QUOTA_EXHAUSTED', message: 'Đã hết lượt hôm nay.', resetAt: quota.resetAt },
});
add('feedback', 'FeedbackRequest', true, {
  contractVersion: VERSION,
  helpful: false,
  reasonCode: 'WRONG_FACT',
  comment: 'Cổng này ngoài đường đi.',
});
add(
  'feedback-response',
  'FeedbackResponse',
  true,
  envelope({ messageId: callId, helpful: false, updatedAt: now })
);
add('quota', 'QuotaResponse', true, envelope({ quota, serverTime: now }));
add(
  'capabilities',
  'CapabilitiesResponse',
  true,
  envelope({
    eligible: true,
    conversationId,
    conversationEpoch: 1,
    recoveryEpoch: 'recovery-test-v1',
    intents: ['NEXT_STEP', 'DIAGNOSE', 'EXPLAIN_CONCEPT', 'LAB_REVIEW'],
    supportedDeviceIds: ['PC1', 'R1', 'PC2'],
    supportedTopics: ['ipv4'],
    limits: { questionCharacters: 2000, contextBytes: 65536, userConcurrent: 1 },
    serverTime: now,
  })
);
add(
  'history',
  'HistoryResponse',
  true,
  envelope({
    conversationId,
    conversationEpoch: 1,
    items: [
      { messageId: callId, requestId, role: 'USER', content: create.message, createdAt: now },
    ],
    nextCursor: null,
  })
);
add(
  'delete-conversation',
  'DeleteConversationResponse',
  true,
  envelope({ conversationId, conversationEpoch: 2, deleted: true, purgeBy: '2026-10-20T05:00:00Z' })
);
add('internal-analyze', 'InternalAnalyzeRequest', true, analyze);
add('provider-receipt', 'ProviderReceipt', true, receipt);
add('usage-unresolved', 'ProviderReceipt', true, {
  ...receipt,
  usage: { status: 'UNRESOLVED', inputTokens: null, outputTokens: null, reasoningTokens: null },
  outcome: 'OUTCOME_UNKNOWN',
  output: null,
  finishReason: 'timeout',
});
add('claim', 'ClaimRequest', true, binding);
add(
  'claim-response',
  'ClaimResponse',
  true,
  envelope({
    callId,
    contextHash: binding.contextHash,
    leaseVersion: 1,
    dispatchAuthorized: true,
    deadlineAt: analyze.deadlineAt,
  })
);
add(
  'receipt-response',
  'ReceiptResponse',
  true,
  envelope({ callId, receiptHash: 'b'.repeat(64), recorded: true })
);
add('analyze-response', 'InternalAnalyzeResponse', true, {
  contractVersion: VERSION,
  callId,
  contextHash: binding.contextHash,
  receiptHash: 'b'.repeat(64),
});
for (const operation of ['ANALYZE', 'CLAIM', 'RECEIPT'])
  add(`claims-${operation.toLowerCase()}`, 'ServiceClaims', true, {
    ...binding,
    operation,
    aud: `ai-${operation.toLowerCase()}`,
    iss: 'node-internal',
    sub: 'python-service',
    keyId: 'test-key',
    iat: 1792386000,
    exp: 1792386035,
  });
for (const key of ['userId', 'model', 'providerConfigId', 'callbackUrl', 'context', 'deviceState'])
  invalid(`reject-client-${key}`, 'CreateRequest', create, (value) => {
    value[key] = 'untrusted';
  });
invalid('unknown-contract-version', 'CreateRequest', create, (v) => {
  v.contractVersion = '2.0.0';
});
invalid('invalid-client-uuid', 'CreateRequest', create, (v) => {
  v.clientRequestId = 'request-1';
});
invalid('negative-revision', 'CreateRequest', create, (v) => {
  v.expectedRevision = -1;
});
invalid('hint-escalation-range', 'CreateRequest', create, (v) => {
  v.requestedHintLevel = 4;
});
invalid('missing-diagnosis-source', 'CreateRequest', create, (v) => {
  delete v.selectedDeviceId;
});
invalid('missing-diagnosis-target', 'CreateRequest', create, (v) => {
  delete v.target;
});
invalid('ambiguous-target', 'CreateRequest', create, (v) => {
  v.target.ipv4 = '192.0.2.10';
});
invalid('arbitrary-url-target', 'CreateRequest', create, (v) => {
  v.target = { url: 'https://example.invalid' };
});
invalid('invalid-ip-target', 'CreateRequest', create, (v) => {
  v.target = { ipv4: '999.0.0.1' };
});
invalid('empty-question', 'CreateRequest', create, (v) => {
  v.message = '';
});
invalid('long-unicode-question', 'CreateRequest', create, (v) => {
  v.message = '🙂'.repeat(2001);
});
invalid('unsafe-device-id', 'CreateRequest', create, (v) => {
  v.selectedDeviceId = 'constructor';
});
invalid('legacy-message-error', 'ErrorResponse', {}, (v) => {
  v.message = 'legacy';
});
invalid(
  'error-stack-leak',
  'ErrorResponse',
  schemaCases.find((c) => c.id === 'error-quota').value,
  (v) => {
    v.error.stack = 'private';
  }
);
invalid(
  'unknown-error-code',
  'ErrorResponse',
  schemaCases.find((c) => c.id === 'error-quota').value,
  (v) => {
    v.error.code = 'PROVIDER_KEY';
  }
);
invalid('pending-answer', 'RequestResponse', envelope(pending), (v) => {
  v.data.result = resource.result;
});
invalid('completed-no-answer', 'RequestResponse', envelope(resource), (v) => {
  v.data.result = null;
});
invalid('cancelled-resurrection', 'RequestResponse', envelope(resource), (v) => {
  v.data.status = 'CANCELLED';
});
invalid('unknown-must-not-use-llm', 'RequestResponse', envelope(resource), (v) => {
  v.data.status = 'OUTCOME_UNKNOWN';
});
invalid('legacy-feedback-not-llm', 'RequestResponse', envelope(resource), (v) => {
  v.data.sourceRevision = null;
});
invalid('negative-quota', 'QuotaResponse', envelope({ quota, serverTime: now }), (v) => {
  v.data.quota.remaining = -1;
});
invalid(
  'history-too-many-items',
  'HistoryResponse',
  schemaCases.find((c) => c.id === 'history').value,
  (v) => {
    v.data.items = Array(51).fill(v.data.items[0]);
  }
);
invalid(
  'feedback-owner-spoof',
  'FeedbackRequest',
  schemaCases.find((c) => c.id === 'feedback').value,
  (v) => {
    v.userId = 5;
  }
);
invalid('hidden-rubric-context', 'InternalAnalyzeRequest', analyze, (v) => {
  v.context.gradingSpec = { expected: 'CANARY' };
});
invalid('actor-context', 'InternalAnalyzeRequest', analyze, (v) => {
  v.context.devices[0].actorId = 5;
});
invalid('provider-secret-input', 'InternalAnalyzeRequest', analyze, (v) => {
  v.apiKey = 'CANARY';
});
invalid('unbounded-agent-r1', 'InternalAnalyzeRequest', analyze, (v) => {
  v.policy.maxProviderCalls = 3;
});
invalid('too-many-history-messages', 'InternalAnalyzeRequest', analyze, (v) => {
  v.history = Array(7).fill({ role: 'USER', text: 'x', sourceRevision: 1 });
});
invalid('invalid-context-mask', 'InternalAnalyzeRequest', analyze, (v) => {
  v.context.devices[0].interfaces[0].subnetMask = '255.0.255.0';
});
invalid('diagnose-null-target-internal', 'InternalAnalyzeRequest', analyze, (v) => {
  v.request.target = null;
});
invalid('usage-final-missing-count', 'ProviderReceipt', receipt, (v) => {
  v.usage.inputTokens = null;
});
invalid('usage-no-status', 'ProviderReceipt', receipt, (v) => {
  delete v.usage.status;
});
invalid('negative-tokens', 'ProviderReceipt', receipt, (v) => {
  v.usage.outputTokens = -1;
});
invalid('fake-evidence-object', 'ProviderReceipt', receipt, (v) => {
  v.output.evidence = [{ observation: 'made up' }];
});
invalid('raw-command-in-model-output', 'ProviderReceipt', receipt, (v) => {
  v.output.nextSteps[0].command = 'write erase';
});
invalid('receipt-hidden-answer-field', 'ProviderReceipt', receipt, (v) => {
  v.output.expected = 'CANARY';
});
invalid(
  'claims-audience-mismatch',
  'ServiceClaims',
  schemaCases.find((c) => c.id === 'claims-claim').value,
  (v) => {
    v.aud = 'ai-receipt';
  }
);
invalid(
  'claims-no-fence',
  'ServiceClaims',
  schemaCases.find((c) => c.id === 'claims-claim').value,
  (v) => {
    delete v.leaseVersion;
  }
);

const bindingCases = [];
const bind = (id, changeInput, changeReceipt) => {
  const input = clone(analyze);
  const output = clone(receipt);
  if (changeInput) changeInput(input);
  if (changeReceipt) changeReceipt(output);
  bindingCases.push({ id, input, receipt: output });
};
bind('unknown-evidence', null, (v) => {
  v.output.evidenceIds = ['invented-fact'];
});
bind('answer-total-character-cap', null, (v) => {
  v.output.summary = 'x'.repeat(6000);
});
bind('unknown-command', null, (v) => {
  v.output.nextSteps[0].commandId = 'run-arbitrary-command';
});
bind('wrong-context-hash', null, (v) => {
  v.contextHash = 'c'.repeat(64);
});
bind('old-worker-fence', null, (v) => {
  v.leaseVersion = 2;
});
bind('wrong-call-id', null, (v) => {
  v.callId = requestId;
});
bind('hint-level-policy', null, (v) => {
  v.output.hintLevel = 3;
});
bind('unknown-receipt-with-answer', null, (v) => {
  v.outcome = 'OUTCOME_UNKNOWN';
});
bind('received-without-answer', null, (v) => {
  v.output = null;
});
bind('finding-without-evidence', null, (v) => {
  v.output.evidenceIds = [];
});
bind('wrong-revision-evidence', (v) => {
  v.facts[0].sourceRevision = 11;
});
bind('unknown-device-evidence', (v) => {
  v.facts[0].deviceId = 'R99';
});
bind('unknown-device-command', (v) => {
  v.allowedCommands[0].deviceId = 'R99';
});
bind('unknown-target-device', (v) => {
  v.request.target.deviceId = 'R99';
});
bind('duplicate-evidence', (v) => {
  v.facts.push(clone(v.facts[0]));
});
bind('different-price-version', null, (v) => {
  v.versions.priceVersion = 'fake-price-v2';
});
module.exports = {
  buildCases: () => ({ contractVersion: VERSION, schemaCases, bindingCases }),
  examples: { create, analyze, receipt, resource },
};
