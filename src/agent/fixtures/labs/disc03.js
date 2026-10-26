// Certification oracles and solutions are backend-only. Never send this module to a provider.
const endpoint = (deviceId, name = 'GigabitEthernet0/0') => ({ deviceId, interface: name });
const wire = (id, a, b) => ({ id, a, b, enabled: true });
const port = (name, ipAddress, subnetMask = '255.255.255.0') => ({
  name,
  ...(ipAddress ? { ipAddress, subnetMask } : {}),
  shutdown: false,
});
const host = (id, ip, gateway) => ({
  id,
  hostname: id,
  deviceType: 'PC',
  ...(gateway ? { defaultGateway: gateway } : {}),
  interfaces: [port('GigabitEthernet0/0', ip)],
});
const command = (deviceId, text) => ({ type: 'command', deviceId, command: text });
const configure = (deviceId, lines) =>
  ['enable', 'configure terminal', ...lines, 'end', 'disable'].map((text) =>
    command(deviceId, text)
  );
const save = (deviceId) =>
  ['enable', 'copy running-config startup-config', 'disable'].map((text) =>
    command(deviceId, text)
  );
const changePort = (deviceId, name, ...lines) =>
  configure(deviceId, [`interface ${name}`, ...lines]);
const check = (id, type, deviceId, fields = {}) => ({ id, type, deviceId, points: 10, ...fields });
const reachable = (id, deviceId, destination) => check(id, 'reachable', deviceId, { destination });
const G0 = 'GigabitEthernet0/0';
const G1 = 'GigabitEthernet0/1';
const G2 = 'GigabitEthernet0/2';
const UNUSED = 'GigabitEthernet0/3';
const TRUNK = 'GigabitEthernet0/24';

const ipv4Golden = [
  ...configure('R1', [
    `interface ${G0}`,
    'ip address 192.0.2.1 255.255.255.0',
    'no shutdown',
    'exit',
    `interface ${G1}`,
    'ip address 198.51.100.1 255.255.255.0',
    'no shutdown',
  ]),
  ...save('R1'),
];
const forward = 'ip route 198.51.100.0 255.255.255.0 203.0.113.2';
const reverse = 'ip route 192.0.2.0 255.255.255.0 203.0.113.1';
const routeGolden = [...configure('R1', [forward]), ...configure('R2', [reverse])];
const vlanGolden = ['S1', 'S2'].flatMap((id) => [
  ...configure(id, [
    'vlan 10',
    'name USERS',
    'exit',
    'vlan 20',
    'name LAB',
    'exit',
    `interface ${G1}`,
    'switchport mode access',
    'switchport access vlan 10',
    'no shutdown',
    'exit',
    `interface ${G2}`,
    'switchport mode access',
    'switchport access vlan 20',
    'no shutdown',
    'exit',
    `interface ${TRUNK}`,
    'switchport mode trunk',
    'no shutdown',
  ]),
  ...save(id),
]);

const labs = [
  {
    id: 'AI-IPV4-01',
    title: 'IPv4 và trạng thái interface',
    objective:
      'Configure R1 G0/0 as 192.0.2.1/24 and G0/1 as 198.51.100.1/24. Enable both ports, save R1, and verify PC1-PC2 reachability in both directions. Unused G0/3 has no cable and is outside the required path.',
    sources: [{ file: 'LAB-ARP-Proxy-ARP.pdf', pages: [1] }],
    limitations: ['IPv4/interface adaptation only; no Proxy ARP or router subinterfaces.'],
    initialState: {
      devices: [
        host('PC1', '192.0.2.10', '192.0.2.1'),
        {
          id: 'R1',
          hostname: 'R1',
          deviceType: 'ROUTER',
          interfaces: [G0, G1, { name: UNUSED, shutdown: true }],
        },
        host('PC2', '198.51.100.10', '198.51.100.1'),
      ],
      links: [
        wire('L1', endpoint('PC1'), endpoint('R1', G0)),
        wire('L2', endpoint('R1', G1), endpoint('PC2')),
      ],
    },
    probes: [
      { sourceId: 'PC1', destination: '198.51.100.10', success: true },
      { sourceId: 'PC2', destination: '192.0.2.10', success: true },
    ],
    gradingSpec: {
      passingScore: 100,
      checks: [
        check('lan-a-address', 'interface_ip_equals', 'R1', {
          interface: G0,
          expectedIp: '192.0.2.1',
          expectedMask: '255.255.255.0',
        }),
        check('lan-b-address', 'interface_ip_equals', 'R1', {
          interface: G1,
          expectedIp: '198.51.100.1',
          expectedMask: '255.255.255.0',
        }),
        check('lan-a-up', 'interface_enabled', 'R1', { interface: G0 }),
        check('lan-b-up', 'interface_enabled', 'R1', { interface: G1 }),
        reachable('forward-ping', 'PC1', '198.51.100.10'),
        reachable('reverse-ping', 'PC2', '192.0.2.10'),
        check('saved', 'startup_config_saved', 'R1'),
      ],
    },
    goldenActions: ipv4Golden,
    cases: [
      {
        id: 'ipv4-01',
        kind: 'correct',
        label: 'Unused interface shutdown is harmless',
        actions: [],
        unusedShutdown: true,
      },
      {
        id: 'ipv4-02',
        kind: 'correct',
        label: 'Unused uncabled interface enabled is also harmless',
        actions: changePort('R1', UNUSED, 'no shutdown'),
        unusedShutdown: false,
      },
      {
        id: 'ipv4-03',
        kind: 'fault',
        label: 'Source-side router interface shutdown',
        actions: changePort('R1', G0, 'shutdown'),
        repairActions: changePort('R1', G0, 'no shutdown'),
        failedChecks: ['lan-a-up', 'forward-ping'],
      },
      {
        id: 'ipv4-04',
        kind: 'fault',
        label: 'Destination-side router interface shutdown',
        actions: changePort('R1', G1, 'shutdown'),
        repairActions: changePort('R1', G1, 'no shutdown'),
        failedChecks: ['lan-b-up', 'forward-ping'],
      },
      {
        id: 'ipv4-05',
        kind: 'fault',
        label: 'Router address no longer matches PC gateway',
        actions: changePort('R1', G0, 'ip address 192.0.2.254 255.255.255.0'),
        repairActions: changePort('R1', G0, 'ip address 192.0.2.1 255.255.255.0'),
        failedChecks: ['lan-a-address', 'forward-ping'],
      },
      {
        id: 'ipv4-06',
        kind: 'fault',
        label: 'Router /30 excludes the PC from its connected subnet',
        actions: changePort('R1', G0, 'ip address 192.0.2.1 255.255.255.252'),
        repairActions: changePort('R1', G0, 'ip address 192.0.2.1 255.255.255.0'),
        failedChecks: ['lan-a-address', 'forward-ping'],
      },
      {
        id: 'ipv4-07',
        kind: 'fault',
        label: 'Destination LAN interface has no IP address',
        actions: changePort('R1', G1, 'no ip address'),
        repairActions: changePort('R1', G1, 'ip address 198.51.100.1 255.255.255.0'),
        failedChecks: ['lan-b-address', 'forward-ping'],
      },
      {
        id: 'ipv4-08',
        kind: 'fault',
        label: 'Required physical link disconnected',
        actions: [{ type: 'link', linkId: 'L2', enabled: false }],
        repairActions: [{ type: 'link', linkId: 'L2', enabled: true }],
        failedChecks: ['forward-ping'],
      },
    ],
  },
  {
    id: 'AI-ROUTE-01',
    title: 'Static và default route hai chiều',
    objective:
      'Connect PC1 (192.0.2.10/24) and PC2 (198.51.100.10/24) across R1-R2 (203.0.113.0/30). Specific static routes or default routes are acceptable when both request and reply succeed. Do not change the given IP addresses.',
    sources: [
      { file: 'LAB-Static-Route-AD.pdf', pages: [1, 2, 3] },
      { file: 'LAB-RIP02.pdf', pages: [1] },
    ],
    limitations: [
      'Static/default routing subset; no floating AD, RIP, source-specific ping, or failover certification.',
    ],
    initialState: {
      devices: [
        host('PC1', '192.0.2.10', '192.0.2.1'),
        {
          id: 'R1',
          hostname: 'R1',
          deviceType: 'ROUTER',
          interfaces: [
            port(G0, '192.0.2.1'),
            port(G1, '203.0.113.1', '255.255.255.252'),
            { name: UNUSED, shutdown: true },
          ],
        },
        {
          id: 'R2',
          hostname: 'R2',
          deviceType: 'ROUTER',
          interfaces: [port(G0, '203.0.113.2', '255.255.255.252'), port(G1, '198.51.100.1')],
        },
        host('PC2', '198.51.100.10', '198.51.100.1'),
      ],
      links: [
        wire('L1', endpoint('PC1'), endpoint('R1', G0)),
        wire('L2', endpoint('R1', G1), endpoint('R2', G0)),
        wire('L3', endpoint('R2', G1), endpoint('PC2')),
      ],
    },
    probes: [
      { sourceId: 'PC1', destination: '198.51.100.10', success: true },
      { sourceId: 'PC2', destination: '192.0.2.10', success: true },
    ],
    gradingSpec: {
      passingScore: 100,
      checks: [
        check('forward-route', 'route_exists', 'R1', { destination: '198.51.100.10' }),
        check('reverse-route', 'route_exists', 'R2', { destination: '192.0.2.10' }),
        reachable('forward-ping', 'PC1', '198.51.100.10'),
        reachable('reverse-ping', 'PC2', '192.0.2.10'),
      ],
    },
    goldenActions: routeGolden,
    cases: [
      {
        id: 'route-01',
        kind: 'correct',
        label: 'Specific static routes in both directions',
        actions: [],
      },
      {
        id: 'route-02',
        kind: 'correct',
        label: 'Valid default routes in both directions',
        defaultRoutes: true,
        actions: [
          ...configure('R1', [`no ${forward}`, 'ip route 0.0.0.0 0.0.0.0 203.0.113.2']),
          ...configure('R2', [`no ${reverse}`, 'ip route 0.0.0.0 0.0.0.0 203.0.113.1']),
        ],
      },
      {
        id: 'route-03',
        kind: 'fault',
        label: 'Missing forward route',
        actions: configure('R1', [`no ${forward}`]),
        repairActions: configure('R1', [forward]),
        failedChecks: ['forward-route', 'forward-ping'],
      },
      {
        id: 'route-04',
        kind: 'fault',
        label: 'Missing return route after request delivery',
        actions: configure('R2', [`no ${reverse}`]),
        repairActions: configure('R2', [reverse]),
        failedChecks: ['reverse-route', 'forward-ping'],
        requestDelivered: true,
      },
      {
        id: 'route-05',
        kind: 'fault',
        label: 'Next hop is not on a connected subnet',
        actions: configure('R1', [
          `no ${forward}`,
          'ip route 198.51.100.0 255.255.255.0 203.0.114.2',
        ]),
        repairActions: configure('R1', [
          'no ip route 198.51.100.0 255.255.255.0 203.0.114.2',
          forward,
        ]),
        failedChecks: ['forward-route', 'forward-ping'],
      },
      {
        id: 'route-06',
        kind: 'fault',
        label: 'More specific route overrides a working /24',
        actions: configure('R1', ['ip route 198.51.100.10 255.255.255.255 192.0.2.254']),
        repairActions: configure('R1', ['no ip route 198.51.100.10 255.255.255.255 192.0.2.254']),
        failedChecks: ['forward-ping'],
      },
      {
        id: 'route-07',
        kind: 'fault',
        label: 'Transit interface shutdown removes usable route',
        actions: changePort('R1', G1, 'shutdown'),
        repairActions: changePort('R1', G1, 'no shutdown'),
        failedChecks: ['forward-route', 'forward-ping'],
      },
      {
        id: 'route-08',
        kind: 'fault',
        label: 'Transit address moved to a different /30',
        actions: changePort('R2', G0, 'ip address 203.0.113.6 255.255.255.252'),
        repairActions: changePort('R2', G0, 'ip address 203.0.113.2 255.255.255.252'),
        failedChecks: ['reverse-route', 'forward-ping'],
      },
    ],
  },
  {
    id: 'AI-VLAN-01',
    title: 'VLAN access và trunk qua hai switch',
    objective:
      'Create VLANs 10 and 20 on S1/S2. G0/1 is access VLAN 10, G0/2 is access VLAN 20, and G0/24 is the inter-switch trunk. PC1-PC2 in VLAN 10 and PC3-PC4 in VLAN 20 must communicate both ways. Different VLANs stay isolated; no inter-VLAN router is present. Save both switches. VLAN names and unused uncabled G0/3 assignment are optional.',
    sources: [{ file: 'LAB-Virtual-HSRP.pdf', pages: [1] }],
    limitations: [
      'Layer-2 access/trunk subset only; no HSRP, NAT, DHCP, native VLAN, allowed-VLAN pruning, or router subinterfaces.',
    ],
    initialState: {
      devices: [
        host('PC1', '192.0.2.10'),
        host('PC2', '192.0.2.11'),
        host('PC3', '198.51.100.10'),
        host('PC4', '198.51.100.11'),
        ...['S1', 'S2'].map((id) => ({
          id,
          hostname: id,
          deviceType: 'SWITCH',
          interfaces: [G1, G2, TRUNK, { name: UNUSED, shutdown: true }],
        })),
      ],
      links: [
        wire('L1', endpoint('PC1'), endpoint('S1', G1)),
        wire('L2', endpoint('S1', TRUNK), endpoint('S2', TRUNK)),
        wire('L3', endpoint('S2', G1), endpoint('PC2')),
        wire('L4', endpoint('PC3'), endpoint('S1', G2)),
        wire('L5', endpoint('S2', G2), endpoint('PC4')),
      ],
    },
    probes: [
      { sourceId: 'PC1', destination: '192.0.2.11', success: true },
      { sourceId: 'PC2', destination: '192.0.2.10', success: true },
      { sourceId: 'PC3', destination: '198.51.100.11', success: true },
      { sourceId: 'PC4', destination: '198.51.100.10', success: true },
      { sourceId: 'PC1', destination: '198.51.100.10', success: false },
    ],
    gradingSpec: {
      passingScore: 100,
      checks: [
        ...['S1', 'S2'].flatMap((id) => [
          check(`${id}-vlan10`, 'vlan_exists', id, { vlanId: 10 }),
          check(`${id}-vlan20`, 'vlan_exists', id, { vlanId: 20 }),
          check(`${id}-access10-mode`, 'switchport_mode_equals', id, {
            interface: G1,
            expected: 'access',
          }),
          check(`${id}-access20-mode`, 'switchport_mode_equals', id, {
            interface: G2,
            expected: 'access',
          }),
          check(`${id}-access10`, 'switchport_access_vlan_equals', id, {
            interface: G1,
            expected: 10,
          }),
          check(`${id}-access20`, 'switchport_access_vlan_equals', id, {
            interface: G2,
            expected: 20,
          }),
          check(`${id}-trunk`, 'switchport_mode_equals', id, {
            interface: TRUNK,
            expected: 'trunk',
          }),
          check(`${id}-saved`, 'startup_config_saved', id),
        ]),
        reachable('vlan10-ping', 'PC1', '192.0.2.11'),
        reachable('vlan20-ping', 'PC3', '198.51.100.11'),
      ],
    },
    goldenActions: vlanGolden,
    cases: [
      {
        id: 'vlan-01',
        kind: 'correct',
        label: 'Two VLANs cross trunk; unused ports shutdown',
        actions: [],
      },
      {
        id: 'vlan-02',
        kind: 'correct',
        label: 'Different VLAN names and unused access assignment are valid',
        actions: [
          ...configure('S1', [
            'vlan 10',
            'name STAFF',
            'exit',
            `interface ${UNUSED}`,
            'switchport mode access',
            'switchport access vlan 20',
            'shutdown',
          ]),
          ...save('S1'),
        ],
      },
      {
        id: 'vlan-03',
        kind: 'fault',
        label: 'Remote VLAN10 endpoint assigned to VLAN20',
        actions: changePort('S2', G1, 'switchport access vlan 20'),
        repairActions: changePort('S2', G1, 'switchport access vlan 10'),
        failedChecks: ['S2-access10', 'vlan10-ping'],
        unaffectedProbe: { sourceId: 'PC3', destination: '198.51.100.11' },
      },
      {
        id: 'vlan-04',
        kind: 'fault',
        label: 'Local uplink accidentally access VLAN1',
        actions: changePort('S1', TRUNK, 'switchport mode access'),
        repairActions: changePort('S1', TRUNK, 'switchport mode trunk'),
        failedChecks: ['S1-trunk', 'vlan10-ping', 'vlan20-ping'],
      },
      {
        id: 'vlan-05',
        kind: 'fault',
        label: 'Remote uplink accidentally access VLAN1',
        actions: changePort('S2', TRUNK, 'switchport mode access'),
        repairActions: changePort('S2', TRUNK, 'switchport mode trunk'),
        failedChecks: ['S2-trunk', 'vlan10-ping', 'vlan20-ping'],
      },
      {
        id: 'vlan-06',
        kind: 'fault',
        label: 'Inter-switch trunk shutdown',
        actions: changePort('S1', TRUNK, 'shutdown'),
        repairActions: changePort('S1', TRUNK, 'no shutdown'),
        failedChecks: ['vlan10-ping', 'vlan20-ping'],
      },
      {
        id: 'vlan-07',
        kind: 'fault',
        label: 'VLAN20 access port shutdown',
        requestProbe: { sourceId: 'PC3', destination: '198.51.100.11' },
        actions: changePort('S2', G2, 'shutdown'),
        repairActions: changePort('S2', G2, 'no shutdown'),
        failedChecks: ['vlan20-ping'],
        unaffectedProbe: { sourceId: 'PC1', destination: '192.0.2.11' },
      },
      {
        id: 'vlan-08',
        kind: 'fault',
        label: 'Trunk cable disconnected',
        actions: [{ type: 'link', linkId: 'L2', enabled: false }],
        repairActions: [{ type: 'link', linkId: 'L2', enabled: true }],
        failedChecks: ['vlan10-ping', 'vlan20-ping'],
      },
    ],
  },
];

for (const lab of labs) {
  lab.commandProfile = 'ccna-network-v2';
  lab.simulatorVersion = '2.1.0';
}

module.exports = { labs };
