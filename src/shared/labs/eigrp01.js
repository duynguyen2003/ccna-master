const port = (name, ipAddress, subnetMask) => ({
  name,
  ipAddress,
  subnetMask,
  shutdown: false,
});

const end = (deviceId, interfaceName) => ({ deviceId, interface: interfaceName });
const link = (id, leftDevice, leftInterface, rightDevice, rightInterface) => ({
  id,
  a: end(leftDevice, leftInterface),
  b: end(rightDevice, rightInterface),
  enabled: true,
});

const initialState = {
  devices: [
    {
      id: 'R1',
      deviceType: 'ROUTER',
      hostname: 'R1',
      position: { x: 140, y: 130 },
      interfaces: [
        port('Loopback0', '1.1.1.1', '255.0.0.0'),
        port('GigabitEthernet1/12', '192.1.12.1', '255.255.255.0'),
      ],
    },
    {
      id: 'R2',
      deviceType: 'ROUTER',
      hostname: 'R2',
      position: { x: 740, y: 130 },
      interfaces: [
        port('Loopback0', '2.2.2.2', '255.0.0.0'),
        port('GigabitEthernet1/12', '192.1.12.2', '255.255.255.0'),
        port('GigabitEthernet1/23', '192.1.23.2', '255.255.255.0'),
      ],
    },
    {
      id: 'R3',
      deviceType: 'ROUTER',
      hostname: 'R3',
      position: { x: 740, y: 450 },
      interfaces: [
        port('Loopback0', '3.3.3.3', '255.0.0.0'),
        port('GigabitEthernet1/23', '192.1.23.3', '255.255.255.0'),
        port('GigabitEthernet1/34', '192.1.34.3', '255.255.255.0'),
      ],
    },
    {
      id: 'R4',
      deviceType: 'ROUTER',
      hostname: 'R4',
      position: { x: 140, y: 450 },
      interfaces: [
        port('Loopback0', '4.4.4.4', '255.0.0.0'),
        port('GigabitEthernet1/34', '192.1.34.4', '255.255.255.0'),
      ],
    },
  ],
  links: [
    link('R1-R2', 'R1', 'GigabitEthernet1/12', 'R2', 'GigabitEthernet1/12'),
    link('R2-R3', 'R2', 'GigabitEthernet1/23', 'R3', 'GigabitEthernet1/23'),
    link('R3-R4', 'R3', 'GigabitEthernet1/34', 'R4', 'GigabitEthernet1/34'),
  ],
};

const checks = [
  ...['R1', 'R2', 'R3', 'R4'].map((deviceId) => ({
    id: `eigrp-as-${deviceId.toLowerCase()}`,
    type: 'eigrp_as_configured',
    deviceId,
    asNumber: 1,
    title: `${deviceId}: bật EIGRP AS 1`,
    points: 4,
    hint: `Trên ${deviceId}, vào router eigrp 1 và khai báo các mạng connected.`,
  })),
  ...[
    ['R1', 'R2'],
    ['R2', 'R3'],
    ['R3', 'R4'],
  ].map(([deviceId, neighborId]) => ({
    id: `neighbor-${deviceId.toLowerCase()}-${neighborId.toLowerCase()}`,
    type: 'eigrp_neighbor_up',
    deviceId,
    neighborId,
    title: `${deviceId} thấy EIGRP neighbor ${neighborId}`,
    points: 8,
    hint: 'Kiểm tra AS, network statement, trạng thái interface và passive-interface.',
  })),
  {
    id: 'static-neighbor-r1',
    type: 'eigrp_static_neighbor',
    deviceId: 'R1',
    interface: 'GigabitEthernet1/12',
    neighborIp: '192.1.12.2',
    title: 'R1 dùng unicast neighbor tới R2',
    points: 8,
    hint: 'Dùng neighbor 192.1.12.2 g1/12 và bảo đảm interface không còn passive.',
  },
  {
    id: 'static-neighbor-r2',
    type: 'eigrp_static_neighbor',
    deviceId: 'R2',
    interface: 'GigabitEthernet1/12',
    neighborIp: '192.1.12.1',
    title: 'R2 dùng unicast neighbor tới R1',
    points: 8,
    hint: 'Dùng neighbor 192.1.12.1 g1/12 và bảo đảm interface không còn passive.',
  },
  ...[
    ['R1', '4.4.4.4'],
    ['R4', '1.1.1.1'],
  ].map(([deviceId, destination]) => ({
    id: `route-${deviceId.toLowerCase()}`,
    type: 'route_exists',
    deviceId,
    destination,
    title: `${deviceId} có route EIGRP tới ${destination}`,
    points: 8,
    hint: 'Dùng show ip route và tìm route mã D tới loopback đầu xa.',
  })),
  ...[
    ['R1', '4.4.4.4'],
    ['R4', '1.1.1.1'],
  ].map(([deviceId, destination]) => ({
    id: `ping-${deviceId.toLowerCase()}`,
    type: 'reachable',
    deviceId,
    destination,
    title: `${deviceId} ping được ${destination}`,
    points: 8,
    hint: 'Kiểm tra cả đường đi và đường về trong bảng định tuyến.',
  })),
  ...['R1', 'R2', 'R3', 'R4'].map((deviceId) => ({
    id: `save-${deviceId.toLowerCase()}`,
    type: 'startup_config_saved',
    deviceId,
    title: `${deviceId}: lưu running-config`,
    points: 3,
    hint: 'Dùng copy running-config startup-config hoặc write memory.',
  })),
];

const gradingSpec = { passingScore: 100, checks };

const commandsByDevice = {
  R1: [
    'enable',
    'configure terminal',
    'router eigrp 1',
    'network 1.0.0.0',
    'network 192.1.12.0',
    'neighbor 192.1.12.2 GigabitEthernet1/12',
    'no passive-interface GigabitEthernet1/12',
    'end',
    'copy running-config startup-config',
  ],
  R2: [
    'enable',
    'configure terminal',
    'router eigrp 1',
    'network 2.0.0.0',
    'network 192.1.12.0',
    'network 192.1.23.0',
    'neighbor 192.1.12.1 GigabitEthernet1/12',
    'no passive-interface GigabitEthernet1/12',
    'end',
    'copy running-config startup-config',
  ],
  R3: [
    'enable',
    'configure terminal',
    'router eigrp 1',
    'network 3.0.0.0',
    'network 192.1.23.0',
    'network 192.1.34.0',
    'end',
    'copy running-config startup-config',
  ],
  R4: [
    'enable',
    'configure terminal',
    'router eigrp 1',
    'network 4.0.0.0',
    'network 192.1.34.0',
    'end',
    'copy running-config startup-config',
  ],
};

const solutionActions = Object.entries(commandsByDevice).flatMap(([deviceId, commands]) =>
  commands.map((command) => ({ type: 'command', deviceId, command }))
);

const guideContent = `
  <h2>LAB EIGRP01 - Basic Metric Calculation</h2>
  <p>Lab gồm bốn router R1-R2-R3-R4. Hãy cấu hình EIGRP AS 1, kiểm tra route và neighbor, sau đó thử cơ chế passive-interface và static neighbor trên đoạn R1-R2.</p>
  <h3>Bảng địa chỉ đã chuẩn hóa</h3>
  <ul>
    <li>R1-R2: 192.1.12.0/24 - R1 .1, R2 .2</li>
    <li>R2-R3: 192.1.23.0/24 - R2 .2, R3 .3</li>
    <li>R3-R4: 192.1.34.0/24 - R3 .3, R4 .4</li>
    <li>Loopback: R1 1.1.1.1/8, R2 2.2.2.2/8, R3 3.3.3.3/8, R4 4.4.4.4/8</li>
  </ul>
  <p><strong>Lưu ý sửa lỗi tài liệu:</strong> các chuỗi 192.168.1.12.0/24 trên hình có năm octet nên không phải IPv4 hợp lệ. Lab dùng các mạng 192.1.x.0 đúng với phần lệnh. Dòng S0/0 cuối tài liệu được thay bằng GigabitEthernet1/12 đúng topology.</p>
  <h3>Quy trình</h3>
  <ol>
    <li>Cấu hình các network statement trên cả bốn router và dùng <code>show ip route</code>, <code>show ip eigrp neighbors</code> để xác minh.</li>
    <li>Trên R1 và R2, thử <code>passive-interface g1/12</code>. Neighbor phải mất vì EIGRP không gửi/nhận hello trên interface passive.</li>
    <li>Gỡ passive bằng <code>no passive-interface g1/12</code>, rồi cấu hình static neighbor hai chiều như yêu cầu.</li>
    <li>Ping giữa 1.1.1.1 và 4.4.4.4, sau đó lưu cấu hình trên mọi router.</li>
  </ol>
  <p>Simulator dùng metric giáo dục deterministic dựa trên bandwidth/delay mặc định của FastEthernet hoặc GigabitEthernet; dùng giá trị này để quan sát và so sánh đường đi, không thay thế toàn bộ thuật toán DUAL của IOS thật.</p>
`;

const steps = [
  {
    title: '1. Cấu hình EIGRP AS 1',
    commands: Object.entries(commandsByDevice).flatMap(([deviceId, commands]) =>
      commands
        .filter((command) => !command.startsWith('neighbor') && !command.startsWith('no passive'))
        .map((command) => `${deviceId}: ${command}`)
    ),
    note: 'Khai báo loopback và mọi mạng transit connected của từng router.',
  },
  {
    title: '2. Kiểm tra route và neighbor',
    commands: ['show ip route', 'show ip eigrp neighbors'],
    note: 'Route học qua EIGRP có mã D và administrative distance 90.',
  },
  {
    title: '3. Thử passive-interface trên R1-R2',
    commands: [
      'R1/R2: passive-interface GigabitEthernet1/12',
      'show ip eigrp neighbors',
      'R1/R2: no passive-interface GigabitEthernet1/12',
    ],
    note: 'Passive-interface làm adjacency trên đoạn R1-R2 biến mất; phải gỡ passive trước khi dựng static neighbor.',
  },
  {
    title: '4. Cấu hình static neighbor và lưu',
    commands: [
      'R1: neighbor 192.1.12.2 GigabitEthernet1/12',
      'R2: neighbor 192.1.12.1 GigabitEthernet1/12',
      'copy running-config startup-config',
    ],
    note: 'Static neighbor phải được cấu hình ở cả hai đầu trong mô hình lab này.',
  },
];

const labRecord = {
  title: 'LAB EIGRP01 - Basic Metric, Passive Interface & Neighbor',
  category: 'Routing',
  difficulty: 'MEDIUM',
  duration: '50 phút',
  objective:
    'Cấu hình EIGRP AS 1 trên topology bốn router, quan sát metric/route, kiểm chứng passive-interface, dựng static neighbor R1-R2 và xác minh kết nối đầu-cuối.',
  tools: ['CLI Simulation', 'EIGRP', 'show ip route', 'show ip eigrp neighbors'],
  steps,
  guideContent,
  status: 'PUBLISHED',
  labType: 'CLI_SIMULATION',
  simulatorVersion: '2.1.0',
  commandProfile: 'ccna-network-v2',
  initialState,
  gradingSpec,
  courseId: 'SRW',
  moduleId: null,
  fileUrl: null,
};

module.exports = {
  commandsByDevice,
  gradingSpec,
  initialState,
  labRecord,
  solutionActions,
};
