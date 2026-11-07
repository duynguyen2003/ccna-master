import { devicePort, layoutTopology, shortPort } from './topologyLayout';

const devices = ['R1', 'R3', 'R2', 'R4'].map((id, index) => ({
  id,
  position: { x: 100 + index * 70, y: index % 2 ? 180 : 90 },
}));
const links = ['R1:R2', 'R2:R3', 'R3:R4'].map((pair) => {
  const [a, b] = pair.split(':');
  return { a: { deviceId: a }, b: { deviceId: b } };
});

test('fit follows physical links instead of array order and keeps diagram units in CSS pixels', () => {
  const narrow = layoutTopology(devices, links, { width: 600, height: 210 }, true);
  const wide = layoutTopology(devices, links, { width: 1400, height: 210 }, true);
  expect(narrow.viewBox).toBe('0 0 600 210');
  expect(wide.viewBox).toBe('0 0 1400 210');
  for (const [a, b] of [
    ['R1', 'R2'],
    ['R2', 'R3'],
    ['R3', 'R4'],
  ]) {
    expect(narrow.positions[b].x - narrow.positions[a].x).toBeGreaterThanOrEqual(140);
    expect(wide.positions[b].x - wide.positions[a].x).toBeLessThanOrEqual(228);
    expect(wide.positions[a].y).toBe(narrow.positions[a].y);
  }
});

test('a narrow workspace scrolls its own diagram instead of shrinking labels', () => {
  const layout = layoutTopology(devices, links, { width: 340, height: 210 }, true);
  expect(layout.minWidth).toBe(548);
  expect(layout.viewBox).toBe('0 0 548 210');
  expect(layout.positions.R1.x).toBeGreaterThanOrEqual(64);
  expect(layout.positions.R4.x).toBeLessThanOrEqual(484);
});

test('branching topology fits both axes and authored editor coordinates remain intact', () => {
  const input = JSON.parse(JSON.stringify(devices));
  const branch = ['R2', 'R3', 'R4'].map((id) => ({ a: { deviceId: 'R1' }, b: { deviceId: id } }));
  const fitted = layoutTopology(devices, branch, { width: 720, height: 280 }, true);
  expect(fitted.linear).toBe(false);
  Object.values(fitted.positions).forEach(({ x, y }) => {
    expect(x).toBeGreaterThanOrEqual(72);
    expect(x).toBeLessThanOrEqual(648);
    expect(y).toBeGreaterThanOrEqual(52);
    expect(y).toBeLessThanOrEqual(fitted.height - 80);
  });
  const editor = layoutTopology(devices, links, { width: 340, height: 210 }, false);
  expect(editor.viewBox).toBe('0 0 1000 600');
  expect(editor.positions.R3).toEqual(devices[1].position);
  expect(devices).toEqual(input);
});

test('single device, empty topology, array ports and port labels remain usable', () => {
  expect(layoutTopology([], [], { width: 600, height: 210 }, true).positions).toEqual({});
  expect(
    layoutTopology(devices.slice(0, 1), [], { width: 600, height: 210 }, true).positions.R1.x
  ).toBe(300);
  const port = { name: 'GigabitEthernet1/12', shutdown: true };
  expect(devicePort({ interfaces: [port] }, port.name)).toBe(port);
  expect(devicePort({ interfaces: { [port.name]: port } }, port.name)).toBe(port);
  expect(shortPort(port.name)).toBe('Gi1/12');
});
