const port = (name, ip) => ({
  name,
  shutdown: false,
  ...(ip ? { ipAddress: ip, subnetMask: '255.255.255.0' } : {}),
});
const endpoint = (deviceId, name) => ({ deviceId, interface: name });
export const networkTemplate = {
  devices: [
    {
      id: 'PC1',
      hostname: 'PC1',
      deviceType: 'PC',
      position: { x: 100, y: 280 },
      interfaces: [port('GigabitEthernet0/0', '192.168.1.10')],
    },
    {
      id: 'R1',
      hostname: 'R1',
      deviceType: 'ROUTER',
      position: { x: 360, y: 280 },
      interfaces: [
        port('GigabitEthernet0/0', '192.168.1.1'),
        port('GigabitEthernet0/1', '10.0.0.1'),
      ],
    },
    {
      id: 'R2',
      hostname: 'R2',
      deviceType: 'ROUTER',
      position: { x: 640, y: 280 },
      interfaces: [
        port('GigabitEthernet0/0', '10.0.0.2'),
        port('GigabitEthernet0/1', '192.168.2.1'),
      ],
    },
    {
      id: 'PC2',
      hostname: 'PC2',
      deviceType: 'PC',
      position: { x: 900, y: 280 },
      interfaces: [port('GigabitEthernet0/0', '192.168.2.10')],
    },
  ],
  links: [
    {
      id: 'LAN1',
      a: endpoint('PC1', 'GigabitEthernet0/0'),
      b: endpoint('R1', 'GigabitEthernet0/0'),
      enabled: true,
    },
    {
      id: 'WAN',
      a: endpoint('R1', 'GigabitEthernet0/1'),
      b: endpoint('R2', 'GigabitEthernet0/0'),
      enabled: true,
    },
    {
      id: 'LAN2',
      a: endpoint('R2', 'GigabitEthernet0/1'),
      b: endpoint('PC2', 'GigabitEthernet0/0'),
      enabled: true,
    },
  ],
};
export const networkGradingTemplate = {
  passingScore: 100,
  checks: [
    {
      id: 'forward',
      type: 'reachable',
      deviceId: 'PC1',
      destination: '192.168.2.10',
      title: 'PC1 ping được PC2',
      points: 50,
      hint: 'Kiểm tra gateway trên PC và route trên cả hai router.',
    },
    {
      id: 'backward',
      type: 'reachable',
      deviceId: 'PC2',
      destination: '192.168.1.10',
      title: 'PC2 ping được PC1',
      points: 50,
    },
  ],
};

const switchPort = (name) => ({
  name,
  shutdown: false,
  ipAddress: null,
  subnetMask: null,
  switchportMode: 'access',
  accessVlan: 10,
});

export const switchThreePcTemplate = {
  devices: [
    {
      id: 'SW1',
      hostname: 'SW1',
      deviceType: 'SWITCH',
      position: { x: 500, y: 280 },
      interfaces: [
        switchPort('GigabitEthernet0/1'),
        switchPort('GigabitEthernet0/2'),
        switchPort('GigabitEthernet0/3'),
      ],
    },
    {
      id: 'PC1',
      hostname: 'PC1',
      deviceType: 'PC',
      position: { x: 140, y: 120 },
      interfaces: [port('GigabitEthernet0/0', '192.168.10.11')],
    },
    {
      id: 'PC2',
      hostname: 'PC2',
      deviceType: 'PC',
      position: { x: 140, y: 280 },
      interfaces: [port('GigabitEthernet0/0', '192.168.10.12')],
    },
    {
      id: 'PC3',
      hostname: 'PC3',
      deviceType: 'PC',
      position: { x: 140, y: 440 },
      interfaces: [port('GigabitEthernet0/0', '192.168.10.13')],
    },
  ],
  links: [
    {
      id: 'PC1-SW1',
      a: endpoint('PC1', 'GigabitEthernet0/0'),
      b: endpoint('SW1', 'GigabitEthernet0/1'),
      enabled: true,
    },
    {
      id: 'PC2-SW1',
      a: endpoint('PC2', 'GigabitEthernet0/0'),
      b: endpoint('SW1', 'GigabitEthernet0/2'),
      enabled: true,
    },
    {
      id: 'PC3-SW1',
      a: endpoint('PC3', 'GigabitEthernet0/0'),
      b: endpoint('SW1', 'GigabitEthernet0/3'),
      enabled: true,
    },
  ],
};

export const switchThreePcGradingTemplate = {
  passingScore: 100,
  checks: [
    {
      id: 'vlan10',
      type: 'vlan_exists',
      deviceId: 'SW1',
      vlanId: 10,
      title: 'Tạo VLAN 10',
      points: 35,
      hint: 'Dùng vlan 10 trong global configuration mode.',
    },
    {
      id: 'access-port',
      type: 'switchport_access_vlan_equals',
      deviceId: 'SW1',
      interface: 'GigabitEthernet0/1',
      expected: 10,
      title: 'Gán cổng Gi0/1 vào VLAN 10',
      points: 35,
    },
    {
      id: 'pc-reachability',
      type: 'reachable',
      deviceId: 'PC1',
      destination: '192.168.10.12',
      title: 'PC1 ping được PC2',
      points: 30,
    },
  ],
};

export const networkLabTemplates = [
  {
    id: 'two-routers',
    title: '2 router kết nối trực tiếp',
    description: 'Hai router nối qua WAN, mỗi router có một PC LAN.',
    commandProfile: 'ccna-network-v2',
    initialState: networkTemplate,
    gradingSpec: networkGradingTemplate,
  },
  {
    id: 'switch-three-pc',
    title: '1 switch + 3 PC',
    description: 'Một switch access kết nối ba PC cùng VLAN.',
    commandProfile: 'ccna-network-v2',
    initialState: switchThreePcTemplate,
    gradingSpec: switchThreePcGradingTemplate,
  },
];

export const NETWORK_LAB_TEMPLATES = networkLabTemplates;
export const twoRouterTemplate = networkLabTemplates[0];
export const switchAndThreePcTemplate = networkLabTemplates[1];
