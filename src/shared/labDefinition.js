const normalizeCommands = (commands = []) =>
  (Array.isArray(commands)
    ? commands
    : String(commands || '')
        .split(/\r?\n/)
        .filter(Boolean)
  ).flatMap((entry) => {
    if (entry && typeof entry === 'object')
      return [{ deviceId: entry.deviceId || null, command: entry.command }];
    const text = String(entry);
    const match = text.match(/^([A-Za-z][\w-]*(?:\/[A-Za-z][\w-]*)*):\s*(.*)$/);
    return match
      ? match[1].split('/').map((deviceId) => ({ deviceId, command: match[2] }))
      : [{ deviceId: null, command: text }];
  });
const normalizeSteps = (steps = []) =>
  steps.map((step) => ({ ...step, commands: normalizeCommands(step.commands) }));
const commandText = (entry) =>
  typeof entry === 'string'
    ? entry
    : `${entry.deviceId ? `${entry.deviceId}: ` : ''}${entry.command}`;
const networkAddress = (ip, mask) =>
  ip
    .split('.')
    .map((part, i) => Number(part) & Number(mask.split('.')[i]))
    .join('.');
const wildcard = (mask) =>
  mask
    .split('.')
    .map((part) => 255 - Number(part))
    .join('.');
const prefixLength = (mask) =>
  mask.split('.').reduce((n, part) => n + Number(part).toString(2).replace(/0/g, '').length, 0);
module.exports = {
  normalizeCommands,
  normalizeSteps,
  commandText,
  networkAddress,
  wildcard,
  prefixLength,
};
