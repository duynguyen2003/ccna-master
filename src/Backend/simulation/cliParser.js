const commandProfile = require('./commandProfiles/ccna-basic.json');

const advancedProfile = require('./advancedProfile');
const PROFILES = new Map([
  [commandProfile.id, commandProfile],
  [advancedProfile.id, advancedProfile],
]);

const tokenize = (input) => {
  const tokens = [];
  const matcher = /\S+/g;
  let match;
  while ((match = matcher.exec(input)) !== null) {
    tokens.push({ value: match[0], lower: match[0].toLowerCase(), position: match.index });
  }
  return tokens;
};

const getProfile = (profileId = 'ccna-basic-v1') => {
  const profile = PROFILES.get(profileId);
  if (!profile) throw new Error(`Unsupported command profile: ${profileId}`);
  return profile;
};

const getModeCommands = (profile, mode, deviceType) =>
  profile.commands.filter(
    (command) =>
      command.modes.includes(mode) &&
      (!command.deviceTypes || command.deviceTypes.includes(deviceType))
  );

const validateParameter = (spec, value) => {
  if (spec.type === 'integer')
    return /^\d+$/.test(value) && Number(value) <= 65535 ? null : 'Invalid integer (0-65535)';
  if (spec.type === 'word')
    return /^[a-zA-Z0-9_-]{1,64}$/.test(value) &&
      !['constructor', 'prototype', '__proto__'].includes(value)
      ? null
      : 'Invalid name';
  if (spec.type === 'hostname') {
    return /^[a-zA-Z][a-zA-Z0-9-]{0,62}$/.test(value) ? null : 'Invalid hostname';
  }
  if (spec.type === 'ipv4' || spec.type === 'subnetMask') {
    const parts = value.split('.');
    const isIp =
      parts.length === 4 && parts.every((part) => /^\d+$/.test(part) && Number(part) <= 255);
    if (!isIp) return 'Invalid IP address';
    if (spec.type === 'subnetMask') {
      const bits = parts
        .map(Number)
        .map((part) => part.toString(2).padStart(8, '0'))
        .join('');
      if (bits.includes('01')) return 'Invalid subnet mask';
    }
    return null;
  }
  if (spec.type === 'vlanId') {
    const vlanId = Number(value);
    return Number.isInteger(vlanId) && vlanId >= 1 && vlanId <= 4094
      ? null
      : 'Invalid VLAN ID (valid range is 1-4094)';
  }
  if (spec.type === 'vlanName') {
    return /^[a-zA-Z0-9_.-]{1,32}$/.test(value) ? null : 'Invalid VLAN name';
  }
  if (spec.type === 'description') return value.length <= 80 ? null : 'Description is too long';
  return null;
};

const structurallyMatches = (command, inputTokens, negated) => {
  const specs = command.tokens;
  if (negated && !command.negatable) return null;

  const params = {};
  for (let index = 0; index < inputTokens.length; index += 1) {
    const spec = specs[index];
    if (!spec) return null;

    if (spec.type === 'rest') {
      params[spec.parameter] = inputTokens
        .slice(index)
        .map((token) => token.value)
        .join(' ');
      return { command, params, consumed: inputTokens.length };
    }

    const token = inputTokens[index];
    if (spec.keyword && !spec.keyword.startsWith(token.lower)) return null;
    if (spec.parameter) params[spec.parameter] = token.value;
  }

  return { command, params, consumed: inputTokens.length };
};

const requiredTokenCount = (command, negated) =>
  command.tokens.filter((token) => !(negated && token.optionalOnNegate)).length;

const findErrorPosition = (commands, inputTokens, negated, rawInput) => {
  for (let index = 0; index < inputTokens.length; index += 1) {
    const prefix = inputTokens.slice(0, index + 1);
    const hasMatch = commands.some((command) => structurallyMatches(command, prefix, negated));
    if (!hasMatch) return inputTokens[index].position;
  }
  return Math.max(0, rawInput.length - 1);
};

const parseCommand = (profileId, deviceState, rawInput) => {
  const profile = getProfile(profileId);
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return { kind: 'empty' };

  if (trimmed === '?' || trimmed.endsWith('?')) {
    const helpInput = trimmed === '?' ? '' : trimmed.slice(0, -1);
    return { kind: 'help', ...getCompletions(profileId, deviceState, helpInput) };
  }

  let tokens = tokenize(trimmed);
  const negated = tokens[0]?.lower === 'no';
  if (negated) tokens = tokens.slice(1);

  const commands = getModeCommands(profile, deviceState.mode, deviceState.deviceType);
  const matches = commands
    .map((command) => structurallyMatches(command, tokens, negated))
    .filter(Boolean);

  if (matches.length === 0) {
    return {
      kind: 'error',
      code: 'INVALID_INPUT',
      message: "Invalid input detected at '^' marker.",
      position: findErrorPosition(commands, tokens, negated, trimmed),
    };
  }

  if (matches.length > 1) {
    return {
      kind: 'error',
      code: 'AMBIGUOUS_COMMAND',
      message: `Ambiguous command: "${trimmed}"`,
      position: 0,
    };
  }

  const match = matches[0];
  if (tokens.length < requiredTokenCount(match.command, negated)) {
    return {
      kind: 'error',
      code: 'INCOMPLETE_COMMAND',
      message: 'Incomplete command.',
      position: trimmed.length,
    };
  }

  for (let index = 0; index < match.command.tokens.length; index += 1) {
    const spec = match.command.tokens[index];
    if (!spec.parameter || (negated && spec.optionalOnNegate && !tokens[index])) continue;
    const value =
      spec.type === 'rest'
        ? tokens
            .slice(index)
            .map((token) => token.value)
            .join(' ')
        : tokens[index]?.value;
    const validationError = validateParameter(spec, value || '');
    if (validationError) {
      return {
        kind: 'error',
        code: 'INVALID_PARAMETER',
        message: validationError,
        position: tokens[index]?.position ?? trimmed.length,
      };
    }
    match.params[spec.parameter] = value;
    if (spec.type === 'rest') break;
  }

  return {
    kind: 'command',
    id: match.command.id,
    handler: match.command.handler,
    params: match.params,
    negated,
  };
};

function getCompletions(profileId, deviceState, rawInput = '') {
  const profile = getProfile(profileId);
  const input = String(rawInput || '');
  const endsWithSpace = /\s$/.test(input);
  let tokens = tokenize(input.trimStart());
  const negated = tokens[0]?.lower === 'no';
  const noPrefix = negated ? 'no ' : '';
  if (negated) tokens = tokens.slice(1);

  const position = endsWithSpace ? tokens.length : Math.max(0, tokens.length - 1);
  const prefix = endsWithSpace || tokens.length === 0 ? '' : tokens[position].lower;
  const baseTokens = tokens.slice(0, position);
  const commands = getModeCommands(profile, deviceState.mode, deviceState.deviceType)
    .filter((command) => !negated || command.negatable)
    .filter((command) => structurallyMatches(command, baseTokens, negated));

  const candidates = [];
  commands.forEach((command) => {
    const spec = command.tokens[position];
    if (!spec) {
      candidates.push({ value: '<cr>', help: 'Execute the command', kind: 'enter' });
      return;
    }
    if (spec.keyword && spec.keyword.startsWith(prefix)) {
      candidates.push({ value: spec.keyword, help: spec.help || '', kind: 'keyword' });
    } else if (spec.parameter) {
      candidates.push({ value: `<${spec.parameter}>`, help: spec.help || '', kind: 'parameter' });
    }
  });

  const unique = Array.from(
    new Map(candidates.map((candidate) => [candidate.value, candidate])).values()
  ).sort((a, b) => a.value.localeCompare(b.value));
  let completion = null;
  const keywordCandidates = unique.filter((candidate) => candidate.kind === 'keyword');
  if (keywordCandidates.length === 1 && unique.length === 1) {
    const completedTokens = [...baseTokens.map((token) => token.value), keywordCandidates[0].value];
    completion = `${noPrefix}${completedTokens.join(' ')} `;
  }

  return { candidates: unique, completion };
}

module.exports = {
  getCompletions,
  getProfile,
  parseCommand,
  tokenize,
};
