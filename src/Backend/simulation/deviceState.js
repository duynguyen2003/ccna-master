const { getCompletions, getProfile, parseCommand } = require('./cliParser');

const MODES = {
  USER: 'USER_EXEC',
  PRIVILEGED: 'PRIVILEGED_EXEC',
  GLOBAL: 'GLOBAL_CONFIG',
  INTERFACE: 'INTERFACE_CONFIG',
  VLAN: 'VLAN_CONFIG',
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const interfaceDefaults = (deviceType) => ({
  ipAddress: null,
  subnetMask: null,
  shutdown: deviceType === 'ROUTER',
  description: '',
  switchportMode: deviceType === 'SWITCH' ? 'access' : null,
  accessVlan: deviceType === 'SWITCH' ? 1 : null,
});

const normalizeInterfaceName = (input) => {
  const compact = String(input || '').replace(/\s+/g, '').toLowerCase();
  const aliases = [
    [/^(g|gi|gig|gigabitethernet)(\d+\/\d+)$/, 'GigabitEthernet'],
    [/^(f|fa|fastethernet)(\d+\/\d+)$/, 'FastEthernet'],
    [/^(lo|loopback)(\d+)$/, 'Loopback'],
  ];
  for (const [pattern, prefix] of aliases) {
    const match = compact.match(pattern);
    if (match) return `${prefix}${match[2]}`;
  }
  return null;
};

const createInitialState = (initialState = {}) => {
  const deviceType = initialState.deviceType === 'SWITCH' ? 'SWITCH' : 'ROUTER';
  const defaultNames = deviceType === 'SWITCH'
    ? ['GigabitEthernet0/1', 'GigabitEthernet0/2']
    : ['GigabitEthernet0/0', 'GigabitEthernet0/1'];
  const names = Array.isArray(initialState.interfaces) && initialState.interfaces.length
    ? initialState.interfaces
    : defaultNames;
  const interfaces = {};
  names.forEach((name) => {
    const normalized = normalizeInterfaceName(typeof name === 'string' ? name : name.name);
    if (!normalized) return;
    interfaces[normalized] = {
      ...interfaceDefaults(deviceType),
      ...(typeof name === 'object' ? name : {}),
      name: undefined,
    };
    delete interfaces[normalized].name;
  });

  return {
    schemaVersion: 1,
    revision: 0,
    deviceType,
    hostname: initialState.hostname || (deviceType === 'SWITCH' ? 'Switch' : 'Router'),
    mode: MODES.USER,
    context: { interface: null, vlanId: null },
    interfaces,
    vlans: { 1: { name: 'default', status: 'active' } },
    startupConfig: null,
  };
};

const getPrompt = (state) => {
  switch (state.mode) {
    case MODES.PRIVILEGED: return `${state.hostname}#`;
    case MODES.GLOBAL: return `${state.hostname}(config)#`;
    case MODES.INTERFACE: return `${state.hostname}(config-if)#`;
    case MODES.VLAN: return `${state.hostname}(config-vlan)#`;
    default: return `${state.hostname}>`;
  }
};

const buildRunningConfig = (state) => {
  const lines = [
    'Building configuration...',
    '',
    'Current configuration : simulated',
    '!',
    'version 15.2',
    `hostname ${state.hostname}`,
    '!',
  ];

  if (state.deviceType === 'SWITCH') {
    Object.entries(state.vlans).forEach(([vlanId, vlan]) => {
      if (vlanId !== '1') lines.push(`vlan ${vlanId}`, ` name ${vlan.name}`, '!');
    });
  }

  Object.entries(state.interfaces).forEach(([name, config]) => {
    lines.push(`interface ${name}`);
    if (config.description) lines.push(` description ${config.description}`);
    if (config.ipAddress) lines.push(` ip address ${config.ipAddress} ${config.subnetMask}`);
    if (state.deviceType === 'SWITCH') {
      lines.push(` switchport mode ${config.switchportMode || 'access'}`);
      lines.push(` switchport access vlan ${config.accessVlan || 1}`);
    }
    lines.push(config.shutdown ? ' shutdown' : ' no shutdown', '!');
  });
  lines.push('end');
  return lines.join('\n');
};

const showIpInterfaceBrief = (state) => {
  const rows = Object.entries(state.interfaces).map(([name, config]) => {
    const ip = config.ipAddress || 'unassigned';
    const status = config.shutdown ? 'administratively down' : 'up';
    const protocol = config.shutdown ? 'down' : 'up';
    return `${name.padEnd(24)}${ip.padEnd(16)}YES manual ${status.padEnd(23)}${protocol}`;
  });
  return [
    'Interface               IP-Address      OK? Method Status                 Protocol',
    ...rows,
  ].join('\n');
};

const showInterfaces = (state) => Object.entries(state.interfaces).map(([name, config]) => {
  const operational = config.shutdown ? 'administratively down, line protocol is down' : 'up, line protocol is up';
  return `${name} is ${operational}\n  Description: ${config.description || 'not set'}\n  Internet address is ${config.ipAddress ? `${config.ipAddress} ${config.subnetMask}` : 'not set'}`;
}).join('\n\n');

const showVlans = (state) => {
  const rows = Object.entries(state.vlans).map(([vlanId, vlan]) => {
    const ports = Object.entries(state.interfaces)
      .filter(([, config]) => config.switchportMode === 'access' && String(config.accessVlan) === vlanId)
      .map(([name]) => name.replace('GigabitEthernet', 'Gi'))
      .join(', ');
    return `${vlanId.padEnd(5)}${vlan.name.padEnd(32)}${vlan.status.padEnd(10)}${ports}`;
  });
  return [
    'VLAN Name                            Status    Ports',
    '---- -------------------------------- --------- -------------------------------',
    ...rows,
  ].join('\n');
};

const errorResult = (state, rawCommand, error) => ({
  state,
  prompt: getPrompt(state),
  mode: state.mode,
  output: `${' '.repeat(Math.max(0, error.position || 0))}^\n% ${error.message}`,
  isError: true,
  errorCode: error.code,
  errorPosition: error.position,
  command: rawCommand,
});

const executeCommand = (currentState, rawCommand, profileId = 'ccna-basic-v1') => {
  getProfile(profileId);
  const state = clone(currentState);
  const prompt = getPrompt(state);
  const mode = state.mode;
  const parsed = parseCommand(profileId, state, rawCommand);

  if (parsed.kind === 'empty') {
    return { state, prompt, mode, output: '', isError: false, command: rawCommand };
  }
  if (parsed.kind === 'error') return errorResult(state, rawCommand, parsed);
  if (parsed.kind === 'help') {
    const output = parsed.candidates.length
      ? parsed.candidates.map((candidate) => `  ${candidate.value.padEnd(24)} ${candidate.help}`).join('\n')
      : '  <cr>';
    return { state, prompt, mode, output, isError: false, command: rawCommand, help: true };
  }

  let output = '';
  let changed = false;
  const currentInterface = () => state.interfaces[state.context.interface];

  switch (parsed.handler) {
    case 'enable': state.mode = MODES.PRIVILEGED; changed = true; break;
    case 'disable': state.mode = MODES.USER; changed = true; break;
    case 'configure_terminal':
      state.mode = MODES.GLOBAL;
      output = 'Enter configuration commands, one per line. End with CNTL/Z.';
      changed = true;
      break;
    case 'exit':
      if (state.mode === MODES.PRIVILEGED) state.mode = MODES.USER;
      else if (state.mode === MODES.GLOBAL) state.mode = MODES.PRIVILEGED;
      else if ([MODES.INTERFACE, MODES.VLAN].includes(state.mode)) state.mode = MODES.GLOBAL;
      state.context = { interface: null, vlanId: null };
      changed = true;
      break;
    case 'end':
      state.mode = MODES.PRIVILEGED;
      state.context = { interface: null, vlanId: null };
      changed = true;
      break;
    case 'set_hostname':
      state.hostname = parsed.negated
        ? (state.deviceType === 'SWITCH' ? 'Switch' : 'Router')
        : parsed.params.hostname;
      changed = true;
      break;
    case 'select_interface': {
      const normalized = normalizeInterfaceName(parsed.params.interface);
      if (!normalized || !state.interfaces[normalized]) {
        return errorResult(state, rawCommand, {
          code: 'INVALID_INTERFACE',
          message: 'Invalid interface type and number.',
          position: rawCommand.toLowerCase().indexOf(parsed.params.interface.toLowerCase()),
        });
      }
      state.mode = MODES.INTERFACE;
      state.context = { interface: normalized, vlanId: null };
      changed = true;
      break;
    }
    case 'set_interface_ip':
      if (parsed.negated) {
        currentInterface().ipAddress = null;
        currentInterface().subnetMask = null;
      } else {
        currentInterface().ipAddress = parsed.params.ipAddress;
        currentInterface().subnetMask = parsed.params.subnetMask;
      }
      changed = true;
      break;
    case 'set_shutdown':
      currentInterface().shutdown = !parsed.negated;
      output = parsed.negated ? '%LINK-3-UPDOWN: Interface changed state to up' : '';
      changed = true;
      break;
    case 'set_description':
      currentInterface().description = parsed.negated ? '' : parsed.params.description;
      changed = true;
      break;
    case 'select_vlan': {
      const vlanId = Number(parsed.params.vlanId);
      if (!state.vlans[vlanId]) state.vlans[vlanId] = { name: `VLAN${String(vlanId).padStart(4, '0')}`, status: 'active' };
      state.mode = MODES.VLAN;
      state.context = { interface: null, vlanId };
      changed = true;
      break;
    }
    case 'set_vlan_name':
      state.vlans[state.context.vlanId].name = parsed.negated
        ? `VLAN${String(state.context.vlanId).padStart(4, '0')}`
        : parsed.params.vlanName;
      changed = true;
      break;
    case 'set_switchport_access':
      currentInterface().switchportMode = 'access';
      changed = true;
      break;
    case 'set_access_vlan': {
      const vlanId = Number(parsed.params.vlanId);
      if (!state.vlans[vlanId]) state.vlans[vlanId] = { name: `VLAN${String(vlanId).padStart(4, '0')}`, status: 'active' };
      currentInterface().accessVlan = vlanId;
      changed = true;
      break;
    }
    case 'show_running_config': output = buildRunningConfig(state); break;
    case 'show_startup_config': output = state.startupConfig || 'startup-config is not present'; break;
    case 'show_interfaces': output = showInterfaces(state); break;
    case 'show_ip_interface_brief': output = showIpInterfaceBrief(state); break;
    case 'show_vlan_brief': output = showVlans(state); break;
    case 'save_config':
      state.startupConfig = buildRunningConfig(state);
      output = 'Building configuration...\n[OK]';
      changed = true;
      break;
    default:
      return errorResult(state, rawCommand, {
        code: 'UNSUPPORTED_HANDLER',
        message: 'Command handler is not implemented.',
        position: 0,
      });
  }

  if (changed) state.revision += 1;
  return { state, prompt, mode, output, isError: false, command: rawCommand };
};

const getCompletionResult = (state, input, profileId = 'ccna-basic-v1') => (
  getCompletions(profileId, state, input)
);

module.exports = {
  MODES,
  buildRunningConfig,
  createInitialState,
  executeCommand,
  getCompletionResult,
  getPrompt,
  normalizeInterfaceName,
};
