import { topologyScenarios } from '../fixtures/topologyScenarios';
import { layoutTopology, nodeBounds } from './topologyLayout';
import { layoutLinks, overlapArea, packetMotionPath } from './topologyGeometry';

describe.each([558, 1024])('topology at %ipx', (width) => {
  test.each(topologyScenarios.map((s) => [s.id, s]))(
    '%s keeps devices and labels separate and within the drawing',
    (_, scenario) => {
      const before = JSON.stringify(scenario);
      const layout = layoutTopology(scenario.devices, scenario.links, { width, height: 210 }, true);
      const nodes = scenario.devices.map((d) => nodeBounds(d, layout.positions[d.id]));
      nodes.forEach((a, i) => {
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.y).toBeGreaterThanOrEqual(0);
        expect(a.x + a.width).toBeLessThanOrEqual(layout.width);
        expect(a.y + a.height).toBeLessThanOrEqual(layout.height);
        nodes.slice(i + 1).forEach((b) => expect(overlapArea(a, b)).toBe(0));
      });
      const wires = layoutLinks(scenario.devices, scenario.links, layout, scenario.stp);
      expect(wires).toHaveLength(scenario.links.length);
      wires.forEach((wire, i) => {
        const a = wire.box;
        expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true);
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.x + a.width).toBeLessThanOrEqual(layout.width);
        expect(a.y).toBeGreaterThanOrEqual(0);
        expect(a.y + a.height).toBeLessThanOrEqual(layout.height);
        nodes.forEach((b) => expect(overlapArea(a, b)).toBe(0));
        wires.slice(i + 1).forEach((b) => expect(overlapArea(a, b.box)).toBe(0));
      });
      expect(JSON.stringify(scenario)).toBe(before);
    }
  );
});
test('long chains wrap, explicit rows stay distinct and parallel cables have distinct paths', () => {
  const long = topologyScenarios.find((s) => s.id === 'long-chain');
  const layout = layoutTopology(long.devices, long.links, { width: 558, height: 210 }, true);
  expect(new Set(Object.values(layout.positions).map((p) => p.y)).size).toBeGreaterThan(1);
  const parallel = topologyScenarios.find((s) => s.id === 'parallel');
  const p = layoutTopology(parallel.devices, parallel.links, { width: 558, height: 210 }, true);
  expect(new Set(layoutLinks(parallel.devices, parallel.links, p).map((w) => w.route.d)).size).toBe(
    3
  );
});
test('packet animation follows the actual parallel interface in both directions', () => {
  const scenario = topologyScenarios.find((s) => s.id === 'parallel');
  const layout = layoutTopology(
    scenario.devices,
    scenario.links,
    { width: 800, height: 210 },
    true
  );
  const wires = layoutLinks(scenario.devices, scenario.links, layout);
  const selected = wires[2],
    { a, b } = selected.link;
  const forward = packetMotionPath(wires, layout.positions, {
    from: a.deviceId,
    to: b.deviceId,
    fromInterface: a.interface,
    toInterface: b.interface,
  });
  const reverse = packetMotionPath(wires, layout.positions, {
    from: b.deviceId,
    to: a.deviceId,
    fromInterface: b.interface,
    toInterface: a.interface,
  });
  expect(forward).toContain(`Q ${selected.route.control.x} ${selected.route.control.y}`);
  expect(reverse).toContain(`Q ${selected.route.control.x} ${selected.route.control.y}`);
  expect(forward).toContain(`L ${selected.route.start.x} ${selected.route.start.y}`);
  expect(reverse).toContain(`L ${selected.route.end.x} ${selected.route.end.y}`);
  expect(forward).not.toBe(reverse);
});
