const { z } = require('zod');

const interfaceNameSchema = z.string().regex(
  /^(?:(?:GigabitEthernet|FastEthernet)\d+\/\d+|Loopback\d+)$/,
  'Tên interface không hợp lệ'
);

const ipv4Schema = z.string().refine((value) => {
  const parts = value.split('.');
  return parts.length === 4 && parts.every((part) => /^\d+$/.test(part) && Number(part) <= 255);
}, 'Địa chỉ IPv4 không hợp lệ');

const subnetMaskSchema = ipv4Schema.refine((value) => {
  const bits = value.split('.').map(Number).map((part) => part.toString(2).padStart(8, '0')).join('');
  return !bits.includes('01');
}, 'Subnet mask không hợp lệ');

const deviceDefinitionSchema = z.object({
  deviceType: z.enum(['ROUTER', 'SWITCH', 'PC']),
  hostname: z.string().regex(/^[a-zA-Z][a-zA-Z0-9-]{0,62}$/).optional(),
  interfaces: z.array(z.union([
    interfaceNameSchema,
    z.object({
      name: interfaceNameSchema,
      shutdown: z.boolean().optional(),
      description: z.string().max(80).optional(),
      ipAddress: ipv4Schema.optional().nullable(),
      subnetMask: subnetMaskSchema.optional().nullable(),
      switchportMode: z.enum(['access', 'trunk']).optional().nullable(),
      accessVlan: z.number().int().min(1).max(4094).optional().nullable(),
    }),
  ])).min(1).max(24),
});

const safeId = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/).refine((s) => !['constructor', 'prototype', '__proto__'].includes(s));
const endpointSchema = z.object({ deviceId: safeId, interface: interfaceNameSchema });
const topologySchema = z.object({
  devices: z.array(deviceDefinitionSchema.extend({ id: safeId, position: z.object({ x: z.number().min(0).max(1000), y: z.number().min(0).max(600) }).optional() })).min(1).max(24),
  links: z.array(z.object({ id: safeId, a: endpointSchema, b: endpointSchema, enabled: z.boolean().default(true) })).max(96),
}).superRefine((s, ctx) => {
  const ids = new Set(); const occupied = new Set(); const linkIds = new Set();
  const issue = (message) => ctx.addIssue({ code: 'custom', message });
  for (const d of s.devices) {
    if (ids.has(d.id)) issue(`Duplicate device ${d.id}`); ids.add(d.id);
    const names = d.interfaces.map((p) => typeof p === 'string' ? p : p.name);
    if (new Set(names).size !== names.length) issue(`Duplicate ports on ${d.id}`);
  }
  for (const l of s.links) {
    if (linkIds.has(l.id)) issue(`Duplicate link ${l.id}`); linkIds.add(l.id);
    if (l.a.deviceId === l.b.deviceId) issue('Self links are not supported');
    for (const e of [l.a, l.b]) {
      const d = s.devices.find((n) => n.id === e.deviceId);
      if (!d?.interfaces.some((p) => (typeof p === 'string' ? p : p.name) === e.interface)) issue('Link references unknown port');
      const key = `${e.deviceId}:${e.interface}`; if (occupied.has(key)) issue(`Port already connected: ${key}`); occupied.add(key);
    }
  }
});
const initialStateSchema = z.union([deviceDefinitionSchema, topologySchema]);

const gradingCheckSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum([
    'hostname_equals',
    'interface_exists',
    'interface_ip_equals',
    'interface_enabled',
    'interface_description_equals',
    'vlan_exists',
    'vlan_name_equals',
    'switchport_mode_equals',
    'switchport_access_vlan_equals',
    'startup_config_saved',
    'reachable', 'route_exists', 'ospf_neighbor_full', 'stp_root', 'acl_exists', 'nat_static_exists',
  ]),
  points: z.number().positive().max(1000),
  title: z.string().max(200).optional(),
  message: z.string().max(500).optional(),
  successMessage: z.string().max(500).optional(),
  hint: z.string().max(500).optional(),
  interface: interfaceNameSchema.optional(),
  vlanId: z.number().int().min(1).max(4094).optional(),
  expected: z.union([z.string(), z.number(), z.boolean()]).optional(),
  expectedIp: ipv4Schema.optional(),
  expectedMask: subnetMaskSchema.optional(),
  deviceId: safeId.optional(),
  destination: ipv4Schema.optional(),
  neighborId: safeId.optional(),
  name: safeId.optional(),
});

const gradingSpecSchema = z.object({
  passingScore: z.number().min(0).max(100).default(70),
  checks: z.array(gradingCheckSchema).min(1).max(50),
}).superRefine((spec, context) => {
  spec.checks.forEach((check, index) => {
    const requireField = (condition, field, message) => {
      if (!condition) context.addIssue({ code: 'custom', path: ['checks', index, field], message });
    };
    if (['interface_exists', 'interface_ip_equals', 'interface_enabled', 'interface_description_equals', 'switchport_mode_equals', 'switchport_access_vlan_equals'].includes(check.type)) {
      requireField(Boolean(check.interface), 'interface', `${check.type} cần trường interface`);
    }
    if (check.type === 'interface_ip_equals') {
      requireField(Boolean(check.expectedIp), 'expectedIp', 'interface_ip_equals cần expectedIp');
      requireField(Boolean(check.expectedMask), 'expectedMask', 'interface_ip_equals cần expectedMask');
    }
    if (['hostname_equals', 'interface_description_equals', 'vlan_name_equals', 'switchport_mode_equals', 'switchport_access_vlan_equals'].includes(check.type)) {
      requireField(check.expected !== undefined, 'expected', `${check.type} cần trường expected`);
    }
    if (['vlan_exists', 'vlan_name_equals'].includes(check.type)) {
      requireField(Boolean(check.vlanId), 'vlanId', `${check.type} cần trường vlanId`);
    }
    if (['reachable', 'route_exists'].includes(check.type)) requireField(Boolean(check.destination), 'destination', 'Destination IPv4 is required');
    if (check.type === 'ospf_neighbor_full') requireField(Boolean(check.neighborId), 'neighborId', 'Neighbor device is required');
    if (check.type === 'stp_root') requireField(Boolean(check.vlanId && check.deviceId), 'vlanId', 'VLAN and device are required');
    if (check.type === 'acl_exists') requireField(Boolean(check.name), 'name', 'ACL name is required');
    if (check.type === 'nat_static_exists') requireField(Boolean(check.expectedIp && check.destination), 'expectedIp', 'Local and global IPs are required');
  });
  if (new Set(spec.checks.map((c) => c.id)).size !== spec.checks.length) context.addIssue({ code: 'custom', message: 'Check IDs must be unique' });
});

const commandRequestSchema = z.object({
  command: z.string().trim().min(1).max(500),
  expectedRevision: z.number().int().min(0).optional(),
  deviceId: safeId.optional(),
});

const actionSchema = z.discriminatedUnion('type', [
  commandRequestSchema.extend({ type: z.literal('command') }),
  z.object({ type: z.literal('tick') }),
  z.object({ type: z.literal('link'), linkId: safeId, enabled: z.boolean() }),
  z.object({ type: z.literal('probe'), deviceId: safeId, destination: ipv4Schema, protocol: z.enum(['icmp', 'tcp', 'udp']).default('icmp'), dstPort: z.number().int().min(0).max(65535).default(0), ttl: z.number().int().min(1).max(64).default(32) }),
]);

const parseJsonField = (value, fieldName) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${fieldName} phải là JSON hợp lệ`);
  }
};

const parseCliLabConfig = ({ labType, initialState, gradingSpec, commandProfile, courseId }) => {
  const normalizedType = labType || 'PACKET_TRACER';
  if (!['PACKET_TRACER', 'CLI_SIMULATION'].includes(normalizedType)) {
    throw new Error('labType không hợp lệ');
  }
  if (normalizedType !== 'CLI_SIMULATION') {
    return {
      labType: normalizedType,
      initialState: null,
      gradingSpec: null,
      commandProfile: null,
      simulatorVersion: null,
    };
  }
  if (!courseId) throw new Error('CLI Lab phải thuộc một khóa học');
  if (commandProfile && !['ccna-basic-v1', 'ccna-network-v2'].includes(commandProfile)) {
    throw new Error('Unsupported command profile');
  }
  const parsedInitialState = initialStateSchema.parse(parseJsonField(initialState, 'initialState'));
  const parsedGradingSpec = gradingSpecSchema.parse(parseJsonField(gradingSpec, 'gradingSpec'));
  if (parsedInitialState.devices) {
    for (const check of parsedGradingSpec.checks) {
      const device = parsedInitialState.devices.find((d) => d.id === check.deviceId);
      if (!device) throw new Error(`Check ${check.id} requires a valid deviceId`);
      if (check.interface && !device.interfaces.some((p) => (typeof p === 'string' ? p : p.name) === check.interface)) throw new Error(`Unknown interface in ${check.id}`);
      if (check.neighborId && !parsedInitialState.devices.some((d) => d.id === check.neighborId)) throw new Error('Unknown neighbor');
    }
  } else if (parsedGradingSpec.checks.some((c) => ['reachable', 'route_exists', 'ospf_neighbor_full', 'stp_root', 'acl_exists', 'nat_static_exists'].includes(c.type))) throw new Error('Network checks require a topology');
  return {
    labType: normalizedType,
    initialState: parsedInitialState,
    gradingSpec: parsedGradingSpec,
    commandProfile: parsedInitialState.devices ? 'ccna-network-v2' : 'ccna-basic-v1',
    simulatorVersion: parsedInitialState.devices ? '2.0.0' : '1.0.0',
  };
};

module.exports = {
  commandRequestSchema,
  gradingSpecSchema,
  initialStateSchema,
  parseCliLabConfig,
  actionSchema, topologySchema,
};
