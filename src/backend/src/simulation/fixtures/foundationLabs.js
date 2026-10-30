const port = (shutdown, ipAddress) => ({
  name: 'GigabitEthernet0/0',
  shutdown,
  ...(ipAddress ? { ipAddress, subnetMask: '255.255.255.0' } : {}),
});
const initialState = (ip) => ({
  devices: [
    {
      id: 'PC1',
      deviceType: 'PC',
      hostname: 'PC1',
      position: { x: 100, y: 140 },
      interfaces: [port(false, '192.0.2.10')],
    },
    {
      id: 'R1',
      deviceType: 'ROUTER',
      hostname: 'Router',
      position: { x: 400, y: 140 },
      interfaces: [port(true, ip)],
    },
  ],
  links: [
    {
      id: 'PC1_R1',
      a: { deviceId: 'PC1', interface: 'GigabitEthernet0/0' },
      b: { deviceId: 'R1', interface: 'GigabitEthernet0/0' },
      enabled: true,
    },
  ],
});
const actions = (lines) =>
  ['enable', 'configure terminal', ...lines, 'end'].map((command) => ({
    type: 'command',
    deviceId: 'R1',
    command,
  }));
const shared = {
  category: 'Routing',
  difficulty: 'EASY',
  labType: 'CLI_SIMULATION',
  commandProfile: 'ccna-network-v2',
  simulatorVersion: '2.1.0',
  tools: ['CLI Web'],
  status: 'PUBLISHED',
};
const labs = [
  {
    key: 'itn-foundation-01',
    data: {
      ...shared,
      title: 'ITN 01 - Nhận diện thiết bị và bật cổng kết nối',
      duration: '10 phút',
      objective:
        'Đặt tên router thành R1, bật cổng GigabitEthernet0/0 và xác minh PC1 liên lạc được với router.',
      initialState: initialState('192.0.2.1'),
      guideContent:
        '<h3>Thiết bị và liên kết</h3><p>PC1 nối trực tiếp với cổng GigabitEthernet0/0 của router. Hai địa chỉ IPv4 đã được chuẩn bị sẵn; cổng router đang tắt.</p><ol><li>Chọn router. Gõ <code>enable</code> để vào chế độ đặc quyền.</li><li>Gõ <code>configure terminal</code>, rồi <code>hostname R1</code>.</li><li>Gõ <code>interface GigabitEthernet0/0</code>, rồi <code>no shutdown</code>.</li><li>Gõ <code>end</code> và <code>show ip interface brief</code> để kiểm tra cổng.</li><li>Chọn PC1, gõ <code>ping 192.0.2.1</code>, sau đó nộp bài.</li></ol>',
      gradingSpec: {
        passingScore: 100,
        checks: [
          {
            id: 'name',
            title: 'Đặt tên router',
            type: 'hostname_equals',
            deviceId: 'R1',
            expected: 'R1',
            points: 40,
          },
          {
            id: 'port',
            title: 'Bật cổng nối với PC1',
            type: 'interface_enabled',
            deviceId: 'R1',
            interface: 'GigabitEthernet0/0',
            points: 30,
          },
          {
            id: 'ping',
            title: 'PC1 liên lạc được với router',
            type: 'reachable',
            deviceId: 'PC1',
            destination: '192.0.2.1',
            points: 30,
          },
        ],
      },
    },
    policy: (lessonId) => ({
      mode: 'LESSONS',
      lessonIds: [lessonId],
      requiredForCompletion: false,
    }),
    solution: actions(['hostname R1', 'interface GigabitEthernet0/0', 'no shutdown']),
  },
  {
    key: 'itn-foundation-02',
    data: {
      ...shared,
      title: 'ITN 02 - Cấu hình IPv4 và kiểm tra ping',
      duration: '15 phút',
      objective: 'Gán 192.0.2.1/24 cho cổng router nối PC1, bật cổng và kiểm tra ping từ PC1.',
      initialState: initialState(),
      guideContent:
        '<h3>Tự luyện IPv4</h3><p>PC1 có địa chỉ 192.0.2.10 với subnet mask 255.255.255.0. Router cần địa chỉ 192.0.2.1 với cùng subnet mask trên cổng nối PC1. Đây là dải địa chỉ dùng cho bài tập.</p><ol><li>Chọn R1, gõ <code>enable</code> và <code>configure terminal</code>.</li><li>Gõ <code>interface GigabitEthernet0/0</code>.</li><li>Gõ <code>ip address 192.0.2.1 255.255.255.0</code>, rồi <code>no shutdown</code>.</li><li>Gõ <code>end</code>, sau đó <code>show ip interface brief</code>.</li><li>Chọn PC1, gõ <code>ping 192.0.2.1</code>. Kiểm tra lại IP, mask và trạng thái cổng nếu ping thất bại, rồi nộp bài.</li></ol>',
      gradingSpec: {
        passingScore: 100,
        checks: [
          {
            id: 'ip',
            title: 'Gán địa chỉ IPv4 cho router',
            type: 'interface_ip_equals',
            deviceId: 'R1',
            interface: 'GigabitEthernet0/0',
            expectedIp: '192.0.2.1',
            expectedMask: '255.255.255.0',
            points: 50,
          },
          {
            id: 'port',
            title: 'Bật cổng GigabitEthernet0/0',
            type: 'interface_enabled',
            deviceId: 'R1',
            interface: 'GigabitEthernet0/0',
            points: 30,
          },
          {
            id: 'ping',
            title: 'Ping từ PC1 thành công',
            type: 'reachable',
            deviceId: 'PC1',
            destination: '192.0.2.1',
            points: 20,
          },
        ],
      },
    },
    policy: () => ({ mode: 'OPEN', lessonIds: [], requiredForCompletion: false }),
    solution: actions([
      'interface GigabitEthernet0/0',
      'ip address 192.0.2.1 255.255.255.0',
      'no shutdown',
    ]),
  },
];
module.exports = { labs };
