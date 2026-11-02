const { networkAddress, wildcard, prefixLength } = require('../labDefinition');
const actions = (deviceId, commands) =>
  commands.map((command) => ({ type: 'command', deviceId, command }));

function buildEigrpLab(topology) {
  const initialState = { ...JSON.parse(JSON.stringify(topology)), simulatorVersion: '3.0.0' };
  const devices = initialState.devices;
  const ids = devices.map((d) => d.id);
  const device = (id) => devices.find((d) => d.id === id);
  const loopback = (id) => device(id).interfaces.find((p) => p.name.startsWith('Loopback'));
  const firstLink = initialState.links.find((link) =>
    [link.a.deviceId, link.b.deviceId].includes('R1')
  );
  const endpoints = [firstLink.a, firstLink.b];
  const peerFor = (id) => endpoints.find((e) => e.deviceId !== id);
  const endpointFor = (id) => endpoints.find((e) => e.deviceId === id);
  const portFor = (end) => device(end.deviceId).interfaces.find((p) => p.name === end.interface);
  const transitIds = endpoints.map((e) => e.deviceId);
  const configure = (id, commands) => actions(id, ['configure terminal', ...commands, 'end']);
  const inRouter = (id, commands) => configure(id, ['router eigrp 1', ...commands]);
  const exercise = { metric: 133888, delayUnits: 11 };
  const stages = [
    {
      id: 'configure',
      title: 'Cấu hình EIGRP AS 1',
      actions: devices.flatMap((d) =>
        actions(d.id, [
          'enable',
          'configure terminal',
          'router eigrp 1',
          ...d.interfaces.map(
            (p) => `network ${networkAddress(p.ipAddress, p.subnetMask)} ${wildcard(p.subnetMask)}`
          ),
          'end',
        ])
      ),
    },
    {
      id: 'verify',
      title: 'Kiểm tra route, neighbor và metric ban đầu',
      actions: ids.flatMap((id) =>
        actions(id, ['show ip route', 'show ip eigrp neighbors', 'show ip eigrp topology'])
      ),
    },
    ...transitIds.map((id) => ({
      id: `passive-${id.toLowerCase()}`,
      title: `${id}: quan sát passive và khôi phục neighbor`,
      actions: [
        ...inRouter(id, [`passive-interface ${endpointFor(id).interface}`]),
        ...actions(id, ['show ip eigrp neighbors']),
        ...inRouter(id, [`no passive-interface ${endpointFor(id).interface}`]),
        ...actions(id, ['show ip eigrp neighbors']),
      ],
    })),
    {
      id: 'static',
      title: 'Cấu hình unicast neighbor hai chiều',
      actions: transitIds.flatMap((id) =>
        inRouter(id, [`neighbor ${portFor(peerFor(id)).ipAddress} ${endpointFor(id).interface}`])
      ),
    },
    {
      id: 'metric',
      title: 'Điều chỉnh delay và kiểm chứng FD',
      note: `Giữ bandwidth mặc định. Tìm delay của cổng ra R1 để FD tới loopback R4 bằng ${exercise.metric}.`,
      actions: [
        ...configure('R1', [
          `interface ${endpointFor('R1').interface}`,
          `delay ${exercise.delayUnits}`,
        ]),
        ...actions('R1', ['show ip eigrp topology']),
      ],
    },
    {
      id: 'save',
      title: 'Kiểm tra kết nối và lưu cấu hình',
      actions: [
        ...actions('R1', [`ping ${loopback('R4').ipAddress}`]),
        ...actions('R4', [`ping ${loopback('R1').ipAddress}`]),
        ...ids.flatMap((id) => actions(id, ['copy running-config startup-config'])),
      ],
    },
  ];
  const stepFor = ({ actions: stageActions, ...stage }) => ({
    ...stage,
    commands: stageActions.map(({ deviceId, command }) => ({ deviceId, command })),
  });
  const solutionActions = stages.flatMap((stage) => stage.actions);
  const commandsByDevice = Object.fromEntries(
    ids.map((id) => [id, solutionActions.filter((a) => a.deviceId === id).map((a) => a.command)])
  );
  const check = (value, objective, skill, hints) => ({
    ...value,
    required: true,
    objective,
    skill,
    hints,
  });
  const checks = [
    ...ids.map((id) =>
      check(
        {
          id: `eigrp-as-${id.toLowerCase()}`,
          type: 'eigrp_as_configured',
          deviceId: id,
          asNumber: 1,
          title: `${id}: bật EIGRP AS 1`,
          points: 2.8,
        },
        'eigrp-config',
        'configuration',
        ['Các router cần cùng AS.', 'Kiểm tra routing process.', 'router eigrp 1']
      )
    ),
    ...initialState.links.map((link) =>
      check(
        {
          id: `neighbor-${link.a.deviceId.toLowerCase()}-${link.b.deviceId.toLowerCase()}`,
          type: 'eigrp_neighbor_up',
          deviceId: link.a.deviceId,
          neighborId: link.b.deviceId,
          title: `${link.a.deviceId} thấy neighbor ${link.b.deviceId}`,
          points: 5.6,
        },
        'adjacency',
        'verification',
        [
          'Hello cần đi được hai chiều.',
          'Kiểm tra network statement và passive.',
          'show ip eigrp neighbors',
        ]
      )
    ),
    ...transitIds.map((id) =>
      check(
        {
          id: `static-neighbor-${id.toLowerCase()}`,
          type: 'eigrp_static_neighbor',
          deviceId: id,
          interface: endpointFor(id).interface,
          neighborIp: portFor(peerFor(id)).ipAddress,
          title: `${id}: unicast neighbor`,
          points: 5.6,
        },
        'static-neighbor',
        'configuration',
        [
          'Unicast neighbor phải cấu hình ở cả hai đầu.',
          'Dùng địa chỉ peer trên đoạn nối trực tiếp.',
          `neighbor ${portFor(peerFor(id)).ipAddress} ${endpointFor(id).interface}`,
        ]
      )
    ),
    ...[
      ['R1', 'R4'],
      ['R4', 'R1'],
    ].flatMap(([id, remote]) => [
      check(
        {
          id: `route-${id.toLowerCase()}`,
          type: 'route_exists',
          deviceId: id,
          destination: loopback(remote).ipAddress,
          protocol: 'D',
          source: 'learned',
          title: `${id}: học route EIGRP tới ${remote}`,
          points: 2.8,
        },
        'routing',
        'verification',
        [
          'Mạng đích phải được tham gia EIGRP.',
          `Kiểm tra loopback ${remote}.`,
          'show ip eigrp topology',
        ]
      ),
      check(
        {
          id: `forwarding-${id.toLowerCase()}`,
          type: 'route_exists',
          deviceId: id,
          destination: loopback(remote).ipAddress,
          protocol: 'D',
          source: 'selected',
          dependsOn: [`route-${id.toLowerCase()}`],
          title: `${id}: chọn route EIGRP tới ${remote}`,
          points: 2.8,
        },
        'routing',
        'verification',
        [
          'Router chọn theo prefix, AD rồi metric.',
          'Tìm static route đang thay EIGRP.',
          'show ip route',
        ]
      ),
      check(
        {
          id: `ping-${id.toLowerCase()}`,
          type: 'reachable',
          deviceId: id,
          destination: loopback(remote).ipAddress,
          protocol: 'D',
          dependsOn: ['forwarding-r1', 'forwarding-r4'],
          title: `${id}: ping ${remote} qua EIGRP`,
          points: 5.6,
        },
        'reachability',
        'verification',
        [
          'Cần cả đường đi và về.',
          'Kiểm tra từng router trung gian.',
          `ping ${loopback(remote).ipAddress}`,
        ]
      ),
    ]),
    ...ids.map((id) =>
      check(
        {
          id: `save-${id.toLowerCase()}`,
          type: 'startup_config_saved',
          deviceId: id,
          matchesRunning: true,
          title: `${id}: lưu cấu hình hiện tại`,
          points: 2.1,
        },
        'persistence',
        'configuration',
        [
          'Thay đổi cần được lưu để tồn tại sau khởi động.',
          'Lưu lại sau lần sửa cuối.',
          'copy running-config startup-config',
        ]
      )
    ),
    ...transitIds.map((id) =>
      check(
        {
          id: `passive-${id.toLowerCase()}`,
          type: 'eigrp_passive_observed',
          deviceId: id,
          interface: endpointFor(id).interface,
          title: `${id}: quan sát neighbor mất và phục hồi do passive`,
          points: 5,
        },
        'passive-observation',
        'observation',
        [
          'Passive dừng trao đổi hello trên interface.',
          'Quan sát neighbors sau khi bật và sau khi gỡ passive.',
          `passive-interface ${endpointFor(id).interface}; sau đó no passive-interface và kiểm tra bằng show ip eigrp neighbors`,
        ]
      )
    ),
    {
      ...check(
        {
          id: 'metric-r1',
          type: 'eigrp_metric_exercise',
          deviceId: 'R1',
          interface: endpointFor('R1').interface,
          destination: loopback('R4').ipAddress,
          expectedMetric: exercise.metric,
          expectedDelayMicroseconds: exercise.delayUnits * 10,
          title: `R1: điều chỉnh delay để FD tới loopback R4 bằng ${exercise.metric}`,
          points: 20,
        },
        'metric-calculation',
        'reasoning',
        [
          'Classic metric dùng bandwidth nhỏ nhất và tổng delay.',
          `FD/256 = ${exercise.metric / 256}; tính bandwidth nhỏ nhất rồi suy ra delay còn thiếu.`,
          `interface ${endpointFor('R1').interface}, delay ${exercise.delayUnits} (đơn vị 10 µs)`,
        ]
      ),
      required: false,
    },
  ];
  const gradingSpec = { policyVersion: 3, passingScore: 80, masteryScore: 100, checks };
  const table = devices
    .flatMap((d) =>
      d.interfaces.map(
        (p) => `| ${d.id} | ${p.name} | ${p.ipAddress}/${prefixLength(p.subnetMask)} |`
      )
    )
    .join('\n');
  const guideContent = `# EIGRP: metric, passive và unicast neighbor\n\nCấu hình AS 1 trên bốn router. Hoàn thành mục tiêu thực hành để đạt bài; giải bài metric để đạt thành thạo.\n\n## Địa chỉ\n\n| Router | Interface | Địa chỉ |\n| --- | --- | --- |\n${table}\n\n## Metric classic\n\nVới K mặc định: metric = 256 × (floor(10^7/min bandwidth kbps) + floor(tổng delay µs/10)). GigabitEthernet: 1000000 kbps, 10 µs; FastEthernet: 100000 kbps, 100 µs; Serial T1: 1544 kbps, 20000 µs; Loopback: 8000000 kbps, 5000 µs. Đây là bộ mặc định cố định của simulator.\n\nDùng show ip eigrp topology để xem FD/RD tại trạng thái hội tụ. Simulator tính đường đi ổn định, không mô phỏng toàn bộ trạng thái lịch sử của DUAL.\n\n## Bài thực hành\n\n1. Khai báo các interface vào EIGRP và kiểm tra neighbors/routes.\n2. Lần lượt trên ${transitIds.join(' và ')}, bật passive, kiểm tra neighbor mất, gỡ passive và kiểm tra neighbor trở lại.\n3. Cấu hình unicast neighbor hai chiều.\n4. Giữ bandwidth mặc định; tìm delay cổng ra R1 để FD tới ${loopback('R4').ipAddress} bằng 133888.\n5. Ping hai chiều rồi lưu mọi router.\n\nGợi ý mở theo ba mức, không trừ điểm. Chỉ chép phần lệnh; chọn đúng thiết bị được ghi bên cạnh.\n`;
  const labRecord = {
    title: 'LAB EIGRP01 - Classic Metric, Passive Interface & Neighbor',
    category: 'Routing',
    difficulty: 'MEDIUM',
    schemaVersion: 2,
    labKey: 'eigrp01',
    labVersion: 3,
    contentSource: 'REPOSITORY',
    durationMinutes: 50,
    duration: '50 phút',
    topics: ['Routing', 'EIGRP', 'Classic metric', 'Verification'],
    guideFormat: 'markdown',
    objective: 'Cấu hình EIGRP, kiểm chứng passive/unicast neighbor và tính metric classic.',
    tools: ['CLI Simulation'],
    steps: stages.map(stepFor),
    guideContent,
    status: 'PUBLISHED',
    labType: 'CLI_SIMULATION',
    simulatorVersion: '3.0.0',
    commandProfile: 'ccna-network-v2',
    initialState,
    gradingSpec,
    courseId: 'SRW',
    moduleId: null,
    fileUrl: null,
  };
  const omitStages = (...excluded) =>
    stages.filter((stage) => !excluded.includes(stage.id)).flatMap((stage) => stage.actions);
  const cases = [
    { id: 'solution', actions: solutionActions, expected: { passed: true, score: 100 } },
    {
      id: 'without-metric',
      actions: omitStages('metric'),
      expected: { passed: true, score: 80, failedChecks: ['metric-r1'] },
    },
    {
      id: 'passive-not-restored',
      actions: [
        ...solutionActions,
        ...inRouter('R1', [`passive-interface ${endpointFor('R1').interface}`]),
        ...actions('R1', ['write memory']),
      ],
      expected: {
        passed: false,
        failedChecks: ['neighbor-r1-r2'],
        blockedChecks: ['ping-r1', 'ping-r4'],
      },
    },
    {
      id: 'missing-static-neighbors',
      actions: omitStages('static'),
      expected: {
        passed: false,
        score: 89,
        failedChecks: ['static-neighbor-r1', 'static-neighbor-r2'],
      },
    },
    {
      id: 'stale-startup-config',
      actions: [...solutionActions, ...configure('R1', ['hostname Changed'])],
      expected: { passed: false, failedChecks: ['save-r1'] },
    },
    {
      id: 'without-saving',
      actions: solutionActions.filter((a) => a.command !== 'copy running-config startup-config'),
      expected: { passed: false, failedChecks: ids.map((id) => `save-${id.toLowerCase()}`) },
    },
    {
      id: 'shutdown-is-not-passive',
      actions: [],
      expected: { passed: false, failedChecks: ['passive-r1', 'passive-r2'] },
    },
    {
      id: 'host-wildcards',
      actions: solutionActions.map((a) => {
        if (!a.command.startsWith('network ')) return a;
        const [, net] = a.command.split(' ');
        const port = device(a.deviceId).interfaces.find(
          (p) => networkAddress(p.ipAddress, p.subnetMask) === net
        );
        return { ...a, command: `network ${port.ipAddress} 0.0.0.0` };
      }),
      expected: { passed: true, score: 100 },
    },
  ];
  const nextHopTo = (source, target) => {
    const queue = [{ id: source, first: null }];
    const seen = new Set([source]);
    while (queue.length) {
      const current = queue.shift();
      if (current.id === target) return portFor(current.first).ipAddress;
      for (const link of initialState.links) {
        const peer =
          link.a.deviceId === current.id ? link.b : link.b.deviceId === current.id ? link.a : null;
        if (!peer || seen.has(peer.deviceId)) continue;
        seen.add(peer.deviceId);
        queue.push({ id: peer.deviceId, first: current.first || peer });
      }
    }
    throw new Error('Disconnected certification topology');
  };
  const staticOnly = devices.flatMap((d) => {
    const local = new Set(
      d.interfaces.map((p) => `${networkAddress(p.ipAddress, p.subnetMask)}/${p.subnetMask}`)
    );
    const routes = devices
      .filter((other) => other.id !== d.id)
      .flatMap((other) =>
        other.interfaces.flatMap((p) => {
          const network = networkAddress(p.ipAddress, p.subnetMask);
          return local.has(`${network}/${p.subnetMask}`)
            ? []
            : [`ip route ${network} ${p.subnetMask} ${nextHopTo(d.id, other.id)}`];
        })
      );
    return actions(d.id, [
      'enable',
      'configure terminal',
      ...new Set(routes),
      'end',
      'write memory',
    ]);
  });
  cases.push({
    id: 'static-only',
    actions: staticOnly,
    expected: {
      passed: false,
      failedChecks: ['route-r1', 'route-r4'],
      blockedChecks: ['ping-r1', 'ping-r4'],
      reachable: [
        { deviceId: 'R1', destination: loopback('R4').ipAddress },
        { deviceId: 'R4', destination: loopback('R1').ipAddress },
      ],
    },
  });
  // An actual shutdown/no shutdown transition must not certify the passive exercise.
  cases.find((c) => c.id === 'shutdown-is-not-passive').actions = stages.flatMap((stage) =>
    stage.id.startsWith('passive-')
      ? (() => {
          const id = stage.actions[0].deviceId;
          return [
            ...configure(id, [`interface ${endpointFor(id).interface}`, 'shutdown']),
            ...actions(id, ['show ip eigrp neighbors']),
            ...configure(id, [`interface ${endpointFor(id).interface}`, 'no shutdown']),
            ...actions(id, ['show ip eigrp neighbors']),
          ];
        })()
      : stage.actions
  );
  return {
    initialState,
    gradingSpec,
    labRecord,
    stages,
    solutionActions,
    commandsByDevice,
    scenarios: cases,
  };
}
module.exports = { buildEigrpLab };
