const { createHash } = require('node:crypto');
const { parseCommand } = require('@ccna/shared/simulation/cliParser');
const { diagnose } = require('./diagnostics');
const VERSION = 'be05-observations-v1';
const id = (prefix, value) =>
  `${prefix}_${createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24)}`;

// Snapshot observations and separately versioned, scoped SIM-01 conclusions.
function evidenceFor(context, request) {
  const facts = [];
  const add = (kind, reference, observation, extra = {}) => {
    if (facts.length === 64) return;
    facts.push({
      evidenceId: id('ev', [context.sourceRevision, kind, reference, observation]),
      kind,
      ...extra,
      sourceRevision: context.sourceRevision,
      observation,
      confidenceClass: 'OBSERVED',
      scope: 'snapshot-observation',
      provenance: { source: 'SNAPSHOT', reference, version: VERSION },
    });
  };
  for (const device of context.devices) {
    for (const port of device.interfaces)
      add(
        'INTERFACE',
        `devices.${device.id}.interfaces.${port.name}`,
        `${device.id} ${port.name}: ${port.shutdown ? 'shutdown' : 'không shutdown'}; IPv4 ${port.ipAddress || 'chưa đặt'}.`,
        { deviceId: device.id, interface: port.name }
      );
    for (const route of device.routes)
      add(
        'ROUTE',
        `devices.${device.id}.routes.${id('r', [route.network, route.mask, route.nextHop, route.protocol])}`,
        `${device.id}: route ${route.network} mask ${route.mask}, next hop ${route.nextHop || 'trực tiếp'}, protocol ${route.protocol}.`,
        { deviceId: device.id }
      );
    for (const vlan of device.vlans)
      add(
        'VLAN',
        `devices.${device.id}.vlans.${vlan.vlanId}`,
        `${device.id}: VLAN ${vlan.vlanId}, tên ${vlan.name}.`,
        { deviceId: device.id }
      );
  }
  for (const link of context.links)
    add('LINK', `links.${link.id}`, `Link ${link.id}: ${link.enabled ? 'đang nối' : 'đang ngắt'}.`);
  const diagnostics = diagnose(context, request).facts;
  return [...facts.slice(0, 64 - diagnostics.length), ...diagnostics];
}

function commandsFor(context) {
  const commands = [];
  for (const device of context.devices) {
    if (device.deviceType === 'PC') continue;
    const candidates = [
      'show ip interface brief',
      device.deviceType === 'SWITCH' ? 'show vlan brief' : 'show ip route',
    ];
    for (const command of candidates) {
      const mode = 'PRIVILEGED_EXEC';
      const parsed = parseCommand(
        context.lab.commandProfile,
        { deviceType: device.deviceType, mode },
        command
      );
      if (
        parsed.kind !== 'command' ||
        (!parsed.handler.startsWith('show_') && !parsed.handler.startsWith('network_show_'))
      )
        throw new Error('AI_COMMAND_CATALOG_INVALID');
      if (commands.length < 32)
        commands.push({
          commandId: id('cmd', [context.lab.commandProfile, device.id, mode, command]),
          deviceId: device.id,
          mode,
          command,
        });
    }
  }
  return commands;
}
module.exports = { evidenceFor, commandsFor, VERSION };
