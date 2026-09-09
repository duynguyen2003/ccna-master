const test = require('node:test');
const assert = require('node:assert/strict');
const {
  gradingSpecSchema,
  initialStateSchema,
  parseCliLabConfig,
} = require('../validation/cliLabSchema');

const singleState = {
  deviceType: 'ROUTER',
  hostname: 'Router',
  interfaces: ['GigabitEthernet0/0', 'GigabitEthernet0/1'],
};

const topologyState = {
  devices: [
    {
      id: 'R1',
      deviceType: 'ROUTER',
      position: { x: 10, y: 20 },
      interfaces: ['GigabitEthernet0/0', 'GigabitEthernet0/1'],
    },
    {
      id: 'R2',
      deviceType: 'ROUTER',
      position: { x: 200, y: 20 },
      interfaces: ['GigabitEthernet0/0'],
    },
    {
      id: 'S1',
      deviceType: 'SWITCH',
      position: { x: 100, y: 200 },
      interfaces: ['GigabitEthernet0/1', 'GigabitEthernet0/2'],
    },
  ],
  links: [
    {
      id: 'L1',
      a: { deviceId: 'R1', interface: 'GigabitEthernet0/0' },
      b: { deviceId: 'R2', interface: 'GigabitEthernet0/0' },
    },
  ],
};

test('shared schema rejects unknown JSON fields instead of silently stripping them', () => {
  const state = { ...singleState, editorOnly: true };
  assert.equal(initialStateSchema.safeParse(state).success, false);
  const spec = {
    checks: [
      { id: 'host', type: 'hostname_equals', expected: 'R1', points: 100, answer: 'hostname R1' },
    ],
  };
  assert.equal(gradingSpecSchema.safeParse(spec).success, false);
  assert.equal(state.editorOnly, true);
});

test('all sixteen supported check types have typed fields and unsupported examples stay rejected', () => {
  const gradingSpec = {
    checks: [
      { id: 'h', type: 'hostname_equals', deviceId: 'R1', expected: 'R1', points: 1 },
      {
        id: 'ie',
        type: 'interface_exists',
        deviceId: 'R1',
        interface: 'GigabitEthernet0/0',
        points: 1,
      },
      {
        id: 'ip',
        type: 'interface_ip_equals',
        deviceId: 'R1',
        interface: 'GigabitEthernet0/0',
        expectedIp: '10.0.0.1',
        expectedMask: '255.255.255.0',
        points: 1,
      },
      {
        id: 'up',
        type: 'interface_enabled',
        deviceId: 'R1',
        interface: 'GigabitEthernet0/0',
        points: 1,
      },
      {
        id: 'desc',
        type: 'interface_description_equals',
        deviceId: 'R1',
        interface: 'GigabitEthernet0/0',
        expected: 'uplink',
        points: 1,
      },
      { id: 've', type: 'vlan_exists', deviceId: 'S1', vlanId: 10, points: 1 },
      {
        id: 'vn',
        type: 'vlan_name_equals',
        deviceId: 'S1',
        vlanId: 10,
        expected: 'USERS',
        points: 1,
      },
      {
        id: 'sm',
        type: 'switchport_mode_equals',
        deviceId: 'S1',
        interface: 'GigabitEthernet0/1',
        expected: 'access',
        points: 1,
      },
      {
        id: 'sv',
        type: 'switchport_access_vlan_equals',
        deviceId: 'S1',
        interface: 'GigabitEthernet0/1',
        expected: 10,
        points: 1,
      },
      { id: 'save', type: 'startup_config_saved', deviceId: 'R1', points: 1 },
      { id: 'reach', type: 'reachable', deviceId: 'R1', destination: '10.0.0.2', points: 1 },
      { id: 'route', type: 'route_exists', deviceId: 'R1', destination: '10.0.0.2', points: 1 },
      { id: 'ospf', type: 'ospf_neighbor_full', deviceId: 'R1', neighborId: 'R2', points: 1 },
      { id: 'stp', type: 'stp_root', deviceId: 'S1', vlanId: 10, points: 1 },
      { id: 'acl', type: 'acl_exists', deviceId: 'R1', name: 'EDGE', points: 1 },
      {
        id: 'nat',
        type: 'nat_static_exists',
        deviceId: 'R1',
        expectedIp: '10.0.0.1',
        destination: '203.0.113.1',
        points: 1,
      },
    ],
  };
  const parsed = parseCliLabConfig({
    labType: 'CLI_SIMULATION',
    courseId: 'course-1',
    commandProfile: 'ccna-network-v2',
    initialState: topologyState,
    gradingSpec,
  });
  assert.equal(parsed.gradingSpec.checks.length, 16);
  assert.equal(parsed.commandProfile, 'ccna-network-v2');
  assert.equal(
    gradingSpecSchema.safeParse({ checks: [{ id: 'bad', type: 'config_match', points: 1 }] })
      .success,
    false
  );
});

test('profile mismatch is explicit and topology position survives parsing', () => {
  assert.throws(
    () =>
      parseCliLabConfig({
        labType: 'CLI_SIMULATION',
        courseId: 'course-1',
        commandProfile: 'ccna-basic-v1',
        initialState: topologyState,
        gradingSpec: {
          checks: [
            { id: 'host', type: 'hostname_equals', deviceId: 'R1', expected: 'R1', points: 1 },
          ],
        },
      }),
    /không phù hợp|requires topology/i
  );

  const parsed = parseCliLabConfig({
    labType: 'CLI_SIMULATION',
    courseId: 'course-1',
    commandProfile: 'ccna-basic-v1',
    initialState: singleState,
    gradingSpec: { checks: [{ id: 'host', type: 'hostname_equals', expected: 'R1', points: 1 }] },
  });
  assert.equal(parsed.initialState.hostname, 'Router');
  assert.equal(parsed.commandProfile, 'ccna-basic-v1');
});

test('references and check-specific values are validated against the selected topology', () => {
  assert.throws(
    () =>
      parseCliLabConfig({
        labType: 'CLI_SIMULATION',
        courseId: 'course-1',
        initialState: topologyState,
        gradingSpec: {
          checks: [
            {
              id: 'bad',
              type: 'interface_enabled',
              deviceId: 'R1',
              interface: 'GigabitEthernet0/9',
              points: 1,
            },
          ],
        },
      }),
    /Unknown interface/
  );
  assert.equal(
    gradingSpecSchema.safeParse({
      checks: [
        {
          id: 'bad',
          type: 'switchport_access_vlan_equals',
          deviceId: 'S1',
          interface: 'GigabitEthernet0/1',
          expected: '10',
          points: 1,
        },
      ],
    }).success,
    false
  );
  assert.equal(
    gradingSpecSchema.safeParse({
      checks: [
        {
          id: 'bad',
          type: 'interface_ip_equals',
          deviceId: 'R1',
          interface: 'GigabitEthernet0/0',
          expectedIp: '10.0.0.1',
          points: 1,
        },
      ],
    }).success,
    false
  );
});
