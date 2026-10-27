const { isDeepStrictEqual } = require('node:util');
const { parseAnalyzeInput, schemas } = require('@ccna/shared/aiLabContract');
const { redactor, identityValues } = require('./redaction');
const { evidenceFor, commandsFor } = require('./evidence');
const { fail } = require('./quota');
const { VERSION: diagnosticVersion } = require('./diagnostics/catalog');
const bytes = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8');
// A defined tokenizer for the local fake protocol, not an estimate of any
// vendor tokenizer. Real adapters must count their complete prompt/schema.
const fakeInputTokens = (value) =>
  (JSON.stringify(value).match(/[A-Za-z0-9_]+|[^\s]/gu) || []).length;

function projectContext(row, options = {}) {
  const snapshot = row.snapshot;
  if (
    row.sourceProvenance !== 'LIVE_SNAPSHOT' ||
    !snapshot?.state ||
    snapshot.sourceRevision !== row.sourceRevision ||
    snapshot.state.revision !== row.sourceRevision
  )
    throw fail('AI_INVALID_REQUEST');
  const scrub = redactor([...identityValues(row), ...(options.secrets || [])]);
  let truncated = false;
  const text = (value, max, fallback) => {
    const result = scrub.text(value, max, fallback);
    if (typeof value === 'string' && result !== value) truncated = true;
    return result;
  };
  const identifier = (value) => {
    if (!scrub.safe(value)) throw fail('AI_INVALID_REQUEST');
    return value;
  };
  const metadata = snapshot.publicMetadata;
  if (metadata?.commandProfile !== 'ccna-network-v2') throw fail('AI_INVALID_REQUEST');
  const devices = Object.entries(snapshot.state.devices || {}).map(([deviceId, device]) => ({
    id: identifier(deviceId),
    deviceType: device.deviceType,
    hostname: text(device.hostname || deviceId, 63, deviceId),
    interfaces: Object.entries(device.interfaces || {}).map(([name, port]) => ({
      name: identifier(name),
      ipAddress: port.ipAddress ?? null,
      subnetMask: port.subnetMask ?? null,
      shutdown: port.shutdown === true,
      switchportMode: port.switchportMode ?? null,
      accessVlan: port.accessVlan ?? null,
    })),
    vlans: Object.entries(device.vlans || {}).map(([vlanId, vlan]) => ({
      vlanId: Number(vlanId),
      name: text(vlan.name, 32, `VLAN${vlanId}`),
    })),
    routes: (device.staticRoutes || []).map((route) => ({
      network: route.network,
      mask: route.mask,
      nextHop: route.nextHop ?? null,
      protocol: 'S',
    })),
  }));
  // PC gateway is already represented by its default route. Other omitted
  // network features (or an old snapshot without capability proof) must stop
  // SIM-01 from treating the public projection as complete.
  if (
    snapshot.diagnosticSupport?.version !== diagnosticVersion ||
    snapshot.diagnosticSupport?.supported !== true ||
    Object.values(snapshot.state.devices || {}).some(
      (device) =>
        (device.defaultGateway &&
          !(device.staticRoutes || []).some(
            (route) =>
              route.network === '0.0.0.0' &&
              route.mask === '0.0.0.0' &&
              route.nextHop === device.defaultGateway
          )) ||
        Object.values(device.interfaces || {}).some(
          (port) => port.allowedVlans != null || port.nativeVlan != null
        ) ||
        (device.staticRoutes || []).some(
          (route) => route.adminDistance != null && route.adminDistance !== 1
        )
    )
  )
    truncated = true;
  const progress = (metadata.tasks || []).map((task) => ({
    taskId: identifier(task.id),
    title: text(task.title, 200, task.id),
    status:
      snapshot.progress?.checks?.find((check) => check.id === task.id)?.status || 'not_started',
    // Grading hints may disclose a repair. AI-01 will define hint-level policy.
    hint: null,
  }));
  const context = schemas.InternalAnalyzeRequest.shape.context.parse({
    sourceRevision: row.sourceRevision,
    lab: {
      id: 'ccna-network-v2',
      title: text(metadata.title || 'CCNA lab', 200, 'CCNA lab'),
      objective: text(metadata.objective || 'Kiểm tra bài lab.', 4000, 'Kiểm tra bài lab.'),
      commandProfile: 'ccna-network-v2',
      simulatorVersion: row.versions.simulatorVersion,
      publicMetadataProvenance:
        snapshot.publicMetadataProvenance === 'CAPTURED_AT_ATTEMPT_START'
          ? 'ATTEMPT_SNAPSHOT'
          : snapshot.publicMetadataProvenance,
    },
    devices,
    links: (snapshot.state.links || []).map((link) => ({
      id: identifier(link.id),
      enabled: link.enabled === true,
      a: { deviceId: identifier(link.a.deviceId), interface: identifier(link.a.interface) },
      b: { deviceId: identifier(link.b.deviceId), interface: identifier(link.b.interface) },
    })),
    progress,
    recentCommands: [],
    contextTruncated: false,
  });
  const request = snapshot.request;
  const history = (options.history || [])
    .map((entry) => ({
      role: entry.role,
      text: text(
        entry.role === 'USER' ? entry.content : entry.structuredAnswer?.answer?.summary,
        1000
      ),
      sourceRevision: entry.sourceRevision ?? null,
    }))
    .filter((entry) => entry.text)
    .slice(-6);
  context.contextTruncated = truncated || (options.history || []).length > 6;
  const prepared = {
    context,
    request: {
      intent: request.intent,
      message: text(request.message, 2000, request.intent),
      selectedDeviceId: request.selectedDeviceId ? identifier(request.selectedDeviceId) : null,
      target: request.target?.deviceId
        ? { deviceId: identifier(request.target.deviceId) }
        : request.target?.ipv4
          ? { ipv4: request.target.ipv4 }
          : null,
      taskId: request.taskId ? identifier(request.taskId) : null,
    },
    facts: [],
    allowedCommands: commandsFor(context),
    history,
  };
  context.contextTruncated ||= truncated;
  prepared.facts = evidenceFor(context, prepared.request);
  if (bytes({ ...prepared, history: [] }) > 65536) throw fail('AI_CONTEXT_TOO_LARGE');
  return prepared;
}

function contextPreparer(prisma, config = {}) {
  return async (row) => {
    if (!row.userId || !row.conversationId || !row.attemptId) throw fail('AI_RESOURCE_NOT_FOUND');
    // No shared CLI transcript: LabCommand has no actor/revision ownership.
    // Query only prior completed requests in this exact private conversation.
    const history = await prisma.aiMessage.findMany({
      where: {
        conversationId: row.conversationId,
        epoch: row.conversationEpoch,
        request: {
          userId: row.userId,
          ownerKey: row.ownerKey,
          attemptId: row.attemptId,
          conversationEpoch: row.conversationEpoch,
          status: 'COMPLETED',
          id: { not: row.id },
          createdAt: { lt: row.createdAt },
        },
        conversation: {
          userId: row.userId,
          attemptId: row.attemptId,
          epoch: row.conversationEpoch,
          deletedAt: null,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 6,
      select: { role: true, content: true, structuredAnswer: true, sourceRevision: true },
    });
    return projectContext(row, { history: history.reverse(), secrets: config.redactionValues });
  };
}

function validateBoundary(value, provider) {
  if (bytes(value) > 65536) throw fail('AI_CONTEXT_TOO_LARGE');
  const input = parseAnalyzeInput(value);
  if (input.context.lab.simulatorVersion !== input.versions.simulatorVersion)
    throw fail('AI_INVALID_REQUEST');
  if (
    !isDeepStrictEqual(input.facts, evidenceFor(input.context, input.request)) ||
    !isDeepStrictEqual(input.allowedCommands, commandsFor(input.context))
  )
    throw fail('AI_INVALID_REQUEST');
  // The Python Gemini adapter counts the complete prompt/schema before CLAIM.
  // This explicit server-owned strategy avoids HTTP inside the planning lock;
  // it is not an estimated tokenizer or a value supplied by the browser.
  if (provider?.provider === 'gemini' && provider.inputBudgetOwner === 'python-preflight')
    return input;
  if (!provider || typeof provider.measureInput !== 'function') throw fail('AI_DISABLED');
  // Provider adapter owns counting its complete prompt/schema. The bundled
  // implementation is a synthetic tokenizer for the local fake protocol.
  const tokens = provider.measureInput(input);
  if (!Number.isSafeInteger(tokens) || tokens < 0) throw fail('AI_DISABLED');
  if (tokens > input.policy.maxInputTokens) throw fail('AI_CONTEXT_TOO_LARGE');
  return input;
}

function fitBoundary(value, provider) {
  // Drop only optional history, never silently omit topology or the question.
  const input = structuredClone(value);
  for (;;) {
    try {
      return validateBoundary(input, provider);
    } catch (error) {
      if (error.code !== 'AI_CONTEXT_TOO_LARGE' || !input.history.length) throw error;
      input.history.shift();
      input.context.contextTruncated = true;
      input.facts = evidenceFor(input.context, input.request);
    }
  }
}
module.exports = {
  projectContext,
  contextPreparer,
  validateBoundary,
  fitBoundary,
  bytes,
  fakeInputTokens,
};
