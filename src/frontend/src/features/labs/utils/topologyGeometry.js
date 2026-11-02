import { networkAddress, prefixLength } from '@ccna/shared/labDefinition';
import { devicePort, labelLines, nodeBounds } from './topologyLayout';
const point = (a, b, c, t) => ({
  x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
});
const unit = (a, b) => {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
};
export const overlapArea = (a, b, padding = 0) =>
  Math.max(0, Math.min(a.x + a.width + padding, b.x + b.width) - Math.max(a.x - padding, b.x)) *
  Math.max(0, Math.min(a.y + a.height + padding, b.y + b.height) - Math.max(a.y - padding, b.y));
const curve = (a, b, bend, radius) => {
  const u = unit(a, b),
    c = { x: (a.x + b.x) / 2 - u.y * bend, y: (a.y + b.y) / 2 + u.x * bend };
  const ua = unit(a, c),
    ub = unit(b, c);
  const start = { x: a.x + ua.x * radius, y: a.y + ua.y * radius },
    end = { x: b.x + ub.x * radius, y: b.y + ub.y * radius };
  return {
    start,
    end,
    control: c,
    at: (t) => point(start, end, c, t),
    d: `M ${start.x} ${start.y} Q ${c.x} ${c.y} ${end.x} ${end.y}`,
  };
};
export function layoutLinks(devices, links, layout, stp = {}) {
  const byId = Object.fromEntries(devices.map((d) => [d.id, d]));
  const obstacles = devices.map((d) => nodeBounds(d, layout.positions[d.id]));
  const occupied = [...obstacles];
  const groups = new Map();
  links.forEach((link) => {
    const key = [link.a.deviceId, link.b.deviceId].sort().join(':');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(link.id);
  });
  return links
    .map((link) => {
      const a = layout.positions[link.a.deviceId],
        b = layout.positions[link.b.deviceId];
      if (!a || !b) return null;
      const blocked = Object.values(stp || {}).some((value) =>
        [link.a, link.b].some(
          (port) => value.ports?.[`${port.deviceId}:${port.interface}`] === 'BLOCKING'
        )
      );
      const down =
        link.enabled === false ||
        [link.a, link.b].some((p) => devicePort(byId[p.deviceId], p.interface)?.shutdown);
      const stateClass = down ? 'link-down' : blocked ? 'link-blocked' : 'link-up';
      const status = down ? 'Đã ngắt' : blocked ? 'STP chặn' : '';
      const port = [link.a, link.b]
        .map((p) => devicePort(byId[p.deviceId], p.interface))
        .find((p) => p?.ipAddress && p?.subnetMask);
      const label = port
        ? `${networkAddress(port.ipAddress, port.subnetMask)}/${prefixLength(port.subnetMask)}`
        : link.id;
      const lines = labelLines(label, 22),
        labelWidth = Math.max(...lines.map((l) => l.length)) * (layout.minWidth ? 7.6 : 10) + 18,
        labelHeight = lines.length * 16 + 10 + (status ? 16 : 0);
      const group = groups.get([link.a.deviceId, link.b.deviceId].sort().join(':'));
      const base = (group.indexOf(link.id) - (group.length - 1) / 2) * 100;
      let route = curve(a, b, base, layout.minWidth ? 31 : 42),
        best = Infinity;
      const others = devices.filter((d) => d.id !== link.a.deviceId && d.id !== link.b.deviceId);
      for (const offset of [0, 64, -64, 128, -128, 200, -200, 300, -300, 420, -420]) {
        const candidate = curve(a, b, base + offset, layout.minWidth ? 31 : 42);
        let cost = Math.abs(offset);
        for (let n = 1; n < 20; n++) {
          const p = candidate.at(n / 20);
          if (p.x < 10 || p.y < 10 || p.x > layout.width - 10 || p.y > layout.height - 10)
            cost += 100000;
          for (const d of others) {
            const q = layout.positions[d.id];
            if (Math.hypot(p.x - q.x, p.y - q.y) < 38) cost += 10000;
          }
        }
        if (cost < best) {
          route = candidate;
          best = cost;
        }
        if (cost === 0) break;
      }
      const candidates = [];
      for (const t of [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9, 0.425, 0.575, 0.275, 0.725]) {
        const p = route.at(t),
          q = route.at(Math.min(1, t + 0.01)),
          u = unit(p, q);
        for (const offset of [
          -25, 25, -46, 46, -54, 54, -70, 70, -98, 98, -130, 130, -160, 160, -190, 190,
        ]) {
          const x = Math.max(
            labelWidth / 2 + 8,
            Math.min(layout.width - labelWidth / 2 - 8, p.x - u.y * offset)
          );
          const y = Math.max(
            labelHeight / 2 + 8,
            Math.min(layout.height - labelHeight / 2 - 8, p.y + u.x * offset)
          );
          const box = {
            x: x - labelWidth / 2,
            y: y - labelHeight / 2,
            width: labelWidth,
            height: labelHeight,
          };
          const overlap = occupied.reduce((sum, other) => sum + overlapArea(box, other, 5), 0);
          candidates.push({
            x,
            y,
            box,
            anchor: p,
            score: overlap * 10000 + Math.abs(offset) + Math.abs(t - 0.5) * 150,
            overlap,
          });
        }
      }
      candidates.sort((a, b) => a.score - b.score);
      const chosen = candidates[0];
      occupied.push(chosen.box);
      return {
        link,
        a,
        b,
        route,
        label,
        lines,
        status,
        stateClass,
        labelWidth,
        labelHeight,
        ...chosen,
      };
    })
    .filter(Boolean);
}

export function packetMotionPath(wires, positions, hop) {
  const from = positions[hop.from],
    to = positions[hop.to];
  const wire = wires.find(({ link }) => {
    const endpoints = link.a.deviceId === hop.from ? [link.a, link.b] : [link.b, link.a];
    return (
      endpoints[0].deviceId === hop.from &&
      endpoints[1].deviceId === hop.to &&
      (!hop.fromInterface || endpoints[0].interface === hop.fromInterface) &&
      (!hop.toInterface || endpoints[1].interface === hop.toInterface)
    );
  });
  if (!wire) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  const { start, end, control } = wire.route;
  const [a, b] = wire.link.a.deviceId === hop.from ? [start, end] : [end, start];
  return `M ${from.x} ${from.y} L ${a.x} ${a.y} Q ${control.x} ${control.y} ${b.x} ${b.y} L ${to.x} ${to.y}`;
}
