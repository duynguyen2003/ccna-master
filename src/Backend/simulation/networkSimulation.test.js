const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('./networkEngine');
const { transmit, aclAllows } = require('./networkPackets');
const { routeTable, layer2Path, spanningTree } = require('./networkProtocols');
const { topologySchema, parseCliLabConfig } = require('../validation/cliLabSchema');
const { gradeAttempt } = require('./gradingEngine');
const { withAttempt, mayAccess } = require('./attemptAccess');
const { explainFeedback } = require('./labFeedback');
const { sanitizeHtml } = require('../../shared/sanitizeHtml');
const port = (name, ipAddress, subnetMask = '255.255.255.0') => ({ name, ipAddress, subnetMask, shutdown: false });
const end = (deviceId, name) => ({ deviceId, interface: name });
const wire = (id, a, b) => ({ id, a, b, enabled: true });
const definition = () => ({ devices: [
  { id: 'PC1', deviceType: 'PC', interfaces: [port('GigabitEthernet0/0', '192.168.1.10')] },
  { id: 'R1', deviceType: 'ROUTER', interfaces: [port('GigabitEthernet0/0', '192.168.1.1'), port('GigabitEthernet0/1', '10.0.0.1')] },
  { id: 'R2', deviceType: 'ROUTER', interfaces: [port('GigabitEthernet0/0', '10.0.0.2'), port('GigabitEthernet0/1', '192.168.2.1')] },
  { id: 'PC2', deviceType: 'PC', interfaces: [port('GigabitEthernet0/0', '192.168.2.10')] },
], links: [wire('L1', end('PC1', 'GigabitEthernet0/0'), end('R1', 'GigabitEthernet0/0')), wire('L2', end('R1', 'GigabitEthernet0/1'), end('R2', 'GigabitEthernet0/0')), wire('L3', end('R2', 'GigabitEthernet0/1'), end('PC2', 'GigabitEthernet0/0'))] });
function commands(s, deviceId, list) {
  for (const command of list) { const result = engine.execute(s, { type: 'command', deviceId, command }); assert.equal(result.isError, false, `${deviceId}: ${command}: ${result.output}`); s = result.state; }
  return s;
}
const config = (s, id, list) => commands(s, id, ['enable', 'conf t', ...list, 'end']);
test('lab guide sanitizer keeps formatting and removes executable HTML', () => {
  const safe = sanitizeHtml('<h3>Guide</h3><p class="note">Use <strong>enable</strong> <a href="javascript:alert(1)" onclick="alert(2)">CLI</a>.</p><script>alert(3)</script><img src="x">');
  assert.match(safe, /<h3>Guide<\/h3>/); assert.match(safe, /<strong>enable<\/strong>/); assert.doesNotMatch(safe, /script|onclick|javascript|<img/i);
});
function network(staticRouting = true) {
  let s = engine.initial(definition());
  s = config(s, 'PC1', ['ip default-gateway 192.168.1.1']); s = config(s, 'PC2', ['ip default-gateway 192.168.2.1']);
  if (staticRouting) { s = config(s, 'R1', ['ip route 192.168.2.0 255.255.255.0 10.0.0.2']); s = config(s, 'R2', ['ip route 192.168.1.0 255.255.255.0 10.0.0.1']); }
  return s;
}
test('topology validation rejects duplicate ports, missing endpoints and unsafe device IDs', () => {
  const d = definition(); assert.equal(topologySchema.safeParse(d).success, true);
  d.links.push(wire('bad', end('PC1', 'GigabitEthernet0/0'), end('R2', 'GigabitEthernet0/0')));
  assert.equal(topologySchema.safeParse(d).success, false);
  d.devices[0].id = '__proto__'; assert.equal(topologySchema.safeParse(d).success, false);
});
test('network grading schema requires real device and port references', () => {
  assert.throws(() => parseCliLabConfig({ labType: 'CLI_SIMULATION', courseId: 'c1', initialState: definition(), gradingSpec: { checks: [{ id: 'test', type: 'reachable', points: 100, destination: '192.168.2.10', deviceId: 'missing' }] } }));
});
test('static routing delivers request and reply and records Ethernet/ARP/TTL', () => {
  const s = network(); const result = transmit(s, 'PC1', '192.168.2.10'); assert.equal(result.success, true, result.reason);
  assert.ok(result.events.some((e) => e.type === 'ARP_REQUEST')); assert.ok(result.events.some((e) => e.type === 'FRAME' && e.srcMac));
  assert.ok(result.events.some((e) => e.type === 'REPLY_DELIVERED' && e.packet.ttl === 30));
});
test('missing reverse route fails even when request reaches destination', () => {
  const s = network(); s.devices.R2.staticRoutes = [];
  const result = transmit(s, 'PC1', '192.168.2.10'); assert.equal(result.success, false); assert.match(result.reason, /Return path/);
});
test('link loss, shutdown and wrong subnet cannot be bypassed by graph reachability', () => {
  const s = network(); s.links[1].enabled = false; assert.equal(transmit(s, 'PC1', '192.168.2.10').success, false);
  s.links[1].enabled = true; s.devices.R1.interfaces['GigabitEthernet0/1'].shutdown = true; assert.equal(transmit(s, 'PC1', '192.168.2.10').success, false);
  s.devices.R1.interfaces['GigabitEthernet0/1'].shutdown = false; s.devices.PC1.interfaces['GigabitEthernet0/0'].ipAddress = '172.16.1.10'; assert.equal(transmit(s, 'PC1', '192.168.2.10').success, false);
});
test('longest prefix selects specific static route before default', () => {
  const s = network(); s.devices.R1.staticRoutes.push({ network: '0.0.0.0', mask: '0.0.0.0', nextHop: '10.0.0.99' });
  assert.equal(transmit(s, 'PC1', '192.168.2.10').success, true); assert.equal(routeTable(s, 'R1').at(-1).mask, '0.0.0.0');
});
test('TTL expires at a forwarding router and drop identifies that router', () => {
  const r = transmit(network(), 'PC1', '192.168.2.10', { ttl: 1 }); assert.equal(r.success, false); assert.match(r.reason, /TTL/);
  const ttl = r.events.find((event) => event.type === 'TTL_EXCEEDED'); const drop = r.events.find((event) => event.type === 'DROP');
  assert.equal(ttl.deviceId, 'R1'); assert.equal(drop.deviceId, 'R1');
});
test('OSPF transitions INIT to EXCHANGE to FULL and installs routes after two ticks', () => {
  let s = network(false);
  for (const id of ['R1', 'R2']) s = config(s, id, ['router ospf 1', 'network 0.0.0.0 255.255.255.255 area 0']);
  assert.equal(Object.values(s.ospfNeighbors)[0].state, 'INIT'); assert.equal(transmit(s, 'PC1', '192.168.2.10').success, false);
  s = engine.execute(s, { type: 'tick' }).state; assert.equal(Object.values(s.ospfNeighbors)[0].state, 'EXCHANGE');
  s = engine.execute(s, { type: 'tick' }).state; assert.equal(Object.values(s.ospfNeighbors)[0].state, 'FULL');
  assert.ok(routeTable(s, 'R1').some((r) => r.protocol === 'O')); assert.equal(transmit(s, 'PC1', '192.168.2.10').success, true);
  s = engine.execute(s, { type: 'link', linkId: 'L2', enabled: false }).state;
  assert.equal(Object.keys(s.ospfNeighbors).length, 0); assert.equal(s.devices.R1.ospfRoutes.length, 0);
});
test('STP blocks redundant triangle link and elects lower-priority root', () => {
  let s = engine.initial({ devices: ['S1', 'S2', 'S3'].map((id) => ({ id, deviceType: 'SWITCH', interfaces: ['GigabitEthernet0/1', 'GigabitEthernet0/2'] })), links: [wire('A', end('S1', 'GigabitEthernet0/1'), end('S2', 'GigabitEthernet0/1')), wire('B', end('S2', 'GigabitEthernet0/2'), end('S3', 'GigabitEthernet0/1')), wire('C', end('S3', 'GigabitEthernet0/2'), end('S1', 'GigabitEthernet0/2'))] });
  assert.equal(Object.values(s.stp[1].ports).filter((p) => p === 'BLOCKING').length, 1);
  s = config(s, 'S3', ['spanning-tree vlan 1 priority 0']); assert.equal(s.stp[1].roots.S1, 'S3');
  s = engine.execute(s, { type: 'link', linkId: 'C', enabled: false }).state; assert.equal(Object.values(s.stp[1].ports).filter((p) => p === 'BLOCKING').length, 0);
});
test('VLAN separation prevents L2 traversal and switch learns source MAC on allowed traffic', () => {
  const d = { devices: [{ id: 'A', deviceType: 'PC', interfaces: [port('GigabitEthernet0/0', '10.0.0.1')] }, { id: 'S', deviceType: 'SWITCH', interfaces: ['GigabitEthernet0/1', 'GigabitEthernet0/2'] }, { id: 'B', deviceType: 'PC', interfaces: [port('GigabitEthernet0/0', '10.0.0.2')] }], links: [wire('A', end('A', 'GigabitEthernet0/0'), end('S', 'GigabitEthernet0/1')), wire('B', end('B', 'GigabitEthernet0/0'), end('S', 'GigabitEthernet0/2'))] };
  const s = engine.initial(d); assert.equal(transmit(s, 'A', '10.0.0.2').success, true); assert.ok(Object.keys(s.devices.S.macTable).length >= 2);
  s.devices.S.interfaces['GigabitEthernet0/2'].accessVlan = 20; s.stp = spanningTree(s);
  assert.equal(layer2Path(s, end('A', 'GigabitEthernet0/0'), end('B', 'GigabitEthernet0/0')), null);
});
test('extended ACL honors rule order, destination port and implicit deny', () => {
  const d = { acls: { TEST: [engine.aclRule('deny', 'tcp any host 192.168.2.10 eq 22'), engine.aclRule('permit', 'tcp any any eq 80')] } };
  const p = { src: '192.168.1.10', dst: '192.168.2.10', protocol: 'tcp', dstPort: 22 };
  assert.equal(aclAllows(d, 'TEST', p).allowed, false); assert.equal(aclAllows(d, 'TEST', { ...p, dstPort: 80 }).allowed, true); assert.equal(aclAllows(d, 'TEST', { ...p, protocol: 'icmp' }).allowed, false);
  assert.throws(() => engine.aclRule('permit', 'tcp any any eq invalid'));
});
test('interface ACL denies simulated packet at the specified boundary', () => {
  let s = network(); s = commands(s, 'R1', ['conf t', 'ip access-list extended BLOCK', 'deny icmp any any', 'exit', 'interface g0/0', 'ip access-group BLOCK in', 'end']);
  const r = transmit(s, 'PC1', '192.168.2.10'); assert.equal(r.success, false); assert.match(r.reason, /ACL inbound/);
});
test('static NAT permits return path without route to inside private subnet', () => {
  let s = network(); s.devices.R2.staticRoutes = [];
  s = commands(s, 'R1', ['conf t', 'ip nat inside source static 192.168.1.10 10.0.0.100', 'interface g0/0', 'ip nat inside', 'exit', 'interface g0/1', 'ip nat outside', 'end']);
  const r = transmit(s, 'PC1', '192.168.2.10'); assert.equal(r.success, true, r.reason); assert.ok(r.events.some((e) => e.type === 'NAT_SOURCE')); assert.ok(r.events.some((e) => e.type === 'NAT_DESTINATION'));
});
test('PAT creates matching reverse translation, reuses tuple, and ages out', () => {
  let s = network(); s.devices.R2.staticRoutes = [];
  s = commands(s, 'R1', ['conf t', 'ip access-list extended NAT', 'permit ip 192.168.1.0 0.0.0.255 any', 'exit', 'ip nat inside source list NAT interface g0/1 overload', 'interface g0/0', 'ip nat inside', 'exit', 'interface g0/1', 'ip nat outside', 'end']);
  assert.equal(transmit(s, 'PC1', '192.168.2.10').success, true); assert.equal(transmit(s, 'PC1', '192.168.2.10').success, true); assert.equal(s.devices.R1.natTranslations.length, 1);
  for (let i = 0; i < 60; i++) s = engine.execute(s, { type: 'tick' }).state;
  assert.equal(s.devices.R1.natTranslations.length, 0);
});
test('PAT reuses the oldest free port after partial aging without corrupting the remaining flow', () => {
  let s = network(); s.devices.R2.staticRoutes = [];
  s = commands(s, 'R1', ['conf t', 'ip access-list extended NAT', 'permit ip 192.168.1.0 0.0.0.255 any', 'exit', 'ip nat inside source list NAT interface g0/1 overload', 'interface g0/0', 'ip nat inside', 'exit', 'interface g0/1', 'ip nat outside', 'end']);
  assert.equal(transmit(s, 'PC1', '192.168.2.10', { srcPort: 40000 }).success, true);
  s = engine.execute(s, { type: 'tick' }).state;
  assert.equal(transmit(s, 'PC1', '192.168.2.10', { srcPort: 40001 }).success, true);
  for (let i = 0; i < 59; i++) s = engine.execute(s, { type: 'tick' }).state;
  assert.equal(s.tick, 60); assert.deepEqual(s.devices.R1.natTranslations.map((entry) => entry.globalPort), [10001]);
  assert.equal(transmit(s, 'PC1', '192.168.2.10', { srcPort: 40002 }).success, true);
  assert.deepEqual(s.devices.R1.natTranslations.map((entry) => entry.globalPort).sort((a, b) => a - b), [10000, 10001]);
  assert.equal(transmit(s, 'PC1', '192.168.2.10', { srcPort: 40001 }).success, true);
  assert.equal(s.devices.R1.natTranslations.find((entry) => entry.localPort === 40001).tick, s.tick);
});
test('semantic network grading does not mutate state or award unreachable networks', () => {
  const s = network(); const before = JSON.stringify(s); const rubric = { passingScore: 100, checks: [{ id: 'ping', type: 'reachable', deviceId: 'PC1', destination: '192.168.2.10', points: 100 }] };
  assert.equal(gradeAttempt(s, rubric).passed, true); assert.equal(JSON.stringify(s), before); s.links[1].enabled = false; assert.equal(gradeAttempt(s, rubric).score, 0);
});
test('event replay is deterministic across configuration, probe and ticks', () => {
  const events = [{ type: 'command', deviceId: 'R1', command: 'enable' }, { type: 'command', deviceId: 'R1', command: 'conf t' }, { type: 'command', deviceId: 'R1', command: 'hostname Edge' }, { type: 'tick' }, { type: 'probe', deviceId: 'PC1', destination: '192.168.1.1' }];
  const replay = () => events.reduce((s, action) => engine.execute(s, action).state, engine.initial(definition()));
  assert.deepEqual(replay(), replay()); assert.equal(replay().devices.R1.hostname, 'Edge');
});
test('attempt access checks owner, member and revocation; DB lock precedes read', async () => {
  const a = { userId: 1, members: [2] }; assert.equal(mayAccess(a, 2), true); assert.equal(mayAccess(a, 3), false); a.members = []; assert.equal(mayAccess(a, 2), false);
  const calls = []; const tx = { $queryRaw: async () => calls.push('lock'), labAttempt: { findUnique: async () => { calls.push('read'); return a; } } };
  const p = { $transaction: (cb) => cb(tx) };
  await withAttempt(p, '38d87104-975e-46c0-b757-55e3d4d213c7', 1, async () => calls.push('write'));
  assert.deepEqual(calls, ['lock', 'read', 'write']); await assert.rejects(withAttempt(p, '38d87104-975e-46c0-b757-55e3d4d213c7', 3, () => {}), (e) => e.status === 404);
});
test('LLM integration keeps deterministic feedback and has timeout/error fallback', async () => {
  const f = { score: 0, checks: [{ passed: false, message: 'Missing route', hint: 'Inspect routing table' }] };
  const config = { LAB_AI_URL: 'https://example.invalid', LAB_AI_KEY: 'test', LAB_AI_MODEL: 'test' };
  assert.equal((await explainFeedback(f, {})).provider, 'deterministic');
  let request; const r = await explainFeedback(f, config, async (url, req) => { request = req; return { ok: true, json: async () => ({ choices: [{ message: { content: 'Kiểm tra route về.' } }] }) }; });
  assert.equal(r.provider, 'configured'); assert.equal(JSON.parse(request.body).messages.length, 2); assert.equal(f.score, 0);
  assert.equal((await explainFeedback(f, config, async () => { throw new Error('offline'); })).provider, 'deterministic');
});

module.exports = { definition, network, commands };

test('traceroute uses increasing TTL and reports routers then endpoint', () => {
  const result = engine.execute(network(), { type: 'command', deviceId: 'PC1', command: 'traceroute 192.168.2.10' });
  assert.equal(result.isError, false); assert.match(result.output, /1  R1/); assert.match(result.output, /2  R2/); assert.match(result.output, /3  PC2/);
});
test('network no commands reverse static route, NAT binding and ACL definition', () => {
  let s = network(); s = commands(s, 'R1', ['conf t', 'no ip route 192.168.2.0 255.255.255.0 10.0.0.2', 'ip access-list extended FILTER', 'permit ip any any', 'exit', 'no ip access-list extended FILTER', 'interface g0/0', 'ip nat inside', 'no ip nat inside', 'end']);
  assert.equal(s.devices.R1.staticRoutes.length, 0); assert.equal(s.devices.R1.acls.FILTER, undefined); assert.equal(s.devices.R1.interfaces['GigabitEthernet0/0'].natRole, null);
});
test('OSPF duplicate router IDs do not form adjacency', () => {
  let s = network(false); for (const id of ['R1', 'R2']) s = config(s, id, ['router ospf 1', 'router-id 1.1.1.1', 'network 0.0.0.0 255.255.255.255 area 0']);
  for (let i = 0; i < 3; i++) s = engine.execute(s, { type: 'tick' }).state;
  assert.equal(Object.keys(s.ospfNeighbors).length, 0);
});
