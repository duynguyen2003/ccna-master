const zodModule =
  typeof window !== 'undefined' ? require('./zodBrowser') : require('zod');
const { z } = zodModule;
const { CLI_PROFILE_CATALOG, SUPPORTED_CLI_PROFILE_IDS } = require('./cliLabCatalog');

const strictObject = (shape) => z.object(shape).strict();

const safeId = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/, 'ID chỉ được chứa chữ, số, gạch ngang và gạch dưới')
  .refine(
    (value) => !['constructor', 'prototype', '__proto__'].includes(value),
    'ID không an toàn'
  );

const checkId = z
  .string()
  .min(1, 'Check ID không được để trống')
  .max(80, 'Check ID quá dài')
  .refine(
    (value) => !['constructor', 'prototype', '__proto__'].includes(value),
    'Check ID không an toàn'
  );

const hostnameSchema = z.string().regex(/^[a-zA-Z][a-zA-Z0-9-]{0,62}$/, 'Hostname không hợp lệ');

const interfaceNameSchema = z
  .string()
  .regex(
    /^(?:(?:GigabitEthernet|FastEthernet)\d+\/\d+|Loopback\d+)$/,
    'Tên interface không hợp lệ'
  );

const ipv4Schema = z.string().refine((value) => {
  const parts = value.split('.');
  return parts.length === 4 && parts.every((part) => /^\d+$/.test(part) && Number(part) <= 255);
}, 'Địa chỉ IPv4 không hợp lệ');

const subnetMaskSchema = ipv4Schema.refine((value) => {
  const bits = value
    .split('.')
    .map(Number)
    .map((part) => part.toString(2).padStart(8, '0'))
    .join('');
  return !bits.includes('01');
}, 'Subnet mask không hợp lệ');

const vlanIdSchema = z.number().int().min(1).max(4094);
const vlanNameSchema = z.string().regex(/^[a-zA-Z0-9_.-]{1,32}$/, 'Tên VLAN không hợp lệ');
const positionSchema = strictObject({
  x: z.number().finite().min(0).max(1000),
  y: z.number().finite().min(0).max(600),
});

const interfaceConfigSchema = strictObject({
  name: interfaceNameSchema,
  shutdown: z.boolean().optional(),
  description: z.string().max(80).optional(),
  ipAddress: ipv4Schema.optional().nullable(),
  subnetMask: subnetMaskSchema.optional().nullable(),
  switchportMode: z.enum(['access', 'trunk']).optional().nullable(),
  accessVlan: vlanIdSchema.optional().nullable(),
});

const interfaceEntrySchema = z.union([interfaceNameSchema, interfaceConfigSchema]);

const deviceShape = {
  deviceType: z.enum(['ROUTER', 'SWITCH', 'PC']),
  hostname: hostnameSchema.optional(),
  interfaces: z.array(interfaceEntrySchema).min(1).max(24),
};

const validateDeviceInterfaces = (device, context) => {
  const names = device.interfaces.map((entry) => (typeof entry === 'string' ? entry : entry.name));
  if (new Set(names).size !== names.length) {
    context.addIssue({
      code: 'custom',
      path: ['interfaces'],
      message: `Trùng interface trên ${device.id || 'thiết bị'}`,
    });
  }

  device.interfaces.forEach((entry, index) => {
    if (typeof entry === 'string') return;
    const hasIp = entry.ipAddress !== undefined && entry.ipAddress !== null;
    const hasMask = entry.subnetMask !== undefined && entry.subnetMask !== null;
    if (hasIp !== hasMask) {
      context.addIssue({
        code: 'custom',
        path: ['interfaces', index],
        message: 'ipAddress và subnetMask phải đi cùng nhau',
      });
    }
    if (
      device.deviceType !== 'SWITCH' &&
      ((entry.switchportMode !== undefined && entry.switchportMode !== null) ||
        (entry.accessVlan !== undefined && entry.accessVlan !== null))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['interfaces', index],
        message: 'switchportMode/accessVlan chỉ được dùng cho SWITCH',
      });
    }
  });
};

const deviceDefinitionSchema = strictObject(deviceShape).superRefine(validateDeviceInterfaces);
const topologyDeviceDefinitionSchema = strictObject({
  id: safeId,
  position: positionSchema.optional(),
  ...deviceShape,
}).superRefine(validateDeviceInterfaces);

const endpointSchema = strictObject({ deviceId: safeId, interface: interfaceNameSchema });
const linkSchema = strictObject({
  id: safeId,
  a: endpointSchema,
  b: endpointSchema,
  enabled: z.boolean().default(true),
});

const topologySchema = strictObject({
  devices: z.array(topologyDeviceDefinitionSchema).min(1).max(24),
  links: z.array(linkSchema).max(96),
}).superRefine((topology, context) => {
  const deviceIds = new Set();
  const linkIds = new Set();
  const occupiedPorts = new Set();

  topology.devices.forEach((device, index) => {
    if (deviceIds.has(device.id)) {
      context.addIssue({
        code: 'custom',
        path: ['devices', index, 'id'],
        message: `Trùng device ID ${device.id}`,
      });
    }
    deviceIds.add(device.id);
  });

  topology.links.forEach((link, index) => {
    if (linkIds.has(link.id)) {
      context.addIssue({
        code: 'custom',
        path: ['links', index, 'id'],
        message: `Trùng link ID ${link.id}`,
      });
    }
    linkIds.add(link.id);

    if (link.a.deviceId === link.b.deviceId) {
      context.addIssue({
        code: 'custom',
        path: ['links', index],
        message: 'Không hỗ trợ link nối cùng một thiết bị',
      });
    }

    [link.a, link.b].forEach((endpoint, endpointIndex) => {
      const device = topology.devices.find((item) => item.id === endpoint.deviceId);
      if (!device) {
        context.addIssue({
          code: 'custom',
          path: ['links', index, endpointIndex === 0 ? 'a' : 'b', 'deviceId'],
          message: `Link tham chiếu device không tồn tại: ${endpoint.deviceId}`,
        });
        return;
      }
      const hasPort = device.interfaces.some(
        (entry) => (typeof entry === 'string' ? entry : entry.name) === endpoint.interface
      );
      if (!hasPort) {
        context.addIssue({
          code: 'custom',
          path: ['links', index, endpointIndex === 0 ? 'a' : 'b', 'interface'],
          message: `Link tham chiếu interface không tồn tại: ${endpoint.interface}`,
        });
      }
      const portKey = `${endpoint.deviceId}:${endpoint.interface}`;
      if (occupiedPorts.has(portKey)) {
        context.addIssue({
          code: 'custom',
          path: ['links', index],
          message: `Port đã được nối: ${portKey}`,
        });
      }
      occupiedPorts.add(portKey);
    });
  });
});

const initialStateSchema = z.union([deviceDefinitionSchema, topologySchema]);

const commonCheckShape = {
  id: checkId,
  points: z.number().finite().positive().max(1000),
  title: z.string().min(1).max(200).optional(),
  message: z.string().max(500).optional(),
  successMessage: z.string().max(500).optional(),
  hint: z.string().max(500).optional(),
};

const makeCheckSchema = (type, fields) =>
  strictObject({
    ...commonCheckShape,
    type: z.literal(type),
    ...fields,
  });

const gradingCheckSchema = z.discriminatedUnion('type', [
  makeCheckSchema('hostname_equals', { deviceId: safeId.optional(), expected: hostnameSchema }),
  makeCheckSchema('interface_exists', {
    deviceId: safeId.optional(),
    interface: interfaceNameSchema,
  }),
  makeCheckSchema('interface_ip_equals', {
    deviceId: safeId.optional(),
    interface: interfaceNameSchema,
    expectedIp: ipv4Schema,
    expectedMask: subnetMaskSchema,
  }),
  makeCheckSchema('interface_enabled', {
    deviceId: safeId.optional(),
    interface: interfaceNameSchema,
  }),
  makeCheckSchema('interface_description_equals', {
    deviceId: safeId.optional(),
    interface: interfaceNameSchema,
    expected: z.string().max(80),
  }),
  makeCheckSchema('vlan_exists', { deviceId: safeId.optional(), vlanId: vlanIdSchema }),
  makeCheckSchema('vlan_name_equals', {
    deviceId: safeId.optional(),
    vlanId: vlanIdSchema,
    expected: vlanNameSchema,
  }),
  makeCheckSchema('switchport_mode_equals', {
    deviceId: safeId.optional(),
    interface: interfaceNameSchema,
    expected: z.enum(['access', 'trunk']),
  }),
  makeCheckSchema('switchport_access_vlan_equals', {
    deviceId: safeId.optional(),
    interface: interfaceNameSchema,
    expected: vlanIdSchema,
  }),
  makeCheckSchema('startup_config_saved', { deviceId: safeId.optional() }),
  makeCheckSchema('reachable', { deviceId: safeId, destination: ipv4Schema }),
  makeCheckSchema('route_exists', { deviceId: safeId, destination: ipv4Schema }),
  makeCheckSchema('ospf_neighbor_full', { deviceId: safeId, neighborId: safeId }),
  makeCheckSchema('stp_root', { deviceId: safeId, vlanId: vlanIdSchema }),
  makeCheckSchema('acl_exists', { deviceId: safeId, name: safeId }),
  makeCheckSchema('nat_static_exists', {
    deviceId: safeId,
    expectedIp: ipv4Schema,
    destination: ipv4Schema,
  }),
]);

const gradingSpecSchema = strictObject({
  passingScore: z.number().finite().min(0).max(100).default(70),
  checks: z.array(gradingCheckSchema).min(1).max(50),
}).superRefine((spec, context) => {
  const ids = new Set();
  spec.checks.forEach((check, index) => {
    if (ids.has(check.id)) {
      context.addIssue({
        code: 'custom',
        path: ['checks', index, 'id'],
        message: `Check ID bị trùng: ${check.id}`,
      });
    }
    ids.add(check.id);
  });
});

const commandRequestShape = {
  command: z.string().trim().min(1).max(500),
  expectedRevision: z.number().int().min(0).optional(),
  deviceId: safeId.optional(),
};
const commandRequestSchema = strictObject(commandRequestShape);

const actionSchema = z.discriminatedUnion('type', [
  strictObject({ type: z.literal('command'), ...commandRequestShape }),
  strictObject({ type: z.literal('tick') }),
  strictObject({ type: z.literal('link'), linkId: safeId, enabled: z.boolean() }),
  strictObject({
    type: z.literal('probe'),
    deviceId: safeId,
    destination: ipv4Schema,
    protocol: z.enum(['icmp', 'tcp', 'udp']).default('icmp'),
    dstPort: z.number().int().min(0).max(65535).default(0),
    ttl: z.number().int().min(1).max(64).default(32),
  }),
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

const networkOnlyChecks = new Set([
  'reachable',
  'route_exists',
  'ospf_neighbor_full',
  'stp_root',
  'acl_exists',
  'nat_static_exists',
]);
const interfaceChecks = new Set([
  'interface_exists',
  'interface_ip_equals',
  'interface_enabled',
  'interface_description_equals',
  'switchport_mode_equals',
  'switchport_access_vlan_equals',
]);
const switchChecks = new Set([
  'vlan_exists',
  'vlan_name_equals',
  'switchport_mode_equals',
  'switchport_access_vlan_equals',
  'stp_root',
]);

const getDeviceInterfaceNames = (device) =>
  device.interfaces.map((entry) => (typeof entry === 'string' ? entry : entry.name));

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
  if (typeof courseId !== 'string' || !courseId.trim()) {
    throw new Error('CLI Lab phải thuộc một khóa học');
  }

  const initialStateInput = parseJsonField(initialState, 'initialState');
  // Select the concrete shape before parsing so a strict-object error keeps
  // its useful path (a union would collapse it into "Invalid input").
  const parsedInitialState =
    initialStateInput &&
    typeof initialStateInput === 'object' &&
    !Array.isArray(initialStateInput) &&
    Object.prototype.hasOwnProperty.call(initialStateInput, 'devices')
      ? topologySchema.parse(initialStateInput)
      : deviceDefinitionSchema.parse(initialStateInput);
  const parsedGradingSpec = gradingSpecSchema.parse(parseJsonField(gradingSpec, 'gradingSpec'));
  const isTopology = Array.isArray(parsedInitialState.devices);
  const expectedProfile = isTopology ? 'ccna-network-v2' : 'ccna-basic-v1';

  // Null/undefined is how old records represented an omitted profile. An
  // explicit value is always checked, including an empty string.
  const hasExplicitProfile = commandProfile !== undefined && commandProfile !== null;
  const requestedProfile = hasExplicitProfile ? commandProfile : expectedProfile;
  if (!SUPPORTED_CLI_PROFILE_IDS.includes(requestedProfile)) {
    throw new Error(`Unsupported command profile: ${String(requestedProfile)}`);
  }
  if (requestedProfile !== expectedProfile) {
    throw new Error(
      `Command profile ${requestedProfile} không phù hợp với ${isTopology ? 'topology nhiều thiết bị' : 'lab một thiết bị'}; yêu cầu ${expectedProfile}`
    );
  }

  const devices = isTopology ? parsedInitialState.devices : null;
  const deviceById = devices ? new Map(devices.map((device) => [device.id, device])) : null;
  parsedGradingSpec.checks.forEach((check) => {
    if (!devices) {
      if (networkOnlyChecks.has(check.type)) {
        throw new Error(`Check ${check.id} (${check.type}) yêu cầu topology nhiều thiết bị`);
      }
      if (check.deviceId) {
        throw new Error(`Check ${check.id} của lab một thiết bị không được có deviceId`);
      }
      if (
        check.interface &&
        !getDeviceInterfaceNames(parsedInitialState).includes(check.interface)
      ) {
        throw new Error(`Check ${check.id} tham chiếu interface không tồn tại: ${check.interface}`);
      }
      if (switchChecks.has(check.type) && parsedInitialState.deviceType !== 'SWITCH') {
        throw new Error(`Check ${check.id} (${check.type}) yêu cầu thiết bị SWITCH`);
      }
      return;
    }

    if (!check.deviceId) {
      throw new Error(`Check ${check.id} của topology phải có deviceId`);
    }
    const device = deviceById.get(check.deviceId);
    if (!device) {
      throw new Error(`Check ${check.id} requires a valid deviceId: ${check.deviceId}`);
    }
    if (check.interface && !getDeviceInterfaceNames(device).includes(check.interface)) {
      throw new Error(`Unknown interface in ${check.id}: ${check.interface}`);
    }
    if (interfaceChecks.has(check.type) && !check.interface) {
      throw new Error(`Check ${check.id} cần trường interface`);
    }
    if (switchChecks.has(check.type) && device.deviceType !== 'SWITCH') {
      throw new Error(`Check ${check.id} (${check.type}) yêu cầu device SWITCH`);
    }
    if (check.type === 'ospf_neighbor_full') {
      if (device.deviceType !== 'ROUTER')
        throw new Error(`Check ${check.id} yêu cầu device ROUTER`);
      if (check.neighborId === check.deviceId)
        throw new Error(`Check ${check.id} không thể tham chiếu chính nó làm neighbor`);
      const neighbor = deviceById.get(check.neighborId);
      if (!neighbor) throw new Error(`Unknown neighbor in ${check.id}: ${check.neighborId}`);
      if (neighbor.deviceType !== 'ROUTER')
        throw new Error(`Neighbor của ${check.id} phải là ROUTER`);
    }
    if (check.type === 'nat_static_exists' && device.deviceType !== 'ROUTER') {
      throw new Error(`Check ${check.id} (nat_static_exists) yêu cầu device ROUTER`);
    }
  });

  const profile = CLI_PROFILE_CATALOG.find((item) => item.id === requestedProfile);
  return {
    labType: normalizedType,
    initialState: parsedInitialState,
    gradingSpec: parsedGradingSpec,
    commandProfile: requestedProfile,
    simulatorVersion: profile.simulatorVersion,
  };
};

module.exports = {
  actionSchema,
  checkId,
  commandRequestSchema,
  deviceDefinitionSchema,
  endpointSchema,
  gradingCheckSchema,
  gradingSpecSchema,
  initialStateSchema,
  interfaceNameSchema,
  ipv4Schema,
  parseCliLabConfig,
  safeId,
  subnetMaskSchema,
  topologySchema,
  vlanIdSchema,
};
