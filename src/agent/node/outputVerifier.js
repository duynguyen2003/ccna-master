const { assertBindings } = require('@ccna/shared/aiLabContract');
const { isDeepStrictEqual } = require('node:util');
const { evidenceFor, commandsFor } = require('./evidence');
const { redactor, identityValues } = require('./redaction');
const { parseCommand } = require('@ccna/shared/simulation/cliParser');
const { diagnosticAnswer } = require('./diagnostics');

// Free text must not smuggle commands that bypass the commandId catalog.
const unsafeProse =
  /`|<\/?[A-Za-z][^>]*>|\b(?:https?:\/\/|javascript:|data:)|\b(?:show\s+(?:ip|vlan|interfaces|running|startup)|conf(?:igure)?\s+(?:t|terminal)|ip\s+(?:route|address)|enable\s+(?:secret|password)|copy\s+running|no\s+shutdown)\b|(?:^|[\n;])\s*(?:enable|disable|end|exit|hostname\s+\S+|interface\s+\S+|vlan\s+\d+|router\s+\S+|shutdown)\s*$/im;
function hasCommand(text) {
  for (const line of text.split(/[\n;]/)) {
    const candidate = line.trim().replace(/^(?:[-*>]\s*|[\w()-]+[>#]\s*)+/, '');
    for (const mode of [
      'USER_EXEC',
      'PRIVILEGED_EXEC',
      'GLOBAL_CONFIG',
      'INTERFACE_CONFIG',
      'VLAN_CONFIG',
      'ROUTER_CONFIG',
    ])
      for (const deviceType of ['ROUTER', 'SWITCH', 'PC'])
        if (
          parseCommand(
            'ccna-network-v2',
            { mode, deviceType, simulatorVersion: '3.0.0', context: { routingProtocol: 'eigrp' } },
            candidate
          ).kind === 'command'
        )
          return true;
  }
  return false;
}
function verifyOutput(input, value, options = {}) {
  const receipt = assertBindings(input, value);
  if (
    !isDeepStrictEqual(input.facts, evidenceFor(input.context, input.request)) ||
    !isDeepStrictEqual(input.allowedCommands, commandsFor(input.context, input.request))
  )
    throw new Error('AI_UNTRUSTED_EVIDENCE_OR_COMMAND');
  if (!receipt.output) return true;
  const output = receipt.output;
  const focus = input.context.taskFocus;
  if (focus && input.request.intent === 'NEXT_STEP') {
    if (
      output.hintLevel !== focus.hintLevel ||
      (focus.hintLevel === 1 && output.nextSteps.some((step) => step.commandId))
    )
      throw new Error('AI_HINT_LEVEL_MISMATCH');
    const prose = [
      output.summary,
      output.verification,
      ...output.nextSteps.map((step) => step.text),
    ].join(' ');
    // Device IDs in prose are also scoped; a valid commandId alone cannot
    // legitimize instructions about a different router.
    for (const device of input.context.devices) {
      const escaped = device.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const mention = new RegExp(`(^|[^\\w-])${escaped}(?=$|[^\\w-])`, 'i');
      if (device.id === focus.deviceId || mention.test(focus.title)) continue;
      if (mention.test(prose)) throw new Error('AI_TASK_DEVICE_MISMATCH');
    }
    if (
      focus.type === 'eigrp_as_configured' &&
      /\b(?:delay|metric|bandwidth|passive)\b/i.test(prose)
    )
      throw new Error('AI_TASK_TOPIC_MISMATCH');
  }
  const scrub = redactor([...identityValues(options.row), ...(options.secrets || [])]);
  for (const text of [
    output.summary,
    output.verification,
    ...output.nextSteps.map((step) => step.text),
  ])
    if (!scrub.safe(text) || unsafeProse.test(text) || hasCommand(text))
      throw new Error('AI_UNSAFE_OUTPUT');
  if (new Set(output.evidenceIds).size !== output.evidenceIds.length)
    throw new Error('AI_DUPLICATE_EVIDENCE');
  // Strong claims must match a Node-computed scoped diagnostic template or an
  // exact snapshot observation. Referencing real IDs alone is not sufficient.
  const diagnostic = diagnosticAnswer(input);
  const matchesDiagnostic =
    diagnostic &&
    output.summary === diagnostic.summary &&
    output.claimType === diagnostic.claimType &&
    isDeepStrictEqual([...output.evidenceIds].sort(), [...diagnostic.evidenceIds].sort());
  if (
    (output.claimType === 'NO_ISSUE_OBSERVED' && !matchesDiagnostic) ||
    (output.claimType === 'SUPPORTED_FINDING' &&
      !matchesDiagnostic &&
      (input.request.intent === 'DIAGNOSE' ||
        !input.facts.some(
          (fact) =>
            fact.provenance.source === 'SNAPSHOT' &&
            output.evidenceIds.length === 1 &&
            fact.evidenceId === output.evidenceIds[0] &&
            fact.observation === output.summary
        )))
  )
    throw new Error('AI_UNSUPPORTED_FINDING');
  return true;
}
module.exports = { verifyOutput };
