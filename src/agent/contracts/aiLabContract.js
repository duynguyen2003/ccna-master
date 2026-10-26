// One schema source for the browser/Node validators and generated Python JSON Schema.
const { z } = typeof window !== 'undefined' ? require('./zodBrowser.mjs') : require('zod');
const VERSION = '1.0.0';
const strict = (shape) => z.object(shape).strict();
const text = (max, min = 1) => z.string().regex(new RegExp(`^[\\s\\S]{${min},${max}}$`, 'u'));
const id = z.string().regex(/^(?!(?:constructor|prototype)$)[A-Za-z][A-Za-z0-9_-]{0,79}$/);
const uuid = z.uuid();
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const timestamp = z.iso.datetime({ offset: true });
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const ipv4 = z
  .string()
  .regex(
    /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])$/
  );
const interfaceName = z
  .string()
  .regex(/^(?:(?:GigabitEthernet|FastEthernet)[0-9]+\/[0-9]+|Loopback[0-9]+)$/);
const subnetMask = z.enum(
  Array.from({ length: 33 }, (_, bits) =>
    [24, 16, 8, 0]
      .map((shift) => ((bits === 0 ? 0 : 0xffffffff << (32 - bits)) >>> shift) & 255)
      .join('.')
  )
);
const intent = z.enum(['NEXT_STEP', 'DIAGNOSE', 'EXPLAIN_CONCEPT', 'LAB_REVIEW']);
const hintLevel = z.number().int().min(1).max(3);
const target = z.union([strict({ deviceId: id }), strict({ ipv4 })]);
const commonRequest = {
  contractVersion: z.literal(VERSION),
  clientRequestId: uuid,
  expectedRevision: integer,
  conversationEpoch: integer,
  recoveryEpoch: id,
};
const optionalQuestion = { message: text(2000).nullable().optional() };
const optionalTask = { taskId: id.nullable().optional() };
const optionalHint = { requestedHintLevel: hintLevel.nullable().optional() };
const optionalDevice = { selectedDeviceId: id.nullable().optional() };
const CreateRequest = z.discriminatedUnion('intent', [
  strict({
    ...commonRequest,
    intent: z.literal('NEXT_STEP'),
    ...optionalQuestion,
    ...optionalTask,
    ...optionalHint,
    ...optionalDevice,
  }),
  strict({
    ...commonRequest,
    intent: z.literal('DIAGNOSE'),
    ...optionalQuestion,
    ...optionalTask,
    ...optionalHint,
    selectedDeviceId: id,
    target,
  }),
  strict({
    ...commonRequest,
    intent: z.literal('EXPLAIN_CONCEPT'),
    message: text(2000),
    ...optionalDevice,
  }),
  strict({ ...commonRequest, intent: z.literal('LAB_REVIEW'), ...optionalQuestion }),
]);
const answer = strict({
  summary: text(6000),
  claimType: z.enum([
    'SUPPORTED_FINDING',
    'HYPOTHESIS',
    'NO_ISSUE_OBSERVED',
    'INSUFFICIENT_CONTEXT',
    'UNSUPPORTED',
  ]),
  evidenceIds: z.array(id).max(20),
  nextSteps: z.array(strict({ text: text(1000), commandId: id.optional() })).max(2),
  verification: text(1000),
  hintLevel,
});
const publicEvidence = strict({
  evidenceId: id,
  kind: z.enum(['INTERFACE', 'ROUTE', 'VLAN', 'LINK', 'TRACE', 'PUBLIC_TASK']),
  deviceId: id.optional(),
  interface: interfaceName.optional(),
  sourceRevision: integer,
  observation: text(1000),
  confidenceClass: z.enum(['OBSERVED', 'INFERRED']),
  scope: text(200),
});
const fact = publicEvidence
  .extend({
    provenance: strict({
      source: z.enum(['SNAPSHOT', 'DIAGNOSTIC', 'TOOL']),
      reference: text(200),
      version: text(80),
    }),
  })
  .strict();
const allowedCommand = strict({
  commandId: id,
  deviceId: id,
  mode: z.enum([
    'USER_EXEC',
    'PRIVILEGED_EXEC',
    'GLOBAL_CONFIG',
    'INTERFACE_CONFIG',
    'VLAN_CONFIG',
  ]),
  command: text(500),
});
const versions = strict({
  contextSchemaVersion: z.literal(VERSION),
  simulatorVersion: text(40),
  diagnosticVersion: text(80),
  promptVersion: text(80),
  policyVersion: text(80),
  modelVersion: text(120),
  priceVersion: text(80),
  appCommit: z.string().regex(/^[a-f0-9]{40}$/),
});
const result = strict({
  messageId: uuid,
  answer,
  evidence: z.array(publicEvidence).max(20),
  commands: z.array(allowedCommand).max(2),
  versions,
});
const quota = strict({ remaining: integer, reserved: integer, resetAt: timestamp });
const resourceBase = {
  requestId: uuid,
  conversationId: uuid,
  conversationEpoch: integer,
  recoveryEpoch: id,
  intent,
  sourceRevision: integer.nullable(),
  currentRevision: integer,
  stale: z.boolean().nullable(),
  sourceProvenance: z.enum(['LIVE_SNAPSHOT', 'FEEDBACK_SNAPSHOT', 'LEGACY_FEEDBACK']),
  quota,
  serverTime: timestamp,
};
const noResult = { responseMode: z.literal('NONE'), result: z.null() };
const RequestResource = z.union([
  strict({
    ...resourceBase,
    status: z.enum(['QUEUED', 'RUNNING']),
    ...noResult,
    pollAfterMs: z.number().int().min(2000).max(30000),
  }),
  strict({
    ...resourceBase,
    status: z.literal('COMPLETED'),
    sourceRevision: integer,
    responseMode: z.literal('LLM'),
    result,
  }),
  strict({
    ...resourceBase,
    status: z.literal('COMPLETED'),
    responseMode: z.literal('DETERMINISTIC'),
    result,
  }),
  strict({
    ...resourceBase,
    status: z.enum(['FAILED', 'CANCELLED', 'EXPIRED', 'REVOKED', 'DELETED']),
    ...noResult,
  }),
  strict({ ...resourceBase, status: z.literal('OUTCOME_UNKNOWN'), ...noResult }),
  strict({
    ...resourceBase,
    status: z.literal('OUTCOME_UNKNOWN'),
    responseMode: z.literal('DETERMINISTIC'),
    result,
  }),
]);
const envelope = (data) => strict({ contractVersion: z.literal(VERSION), data });
const ErrorStatuses = Object.freeze({
  AI_INTERNAL_ERROR: 500,
  AI_INVALID_REQUEST: 400,
  UNAUTHORIZED: 401,
  AI_NOT_ELIGIBLE: 403,
  AI_RESOURCE_NOT_FOUND: 404,
  AI_STALE_CONTEXT: 409,
  AI_IDEMPOTENCY_CONFLICT: 409,
  AI_CONVERSATION_CHANGED: 409,
  AI_RECOVERY_RECONFIRM: 409,
  AI_DISPATCH_ALREADY_CLAIMED: 409,
  AI_RECEIPT_CONFLICT: 409,
  AI_LEASE_LOST: 409,
  AI_CONTEXT_TOO_LARGE: 413,
  AI_USER_RATE_LIMITED: 429,
  AI_QUOTA_EXHAUSTED: 429,
  AI_CONCURRENT_LIMIT: 429,
  AI_CAPACITY_EXHAUSTED: 503,
  AI_DISABLED: 503,
  AI_BUDGET_PAUSED: 503,
});
const ErrorResponse = strict({
  contractVersion: z.literal(VERSION),
  error: strict({
    code: z.enum(Object.keys(ErrorStatuses)),
    message: text(1000),
    requestId: uuid.optional(),
    retryAfterSeconds: integer.optional(),
    resetAt: timestamp.optional(),
  }),
});
const Message = z.union([
  strict({
    messageId: uuid,
    requestId: uuid,
    role: z.literal('USER'),
    content: text(2000),
    createdAt: timestamp,
  }),
  strict({
    messageId: uuid,
    requestId: uuid,
    role: z.literal('ASSISTANT'),
    responseMode: z.enum(['LLM', 'DETERMINISTIC']),
    sourceRevision: integer.nullable(),
    result,
    createdAt: timestamp,
  }),
]);
const FeedbackRequest = strict({
  contractVersion: z.literal(VERSION),
  helpful: z.boolean(),
  reasonCode: z
    .enum([
      'WRONG_FACT',
      'WRONG_DEVICE',
      'UNSUPPORTED_COMMAND',
      'TOO_MUCH_SOLUTION',
      'TOO_VAGUE',
      'STALE',
      'SLOW',
      'OTHER',
    ])
    .nullable(),
  comment: text(1000).nullable().optional(),
});
const port = strict({
  name: interfaceName,
  ipAddress: ipv4.nullable(),
  subnetMask: subnetMask.nullable(),
  shutdown: z.boolean(),
  switchportMode: z.enum(['access', 'trunk']).nullable(),
  accessVlan: z.number().int().min(1).max(4094).nullable(),
});
const endpoint = strict({ deviceId: id, interface: interfaceName });
const context = strict({
  sourceRevision: integer,
  lab: strict({
    id: text(120),
    title: text(200),
    objective: text(4000),
    commandProfile: z.literal('ccna-network-v2'),
    simulatorVersion: text(40),
    publicMetadataProvenance: z.enum([
      'ATTEMPT_SNAPSHOT',
      'CAPTURED_AT_AI_REQUEST',
      'FEEDBACK_SNAPSHOT',
    ]),
  }),
  devices: z
    .array(
      strict({
        id,
        deviceType: z.enum(['ROUTER', 'SWITCH', 'PC']),
        hostname: text(63),
        interfaces: z.array(port).min(1).max(24),
        vlans: z
          .array(strict({ vlanId: z.number().int().min(1).max(4094), name: text(32) }))
          .max(64),
        routes: z
          .array(
            strict({
              network: ipv4,
              mask: subnetMask,
              nextHop: ipv4.nullable(),
              protocol: z.enum(['C', 'S', 'O', 'D']),
            })
          )
          .max(128),
      })
    )
    .min(1)
    .max(24),
  links: z.array(strict({ id, a: endpoint, b: endpoint, enabled: z.boolean() })).max(96),
  progress: z
    .array(
      strict({
        taskId: id,
        title: text(200),
        status: z.enum(['completed', 'in_progress', 'not_started']),
        hint: text(500).nullable(),
      })
    )
    .max(64),
  recentCommands: z
    .array(
      strict({ deviceId: id, command: text(500), output: text(2000), sourceRevision: integer })
    )
    .max(12),
  contextTruncated: z.boolean(),
});
const binding = {
  contractVersion: z.literal(VERSION),
  requestId: uuid,
  callId: uuid,
  contextHash: hash,
  leaseVersion: integer.min(1),
};
const internalRequestBase = {
  message: text(2000),
  selectedDeviceId: id.nullable(),
  target: z.null(),
  taskId: id.nullable(),
};
const InternalAnalyzeRequest = strict({
  ...binding,
  deadlineAt: timestamp,
  providerConfigId: id,
  context,
  request: z.discriminatedUnion('intent', [
    strict({ ...internalRequestBase, intent: z.literal('NEXT_STEP') }),
    strict({ ...internalRequestBase, intent: z.literal('DIAGNOSE'), selectedDeviceId: id, target }),
    strict({ ...internalRequestBase, intent: z.literal('EXPLAIN_CONCEPT') }),
    strict({ ...internalRequestBase, intent: z.literal('LAB_REVIEW') }),
  ]),
  policy: strict({
    effectiveHintLevel: hintLevel,
    maxProviderCalls: z.literal(1),
    maxInputTokens: z.number().int().min(1).max(6000),
    maxOutputTokens: z.number().int().min(1).max(800),
    maxReasoningTokens: integer,
    maxCostMicros: integer,
  }),
  facts: z.array(fact).max(64),
  allowedCommands: z.array(allowedCommand).max(32),
  history: z
    .array(
      strict({
        role: z.enum(['USER', 'ASSISTANT']),
        text: text(6000),
        sourceRevision: integer.nullable(),
      })
    )
    .max(6),
  versions,
});
const usage = z.discriminatedUnion('status', [
  strict({
    status: z.literal('FINAL'),
    inputTokens: integer,
    outputTokens: integer,
    reasoningTokens: integer,
  }),
  strict({
    status: z.literal('UNRESOLVED'),
    inputTokens: integer.nullable(),
    outputTokens: integer.nullable(),
    reasoningTokens: integer.nullable(),
  }),
]);
const receiptBase = {
  ...binding,
  providerRequestId: text(200).nullable(),
  usage,
  versions,
  finishReason: text(80),
};
const ProviderReceipt = z.discriminatedUnion('outcome', [
  strict({ ...receiptBase, outcome: z.literal('RECEIVED'), output: answer }),
  strict({ ...receiptBase, outcome: z.literal('KNOWN_FAILURE'), output: z.null() }),
  strict({ ...receiptBase, outcome: z.literal('OUTCOME_UNKNOWN'), output: z.null() }),
]);
const ClaimRequest = strict(binding);
const ServiceClaims = z.union(
  ['ANALYZE', 'CLAIM', 'RECEIPT'].map((operation) =>
    strict({
      ...binding,
      operation: z.literal(operation),
      aud: z.literal(`ai-${operation.toLowerCase()}`),
      iss: id,
      sub: id,
      keyId: id,
      iat: integer,
      exp: integer,
    })
  )
);

const schemas = Object.freeze({
  CreateRequest,
  RequestResource,
  RequestResponse: envelope(RequestResource),
  ErrorResponse,
  FeedbackRequest,
  FeedbackResponse: envelope(
    strict({ messageId: uuid, helpful: z.boolean(), updatedAt: timestamp })
  ),
  QuotaResponse: envelope(strict({ quota, serverTime: timestamp })),
  CapabilitiesResponse: envelope(
    strict({
      eligible: z.boolean(),
      conversationId: uuid.nullable(),
      conversationEpoch: integer,
      recoveryEpoch: id,
      intents: z.array(intent).max(4),
      supportedDeviceIds: z.array(id).max(24),
      supportedTopics: z.array(id).max(64),
      limits: strict({
        questionCharacters: z.literal(2000),
        contextBytes: z.literal(65536),
        userConcurrent: z.literal(1),
      }),
      serverTime: timestamp,
    })
  ),
  HistoryResponse: envelope(
    strict({
      conversationId: uuid,
      conversationEpoch: integer,
      items: z.array(Message).max(50),
      nextCursor: text(1000).nullable(),
    })
  ),
  DeleteConversationResponse: envelope(
    strict({
      conversationId: uuid,
      conversationEpoch: integer,
      deleted: z.literal(true),
      purgeBy: timestamp,
    })
  ),
  InternalAnalyzeRequest,
  ProviderReceipt,
  ClaimRequest,
  ServiceClaims,
  ClaimResponse: envelope(
    strict({
      callId: uuid,
      contextHash: hash,
      leaseVersion: integer,
      dispatchAuthorized: z.literal(true),
      deadlineAt: timestamp,
    })
  ),
  ReceiptResponse: envelope(strict({ callId: uuid, receiptHash: hash, recorded: z.literal(true) })),
  InternalAnalyzeResponse: strict({
    contractVersion: z.literal(VERSION),
    callId: uuid,
    contextHash: hash,
    receiptHash: hash,
  }),
});

const RequestTransitions = Object.freeze({
  QUEUED: ['RUNNING', 'CANCELLED', 'EXPIRED', 'REVOKED', 'DELETED'],
  RUNNING: ['QUEUED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REVOKED', 'OUTCOME_UNKNOWN', 'DELETED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
  REVOKED: [],
  OUTCOME_UNKNOWN: [],
  DELETED: [],
});
const ProviderTransitions = Object.freeze({
  PLANNED: ['DISPATCHED', 'KNOWN_FAILURE'],
  DISPATCHED: ['RECEIVED', 'KNOWN_FAILURE', 'OUTCOME_UNKNOWN'],
  OUTCOME_UNKNOWN: ['RECEIVED', 'KNOWN_FAILURE'],
  RECEIVED: [],
  KNOWN_FAILURE: [],
});
for (const transitions of [
  ...Object.values(RequestTransitions),
  ...Object.values(ProviderTransitions),
])
  Object.freeze(transitions);
const canTransitionRequest = (from, to, guard = {}) => {
  if (!RequestTransitions[from]?.includes(to)) return false;
  if (from === 'RUNNING' && to === 'QUEUED')
    return (
      guard.leaseExpired === true &&
      guard.deadlineRemaining === true &&
      (guard.callState === null || guard.callState === 'PLANNED')
    );
  return true;
};
const sortKeys = (value) => {
  if (typeof value === 'string') return value.normalize('NFC').replace(/\r\n?/g, '\n');
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== null)
        .map((key) => [key, sortKeys(value[key])])
    );
  return value;
};
const canonicalAdmissionPayload = (attemptId, body) => {
  uuid.parse(attemptId);
  const parsed = CreateRequest.parse(body);
  const { clientRequestId, ...payload } = parsed;
  return JSON.stringify(sortKeys({ attemptId, ...payload }));
};
const parseAnalyzeInput = (inputValue) => {
  const input = InternalAnalyzeRequest.parse(inputValue);
  const fail = (message) => {
    throw new Error(`AI contract binding: ${message}`);
  };
  const devices = new Map(input.context.devices.map((device) => [device.id, device]));
  if (devices.size !== input.context.devices.length) fail('duplicate device');
  const deviceExists = (deviceId, name) => {
    const device = devices.get(deviceId);
    if (!device || (name && !device.interfaces.some((port) => port.name === name)))
      fail('unknown device/interface');
  };
  for (const device of devices.values()) {
    if (new Set(device.interfaces.map((port) => port.name)).size !== device.interfaces.length)
      fail('duplicate interface');
    for (const port of device.interfaces)
      if ((port.ipAddress === null) !== (port.subnetMask === null)) fail('IP/mask pair');
  }
  for (const link of input.context.links) {
    deviceExists(link.a.deviceId, link.a.interface);
    deviceExists(link.b.deviceId, link.b.interface);
  }
  if (input.request.selectedDeviceId) deviceExists(input.request.selectedDeviceId);
  if (input.request.target?.deviceId) deviceExists(input.request.target.deviceId);
  if (
    input.request.taskId &&
    !input.context.progress.some((task) => task.taskId === input.request.taskId)
  )
    fail('unknown task');
  if (new Set(input.facts.map((entry) => entry.evidenceId)).size !== input.facts.length)
    fail('duplicate evidence');
  for (const entry of input.facts) {
    if (entry.sourceRevision !== input.context.sourceRevision) fail('evidence revision');
    if (entry.deviceId) deviceExists(entry.deviceId, entry.interface);
    else if (entry.interface) fail('interface without device');
  }
  if (
    new Set(input.allowedCommands.map((entry) => entry.commandId)).size !==
    input.allowedCommands.length
  )
    fail('duplicate command');
  for (const entry of input.allowedCommands) deviceExists(entry.deviceId);
  for (const entry of input.context.recentCommands) deviceExists(entry.deviceId);
  if (new TextEncoder().encode(JSON.stringify(input)).length > 65536) fail('context bytes');
  return input;
};
const assertBindings = (inputValue, receiptValue) => {
  const input = parseAnalyzeInput(inputValue);
  const receipt = ProviderReceipt.parse(receiptValue);
  const fail = (message) => {
    throw new Error(`AI contract binding: ${message}`);
  };
  for (const key of ['requestId', 'callId', 'contextHash', 'leaseVersion'])
    if (input[key] !== receipt[key]) fail(key);
  if (JSON.stringify(input.versions) !== JSON.stringify(receipt.versions)) fail('versions');
  if (receipt.outcome !== 'RECEIVED' && receipt.output !== null)
    fail('no answer for failed/unknown outcome');
  if (receipt.outcome === 'RECEIVED' && receipt.output === null)
    fail('received outcome requires output');
  if (receipt.output) {
    const answerCharacters = [
      receipt.output.summary,
      receipt.output.verification,
      ...receipt.output.nextSteps.map((step) => step.text),
    ].reduce((sum, value) => sum + [...value].length, 0);
    if (answerCharacters > 6000) fail('total answer characters');
    if (receipt.output.hintLevel > input.policy.effectiveHintLevel) fail('hint escalation');
    const ids = new Set(input.facts.map((entry) => entry.evidenceId));
    if (ids.size !== input.facts.length) fail('duplicate evidence');
    if (input.facts.some((entry) => entry.sourceRevision !== input.context.sourceRevision))
      fail('evidence revision');
    for (const reference of receipt.output.evidenceIds)
      if (!ids.has(reference)) fail('unknown evidence');
    if (receipt.output.claimType === 'SUPPORTED_FINDING' && !receipt.output.evidenceIds.length)
      fail('finding without evidence');
    const commands = new Set(input.allowedCommands.map((entry) => entry.commandId));
    for (const step of receipt.output.nextSteps)
      if (step.commandId && !commands.has(step.commandId)) fail('unknown command');
  }
  return receipt;
};
const parseRequestResource = (value) => {
  const parsed = RequestResource.parse(value);
  const expectedStale =
    parsed.sourceRevision === null ? null : parsed.sourceRevision !== parsed.currentRevision;
  if (parsed.stale !== expectedStale) throw new Error('AI contract binding: stale revision');
  if ((parsed.sourceRevision === null) !== (parsed.sourceProvenance === 'LEGACY_FEEDBACK'))
    throw new Error('AI contract binding: legacy provenance');
  if (parsed.result) {
    const facts = new Set(parsed.result.evidence.map((entry) => entry.evidenceId));
    if (parsed.result.evidence.some((entry) => entry.sourceRevision !== parsed.sourceRevision))
      throw new Error('AI contract binding: result evidence revision');
    if (parsed.result.answer.evidenceIds.some((id) => !facts.has(id)))
      throw new Error('AI contract binding: unresolved public evidence');
    const commands = new Set(parsed.result.commands.map((entry) => entry.commandId));
    if (
      parsed.result.answer.nextSteps.some((step) => step.commandId && !commands.has(step.commandId))
    )
      throw new Error('AI contract binding: unresolved public command');
  }
  return parsed;
};

const createSchemaDocuments = () =>
  Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => [
      name,
      { ...z.toJSONSchema(schema, { target: 'draft-7' }), $id: `urn:ccna:ai-lab:v1:${name}` },
    ])
  );

module.exports = {
  VERSION,
  schemas,
  ErrorStatuses,
  RequestTransitions,
  ProviderTransitions,
  canTransitionRequest,
  canonicalAdmissionPayload,
  parseAnalyzeInput,
  assertBindings,
  parseRequestResource,
  createSchemaDocuments,
};
