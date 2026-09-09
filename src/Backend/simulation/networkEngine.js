const single = require('./deviceState');
const { parseCommand, getCompletions } = require('./cliParser');
const { converge, routeTable, ipNumber, ipText } = require('./networkProtocols');
const { transmit } = require('./networkPackets');
const clone = (s) => JSON.parse(JSON.stringify(s));
const PROFILE = 'ccna-network-v2';
const activeDevice = (s, id) => s.devices ? s.devices[id || Object.keys(s.devices)[0]] : s;
const prompt = (s, id) => {
  const d = activeDevice(s, id);
  if (!d) throw new Error('Unknown device');
  if (d.mode === 'ROUTER_CONFIG') return `${d.hostname}(config-router)#`;
  if (d.mode === 'ACL_CONFIG') return `${d.hostname}(config-ext-nacl)#`;
  return single.getPrompt(d);
};
function initial(definition) {
  if (!definition.devices) return single.createInitialState(definition);
  const devices = {};
  for (const item of definition.devices) {
    const device = single.createInitialState(item);
    devices[item.id] = { ...device, deviceType: item.deviceType, position: item.position || { x: 100, y: 100 }, staticRoutes: [], ospf: null, ospfRoutes: [], stpPriority: {}, acls: {}, natStatic: [], natTranslations: [], arp: {}, macTable: {} };
  }
  return converge({ schemaVersion: 2, revision: 0, tick: 0, devices, links: clone(definition.links), stp: {}, ospfNeighbors: {}, lastPacket: null });
}

function aclRule(action, text) {
  const t = text.trim().split(/\s+/); const protocol = t.shift();
  if (!['ip', 'icmp', 'tcp', 'udp'].includes(protocol)) throw new Error('ACL supports ip, icmp, tcp, udp');
  const ipv4 = (v) => /^(\d{1,3}\.){3}\d{1,3}$/.test(v || '') && v.split('.').every((n) => Number(n) <= 255);
  const address = () => {
    const token = t.shift();
    if (token === 'any') return { kind: 'any' };
    if (token === 'host') { const ip = t.shift(); if (!ipv4(ip)) throw new Error('Invalid ACL host'); return { kind: 'host', ip }; }
    const wildcard = t.shift(); if (!ipv4(token) || !ipv4(wildcard)) throw new Error('Expected any, host IP, or IP wildcard');
    return { kind: 'network', ip: token, wildcard };
  };
  const source = address(); const destination = address(); let port;
  if (t.length) {
    if (!['tcp', 'udp'].includes(protocol) || t.shift() !== 'eq' || t.length !== 1 || !/^\d+$/.test(t[0]) || Number(t[0]) > 65535) throw new Error('Supported qualifier: eq <destination-port>');
    port = Number(t.shift());
  }
  return { action, protocol, source, destination, ...(port !== undefined ? { port } : {}), text: `${action} ${text}` };
}
function configText(d) {
  const lines = [single.buildRunningConfig(d)];
  for (const r of d.staticRoutes) lines.push(`ip route ${r.network} ${r.mask} ${r.nextHop}`);
  if (d.ospf) { lines.push(`router ospf ${d.ospf.process}`); if (d.ospf.routerId) lines.push(` router-id ${d.ospf.routerId}`); for (const n of d.ospf.networks) lines.push(` network ${n.network} ${n.wildcard} area 0`); }
  for (const [vlan, priority] of Object.entries(d.stpPriority)) lines.push(`spanning-tree vlan ${vlan} priority ${priority}`);
  for (const [name, rules] of Object.entries(d.acls)) lines.push(`ip access-list extended ${name}`, ...rules.map((r) => ` ${r.text}`));
  for (const m of d.natStatic) lines.push(`ip nat inside source static ${m.local} ${m.global}`);
  if (d.natOverload) lines.push(`ip nat inside source list ${d.natOverload.acl} interface ${d.natOverload.interface} overload`);
  for (const [name, p] of Object.entries(d.interfaces)) {
    const options = [p.natRole && `ip nat ${p.natRole}`, p.aclIn && `ip access-group ${p.aclIn} in`, p.aclOut && `ip access-group ${p.aclOut} out`, p.ospfCost && `ip ospf cost ${p.ospfCost}`].filter(Boolean);
    if (options.length) lines.push(`interface ${name}`, ...options.map((s) => ` ${s}`));
  }
  return lines.join('\n');
}

function execute(s, action) {
  if (!s.devices) {
    if (action.type !== 'command') throw new Error('This action requires a topology lab');
    return single.executeCommand(s, action.command);
  }
  const state = clone(s); const deviceId = action.deviceId || Object.keys(state.devices)[0];
  const d = state.devices[deviceId]; if (!d) throw new Error('Unknown device');
  const beforePrompt = prompt(state, deviceId); const beforeMode = d.mode;
  let output = ''; let isError = false;
  try {
    if (action.type === 'tick') {
      state.tick += 1;
      for (const device of Object.values(state.devices)) {
        device.arp = Object.fromEntries(Object.entries(device.arp).filter(([, e]) => state.tick - e.tick < 30));
        device.macTable = Object.fromEntries(Object.entries(device.macTable).filter(([, e]) => state.tick - e.tick < 30));
        device.natTranslations = device.natTranslations.filter((e) => state.tick - e.tick < 60);
      }
      output = `Simulation tick ${state.tick}`;
    } else if (action.type === 'link') {
      const link = state.links.find((l) => l.id === action.linkId);
      if (!link) throw new Error('Unknown link');
      link.enabled = action.enabled; output = `${link.id}: ${action.enabled ? 'connected' : 'disconnected'}`;
    } else if (action.type === 'probe') {
      state.lastPacket = transmit(state, deviceId, action.destination, action);
      output = state.lastPacket.reason;
    } else if (action.type === 'command') {
      const parsed = parseCommand(PROFILE, d, action.command);
      if (parsed.kind !== 'command') {
        const result = single.executeCommand(d, action.command, PROFILE);
        return { ...result, state: s, prompt: beforePrompt, mode: beforeMode };
      }
      const p = parsed.params; const neg = parsed.negated; const int = d.interfaces[d.context.interface];
      switch (parsed.handler) {
        case 'static_route': {
          const route = { network: ipText((ipNumber(p.network) & ipNumber(p.mask)) >>> 0), mask: p.mask, nextHop: p.nextHop };
          if (d.staticRoutes.length >= 128 && !neg) throw new Error('Maximum 128 static routes');
          d.staticRoutes = d.staticRoutes.filter((r) => JSON.stringify(r) !== JSON.stringify(route));
          if (!neg) d.staticRoutes.push(route); break;
        }
        case 'default_gateway': d.staticRoutes = d.staticRoutes.filter((r) => r.mask !== '0.0.0.0'); if (!neg) d.staticRoutes.push({ network: '0.0.0.0', mask: '0.0.0.0', nextHop: p.gateway }); break;
        case 'router_ospf': if (neg) { d.ospf = null; break; } d.ospf ||= { process: Number(p.process), networks: [] }; d.mode = 'ROUTER_CONFIG'; break;
        case 'ospf_network': d.ospf.networks = d.ospf.networks.filter((n) => n.network !== p.network || n.wildcard !== p.wildcard); if (!neg) { if (d.ospf.networks.length >= 32) throw new Error('Maximum 32 OSPF networks'); d.ospf.networks.push({ network: p.network, wildcard: p.wildcard, area: 0 }); } break;
        case 'router_id': d.ospf.routerId = p.routerId; break;
        case 'ospf_cost': if (Number(p.cost) < 1) throw new Error('Cost must be positive'); int.ospfCost = Number(p.cost); break;
        case 'stp_priority': if (Number(p.priority) % 4096 || Number(p.priority) > 61440) throw new Error('Priority must be a multiple of 4096 (0-61440)'); d.stpPriority[p.vlanId] = Number(p.priority); break;
        case 'trunk': int.switchportMode = 'trunk'; break;
        case 'acl': if (neg) { delete d.acls[p.name]; break; } if (!d.acls[p.name] && Object.keys(d.acls).length >= 32) throw new Error('Maximum 32 ACLs'); d.acls[p.name] ||= []; d.context.acl = p.name; d.mode = 'ACL_CONFIG'; break;
        case 'acl_permit': case 'acl_deny': if (d.acls[d.context.acl].length >= 128) throw new Error('Maximum 128 rules per ACL'); d.acls[d.context.acl].push(aclRule(parsed.handler.slice(4), p.rule)); break;
        case 'acl_bind': if (!['in', 'out'].includes(p.direction)) throw new Error('Direction must be in or out'); int[p.direction === 'in' ? 'aclIn' : 'aclOut'] = neg ? null : p.name; break;
        case 'nat_inside': case 'nat_outside': int.natRole = neg ? null : parsed.handler.slice(4); break;
        case 'nat_static': if (d.natStatic.length >= 128 && !neg) throw new Error('Maximum 128 NAT mappings'); d.natStatic = d.natStatic.filter((m) => m.local !== p.local && m.global !== p.global); if (!neg) d.natStatic.push({ local: p.local, global: p.global }); break;
        case 'nat_overload': { const name = single.normalizeInterfaceName(p.interface); if (!d.interfaces[name]) throw new Error('Unknown interface'); d.natOverload = neg ? null : { acl: p.name, interface: name }; break; }
        case 'network_show_route': output = routeTable(state, deviceId).map((r) => `${r.protocol} ${r.network} ${r.mask} [${r.distance}/${r.cost}] via ${r.nextHop || 'connected'}, ${r.interface}`).join('\n') || 'No routes'; break;
        case 'network_show_arp': output = JSON.stringify(d.arp, null, 2); break;
        case 'network_show_mac': output = JSON.stringify(d.macTable, null, 2); break;
        case 'network_show_ospf': output = JSON.stringify(Object.values(state.ospfNeighbors).filter((n) => n.deviceId === deviceId), null, 2); break;
        case 'network_show_stp': output = JSON.stringify(state.stp, null, 2); break;
        case 'network_show_acl': output = JSON.stringify(d.acls, null, 2); break;
        case 'network_show_nat': output = JSON.stringify([...d.natStatic, ...d.natTranslations], null, 2); break;
        case 'ping': state.lastPacket = transmit(state, deviceId, p.destination); output = `${state.lastPacket.success ? '!\nSuccess rate is 100 percent (1/1)' : '.\nSuccess rate is 0 percent (0/1)'}\n${state.lastPacket.reason}`; break;
        case 'traceroute': {
          const hops = []; const events = [];
          for (let ttl = 1; ttl <= 32; ttl++) {
            const probe = transmit(state, deviceId, p.destination, { ttl, oneWay: true });
            const hop = probe.events.find((e) => ['TTL_EXCEEDED', 'DELIVERED'].includes(e.type));
            hops.push(`${ttl}  ${hop?.deviceId || '*'}  ${probe.reason}`); events.push(...probe.events);
            state.lastPacket = { ...probe, events: [...events] };
            if (probe.success || !hop) break;
          }
          output = hops.join('\n'); break;
        }
        case 'show_running_config': output = configText(d); break;
        case 'save_config': d.startupConfig = configText(d); output = '[OK]'; break;
        case 'exit': if (['ROUTER_CONFIG', 'ACL_CONFIG'].includes(d.mode)) { d.mode = 'GLOBAL_CONFIG'; break; } // fall through
        default: {
          const result = single.executeCommand(d, action.command, PROFILE);
          if (result.isError) return { ...result, state: s };
          state.devices[deviceId] = result.state; output = result.output;
        }
      }
    } else throw new Error('Unknown simulation action');
    converge(state); state.revision = s.revision + 1;
  } catch (error) { return { state: s, prompt: beforePrompt, mode: beforeMode, output: `% ${error.message}`, isError: true }; }
  return { state, prompt: beforePrompt, mode: beforeMode, output, isError };
}
const completions = (s, input, id) => getCompletions(s.devices ? PROFILE : 'ccna-basic-v1', activeDevice(s, id), input);
module.exports = { initial, execute, prompt, activeDevice, completions, aclRule, configText, PROFILE };
