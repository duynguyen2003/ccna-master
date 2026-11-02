const device = (id, index, position) => ({
  id,
  hostname: id,
  deviceType: index % 4 === 0 ? 'PC' : index % 4 === 1 ? 'SWITCH' : 'ROUTER',
  position,
  interfaces: [],
});
const graph = (id, title, points, pairs) => {
  const devices = points.map((p, i) => device(`N${i + 1}`, i, { x: p[0], y: p[1] }));
  const links = pairs.map(([a, b], i) => {
    const from = devices[a],
      to = devices[b];
    const pa = `GigabitEthernet0/${from.interfaces.length}`,
      pb = `GigabitEthernet0/${to.interfaces.length}`;
    from.interfaces.push({
      name: pa,
      ipAddress: `10.0.${i}.1`,
      subnetMask: '255.255.255.252',
      shutdown: false,
    });
    to.interfaces.push({
      name: pb,
      ipAddress: `10.0.${i}.2`,
      subnetMask: '255.255.255.252',
      shutdown: false,
    });
    return {
      id: `L${i + 1}`,
      a: { deviceId: from.id, interface: pa },
      b: { deviceId: to.id, interface: pb },
      enabled: true,
    };
  });
  return { id, title, devices, links };
};
const chain = (n) => Array.from({ length: n - 1 }, (_, i) => [i, i + 1]);
const circle = (n, r = 260) =>
  Array.from({ length: n }, (_, i) => [
    400 + Math.cos((i * Math.PI * 2) / n) * r,
    350 + Math.sin((i * Math.PI * 2) / n) * r,
  ]);
const grid = Array.from({ length: 12 }, (_, i) => [
  100 + (i % 4) * 220,
  100 + Math.floor(i / 4) * 180,
]);
const gridEdges = [];
for (let i = 0; i < 12; i++) {
  if (i % 4 < 3) gridEdges.push([i, i + 1]);
  if (i + 4 < 12) gridEdges.push([i, i + 4]);
}
const scenarios = [
  graph('empty', 'Không có thiết bị', [], []),
  graph('single', 'Một thiết bị', [[100, 100]], []),
  graph(
    'eigrp-chain',
    'Chuỗi 4 thiết bị',
    Array.from({ length: 4 }, (_, i) => [100 + i * 220, 100]),
    chain(4)
  ),
  graph(
    'long-chain',
    'Chuỗi 10 thiết bị',
    Array.from({ length: 10 }, (_, i) => [100 + i * 180, 100]),
    chain(10)
  ),
  graph(
    'two-rows',
    'Chuỗi bố trí hai hàng',
    Array.from({ length: 8 }, (_, i) => [100 + (i < 4 ? i : 7 - i) * 200, i < 4 ? 100 : 320]),
    chain(8)
  ),
  graph('grid-12', 'Lưới 12 thiết bị / 17 dây', grid, gridEdges),
  graph(
    'star-9',
    'Hình sao 9 thiết bị',
    [[400, 350], ...circle(8)],
    Array.from({ length: 8 }, (_, i) => [0, i + 1])
  ),
  graph('ring-8', 'Vòng 8 thiết bị', circle(8), [...chain(8), [7, 0]]),
  graph(
    'mesh-6',
    'Mesh 6 thiết bị / 15 dây',
    circle(6),
    Array.from({ length: 6 }, (_, a) =>
      Array.from({ length: 5 - a }, (_, i) => [a, a + i + 1])
    ).flat()
  ),
  graph('disconnected', 'Nhiều nhóm rời nhau', grid.slice(0, 8), [
    [0, 1],
    [1, 2],
    [4, 5],
    [6, 7],
  ]),
  graph(
    'overlapping-input',
    'Tám vị trí trùng nhau',
    Array.from({ length: 8 }, () => [100, 100]),
    [
      [0, 1],
      [0, 2],
      [1, 3],
      [4, 5],
      [6, 7],
    ]
  ),
  graph(
    'parallel',
    'Ba dây giữa hai router',
    [
      [100, 200],
      [500, 200],
    ],
    [
      [0, 1],
      [0, 1],
      [0, 1],
    ]
  ),
  graph(
    'vertical',
    'Dây dọc',
    [
      [300, 100],
      [300, 320],
      [300, 540],
    ],
    chain(3)
  ),
  graph('long-names', 'Tên dài và subnet dài', grid.slice(0, 6), [
    [0, 1],
    [1, 2],
    [2, 3],
    [0, 4],
    [1, 5],
  ]),
  graph(
    'down-stp',
    'Dây ngắt và STP',
    [
      [100, 100],
      [400, 100],
      [250, 360],
    ],
    [
      [0, 1],
      [1, 2],
      [2, 0],
    ]
  ),
];
const names = scenarios.find((s) => s.id === 'long-names');
names.devices[0].hostname = 'access-switch-floor-02-east-wing';
names.devices[2].hostname = 'router-chi-nhanh-ho-chi-minh';
names.links.forEach((link, index) =>
  [link.a, link.b].forEach((endpoint, side) => {
    const port = names.devices
      .find((d) => d.id === endpoint.deviceId)
      .interfaces.find((p) => p.name === endpoint.interface);
    port.ipAddress = `192.168.${120 + index}.${side + 1}`;
    port.subnetMask = '255.255.255.0';
  })
);
const oldId = names.devices[3].id;
names.devices[3].id = 'CORE-ROUTER-HO-CHI-MINH-02';
names.links.forEach((link) =>
  [link.a, link.b].forEach((endpoint) => {
    if (endpoint.deviceId === oldId) endpoint.deviceId = names.devices[3].id;
  })
);
scenarios
  .find((s) => s.id === 'parallel')
  .devices.forEach((device) => {
    device.deviceType = 'ROUTER';
  });
const states = scenarios.find((s) => s.id === 'down-stp');
states.links[0].enabled = false;
states.stp = {
  vlan1: {
    ports: { [`${states.links[1].a.deviceId}:${states.links[1].a.interface}`]: 'BLOCKING' },
  },
};
export const topologyScenarios = scenarios;
