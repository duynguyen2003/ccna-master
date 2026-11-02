// Frozen defaults for simulator 3.0.0 (classic EIGRP, K1=K3=1).
const DEFAULTS = Object.freeze({
  GigabitEthernet: Object.freeze({ bandwidthKbps: 1000000, delayMicroseconds: 10 }),
  FastEthernet: Object.freeze({ bandwidthKbps: 100000, delayMicroseconds: 100 }),
  Serial: Object.freeze({ bandwidthKbps: 1544, delayMicroseconds: 20000 }),
  Loopback: Object.freeze({ bandwidthKbps: 8000000, delayMicroseconds: 5000 }),
});
const interfaceMetric = (name, entry = {}) => {
  const kind = Object.keys(DEFAULTS).find((prefix) => name.startsWith(prefix));
  if (!kind) throw new Error(`Unsupported metric interface: ${name}`);
  return {
    bandwidthKbps: entry.bandwidthKbps ?? DEFAULTS[kind].bandwidthKbps,
    delayMicroseconds: entry.delayMicroseconds ?? DEFAULTS[kind].delayMicroseconds,
  };
};
const classicMetric = (bandwidthKbps, delayMicroseconds) =>
  256 * (Math.floor(10000000 / bandwidthKbps) + Math.floor(delayMicroseconds / 10));

// Keep non-dominated bandwidth/delay vectors: scalar edge addition is incorrect.
// Each prefix propagates at most one minimum-delay label per bottleneck bandwidth.
function convergeClassic(s, edges, connectedRoutes, enabled) {
  const prefixes = new Map();
  for (const [id, d] of Object.entries(s.devices)) {
    d.eigrpRoutes = [];
    d.eigrpTopology = [];
    if (!d.eigrp) continue;
    for (const route of connectedRoutes(s, id)) {
      const entry = { ...d.interfaces[route.interface], deviceId: id, interface: route.interface };
      if (!enabled(s, entry)) continue;
      const key = `${route.network}/${route.mask}`;
      if (!prefixes.has(key)) prefixes.set(key, { route, labels: new Map() });
      const vector = interfaceMetric(route.interface, entry);
      const label = {
        ...vector,
        local: true,
        interface: route.interface,
        cost: classicMetric(vector.bandwidthKbps, vector.delayMicroseconds),
        reportedDistance: 0,
      };
      prefixes.get(key).labels.set(id, [label]);
    }
  }
  for (const { route, labels } of prefixes.values()) {
    for (let round = 0; round < Object.keys(s.devices).length - 1; round++) {
      let changed = false;
      const previous = new Map([...labels].map(([id, values]) => [id, [...values]]));
      for (const edge of edges) {
        if (labels.get(edge.from)?.some((label) => label.local)) continue;
        const out = interfaceMetric(
          edge.interface,
          s.devices[edge.from].interfaces[edge.interface]
        );
        for (const remote of previous.get(edge.to) || []) {
          const bandwidthKbps = Math.min(out.bandwidthKbps, remote.bandwidthKbps);
          const delayMicroseconds = out.delayMicroseconds + remote.delayMicroseconds;
          const current = labels.get(edge.from) || [];
          if (
            current.some(
              (label) =>
                label.bandwidthKbps >= bandwidthKbps && label.delayMicroseconds <= delayMicroseconds
            )
          )
            continue;
          const label = {
            bandwidthKbps,
            delayMicroseconds,
            cost: classicMetric(bandwidthKbps, delayMicroseconds),
            reportedDistance: remote.cost,
            interface: edge.interface,
            nextHop: edge.nextHop,
            successor: edge.to,
          };
          labels.set(edge.from, [
            ...current.filter(
              (old) =>
                !(bandwidthKbps >= old.bandwidthKbps && delayMicroseconds <= old.delayMicroseconds)
            ),
            label,
          ]);
          changed = true;
        }
      }
      if (!changed) break;
    }
    for (const [id, values] of labels) {
      const best = [...values].sort(
        (a, b) => a.cost - b.cost || String(a.nextHop).localeCompare(String(b.nextHop))
      )[0];
      const learned = {
        ...route,
        ...best,
        protocol: 'D',
        distance: 90,
        feasibleDistance: best.cost,
      };
      s.devices[id].eigrpTopology.push(learned);
      if (!best.local) s.devices[id].eigrpRoutes.push(learned);
    }
  }
}
module.exports = { DEFAULTS, interfaceMetric, classicMetric, convergeClassic };
