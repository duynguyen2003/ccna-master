// Deterministic educational control plane. No timers or host networking.
const ipNumber = (ip) => ip.split('.').reduce((n, octet) => ((n << 8) | Number(octet)) >>> 0, 0);
const ipText = (n) => [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join('.');
const inSubnet = (ip, network, mask) =>
  (ipNumber(ip) & ipNumber(mask)) >>> 0 === (ipNumber(network) & ipNumber(mask)) >>> 0;
const wildcardMatch = (ip, network, wildcard) =>
  inSubnet(ip, network, ipText(~ipNumber(wildcard) >>> 0));
const prefixLength = (mask) => ipNumber(mask).toString(2).split('1').length - 1;
const endpointKey = (e) => `${e.deviceId}:${e.interface}`;
const port = (s, e) => s.devices[e.deviceId]?.interfaces[e.interface];
const linkUp = (s, l) =>
  l.enabled !== false && [l.a, l.b].every((e) => port(s, e) && !port(s, e).shutdown);
const vlansAt = (s, e) =>
  s.devices[e.deviceId].deviceType !== 'SWITCH'
    ? null
    : port(s, e).switchportMode === 'trunk'
      ? Object.keys(s.devices[e.deviceId].vlans).map(Number)
      : [port(s, e).accessVlan || 1];
const allows = (s, e, vlan) => !vlansAt(s, e) || vlansAt(s, e).includes(vlan);

function spanningTree(s) {
  const result = {};
  const switches = Object.keys(s.devices).filter((id) => s.devices[id].deviceType === 'SWITCH');
  const vlans = [...new Set(switches.flatMap((id) => Object.keys(s.devices[id].vlans)))];
  for (const vlanString of vlans) {
    const vlan = Number(vlanString);
    const ids = switches.filter((id) => s.devices[id].vlans[vlan]);
    const compare = (a, b) =>
      (s.devices[a].stpPriority?.[vlan] ?? 32768) - (s.devices[b].stpPriority?.[vlan] ?? 32768) ||
      a.localeCompare(b);
    const edges = s.links.filter(
      (l) =>
        linkUp(s, l) &&
        ids.includes(l.a.deviceId) &&
        ids.includes(l.b.deviceId) &&
        allows(s, l.a, vlan) &&
        allows(s, l.b, vlan)
    );
    const distance = {};
    const roots = {};
    const parents = {};
    for (const root of [...ids].sort(compare)) {
      if (roots[root]) continue;
      roots[root] = root;
      distance[root] = 0;
      const queue = [root];
      while (queue.length) {
        const current = queue.shift();
        for (const edge of [...edges].sort((a, b) => a.id.localeCompare(b.id))) {
          const other =
            edge.a.deviceId === current
              ? edge.b.deviceId
              : edge.b.deviceId === current
                ? edge.a.deviceId
                : null;
          if (!other || roots[other]) continue;
          roots[other] = root;
          distance[other] = distance[current] + 1;
          parents[other] = edge.id;
          queue.push(other);
        }
      }
    }
    const ports = {};
    for (const l of edges) {
      const a = l.a.deviceId;
      const b = l.b.deviceId;
      const designated =
        distance[a] < distance[b] || (distance[a] === distance[b] && compare(a, b) < 0) ? a : b;
      for (const e of [l.a, l.b])
        ports[endpointKey(e)] =
          parents[e.deviceId] === l.id
            ? 'ROOT'
            : e.deviceId === designated
              ? 'DESIGNATED'
              : 'BLOCKING';
    }
    result[vlan] = { roots, ports };
  }
  return result;
}

// Return an L2 path between two routed interfaces. Only switches can be transit nodes.
function layer2Path(s, from, to, stp = s.stp || spanningTree(s)) {
  const sourceLink = s.links.find(
    (l) => linkUp(s, l) && [l.a, l.b].some((e) => endpointKey(e) === endpointKey(from))
  );
  if (!sourceLink) return null;
  const remote = endpointKey(sourceLink.a) === endpointKey(from) ? sourceLink.b : sourceLink.a;
  const vlan = vlansAt(s, remote)?.[0] || vlansAt(s, from)?.[0] || 1;
  const queue = [{ e: from, path: [] }];
  const visited = new Set();
  while (queue.length) {
    const { e, path } = queue.shift();
    const key = endpointKey(e);
    if (visited.has(key)) continue;
    visited.add(key);
    if (key === endpointKey(to)) return { path, vlan };
    for (const l of s.links) {
      if (!linkUp(s, l)) continue;
      let local;
      let peer;
      if (endpointKey(l.a) === key) {
        local = l.a;
        peer = l.b;
      } else if (endpointKey(l.b) === key) {
        local = l.b;
        peer = l.a;
      } else continue;
      if (
        ![local, peer].every(
          (p) => allows(s, p, vlan) && stp[vlan]?.ports[endpointKey(p)] !== 'BLOCKING'
        )
      )
        continue;
      const nextPath = [...path, { linkId: l.id, from: local, to: peer }];
      if (endpointKey(peer) === endpointKey(to)) return { path: nextPath, vlan };
      if (s.devices[peer.deviceId].deviceType === 'SWITCH') {
        for (const name of Object.keys(s.devices[peer.deviceId].interfaces)) {
          const out = { deviceId: peer.deviceId, interface: name };
          if (
            name !== peer.interface &&
            allows(s, out, vlan) &&
            !port(s, out).shutdown &&
            stp[vlan]?.ports[endpointKey(out)] !== 'BLOCKING'
          )
            queue.push({ e: out, path: nextPath });
        }
      }
    }
  }
  return null;
}

const routedInterfaces = (s) =>
  Object.entries(s.devices).flatMap(([deviceId, d]) =>
    d.deviceType === 'SWITCH'
      ? []
      : Object.entries(d.interfaces)
          .filter(([, p]) => p.ipAddress && p.subnetMask && !p.shutdown)
          .map(([name, p]) => ({ deviceId, interface: name, ...p }))
  );
const connectedRoutes = (s, id) =>
  routedInterfaces(s)
    .filter(
      (e) =>
        e.deviceId === id &&
        (e.interface.startsWith('Loopback') ||
          s.links.some(
            (l) => linkUp(s, l) && [l.a, l.b].some((p) => endpointKey(p) === endpointKey(e))
          ))
    )
    .map((e) => ({
      network: ipText((ipNumber(e.ipAddress) & ipNumber(e.subnetMask)) >>> 0),
      mask: e.subnetMask,
      interface: e.interface,
      protocol: 'C',
      distance: 0,
      cost: 0,
    }));
const ospfEnabled = (s, e) =>
  s.devices[e.deviceId].ospf?.networks.some(
    (n) => n.area === 0 && wildcardMatch(e.ipAddress, n.network, n.wildcard)
  );
const classfulMask = (ip) => {
  const firstOctet = Number(String(ip).split('.')[0]);
  if (firstOctet <= 126) return '255.0.0.0';
  if (firstOctet <= 191) return '255.255.0.0';
  return '255.255.255.0';
};
const eigrpEnabled = (s, e) =>
  Boolean(
    s.devices[e.deviceId].eigrp?.networks.some((network) =>
      network.wildcard
        ? wildcardMatch(e.ipAddress, network.network, network.wildcard)
        : inSubnet(e.ipAddress, network.network, classfulMask(network.network))
    )
  );
const eigrpInterfaceMetric = (entry) => {
  const isFastEthernet = entry.interface.startsWith('FastEthernet');
  const bandwidthKbps = isFastEthernet ? 100000 : 1000000;
  const delayTensOfMicroseconds = isFastEthernet ? 10 : 1;
  return 256 * (Math.floor(10000000 / bandwidthKbps) + delayTensOfMicroseconds);
};

function convergeEigrp(s) {
  const interfaces = routedInterfaces(s).filter(
    (entry) => s.devices[entry.deviceId].deviceType === 'ROUTER' && eigrpEnabled(s, entry)
  );
  const edges = [];
  const neighbors = {};
  for (const a of interfaces) {
    for (const b of interfaces) {
      if (
        a.deviceId === b.deviceId ||
        a.subnetMask !== b.subnetMask ||
        !inSubnet(a.ipAddress, b.ipAddress, a.subnetMask) ||
        !layer2Path(s, a, b, s.stp)
      )
        continue;
      const left = s.devices[a.deviceId].eigrp;
      const right = s.devices[b.deviceId].eigrp;
      if (left.asNumber !== right.asNumber) continue;
      if (
        left.passiveInterfaces.includes(a.interface) ||
        right.passiveInterfaces.includes(b.interface)
      )
        continue;

      const leftStatic = left.neighbors.filter((entry) => entry.interface === a.interface);
      const rightStatic = right.neighbors.filter((entry) => entry.interface === b.interface);
      const staticMode = leftStatic.length > 0 || rightStatic.length > 0;
      if (
        staticMode &&
        (!leftStatic.some((entry) => entry.address === b.ipAddress) ||
          !rightStatic.some((entry) => entry.address === a.ipAddress))
      )
        continue;

      const metric = eigrpInterfaceMetric(a);
      neighbors[`${endpointKey(a)}>${endpointKey(b)}`] = {
        deviceId: a.deviceId,
        neighborId: b.deviceId,
        interface: a.interface,
        address: b.ipAddress,
        asNumber: left.asNumber,
        state: 'UP',
        mode: staticMode ? 'STATIC' : 'MULTICAST',
        metric,
      };
      edges.push({
        from: a.deviceId,
        to: b.deviceId,
        interface: a.interface,
        nextHop: b.ipAddress,
        cost: metric,
      });
    }
  }
  s.eigrpNeighbors = neighbors;

  for (const [id, device] of Object.entries(s.devices)) {
    device.eigrpRoutes = [];
    if (device.deviceType !== 'ROUTER' || !device.eigrp) continue;
    const distances = { [id]: 0 };
    const firstHop = {};
    const done = new Set();
    while (true) {
      const current = Object.keys(distances)
        .filter((candidate) => !done.has(candidate))
        .sort((a, b) => distances[a] - distances[b] || a.localeCompare(b))[0];
      if (!current) break;
      done.add(current);
      for (const edge of edges.filter((entry) => entry.from === current)) {
        const cost = distances[current] + edge.cost;
        if (cost < (distances[edge.to] ?? Infinity)) {
          distances[edge.to] = cost;
          firstHop[edge.to] = current === id ? edge : firstHop[current];
        }
      }
    }

    const bestRoutes = new Map();
    const localNetworks = new Set(
      connectedRoutes(s, id).map((route) => `${route.network}/${route.mask}`)
    );
    for (const other of Object.keys(distances).filter((candidate) => candidate !== id)) {
      for (const route of connectedRoutes(s, other)) {
        const remoteInterface = {
          deviceId: other,
          interface: route.interface,
          ...s.devices[other].interfaces[route.interface],
        };
        if (!eigrpEnabled(s, remoteInterface) || !firstHop[other]) continue;
        const key = `${route.network}/${route.mask}`;
        if (localNetworks.has(key)) continue;
        const learned = {
          ...route,
          interface: firstHop[other].interface,
          nextHop: firstHop[other].nextHop,
          protocol: 'D',
          distance: 90,
          cost: distances[other],
        };
        const previous = bestRoutes.get(key);
        if (!previous || learned.cost < previous.cost) bestRoutes.set(key, learned);
      }
    }
    device.eigrpRoutes = [...bestRoutes.values()];
  }
}

function converge(s) {
  s.stp = spanningTree(s);
  const interfaces = routedInterfaces(s).filter(
    (e) => s.devices[e.deviceId].deviceType === 'ROUTER' && ospfEnabled(s, e)
  );
  const edges = [];
  const old = s.ospfNeighbors || {};
  const neighbors = {};
  for (const a of interfaces)
    for (const b of interfaces) {
      if (
        a.deviceId === b.deviceId ||
        a.subnetMask !== b.subnetMask ||
        !inSubnet(a.ipAddress, b.ipAddress, a.subnetMask) ||
        !layer2Path(s, a, b, s.stp)
      )
        continue;
      if (
        s.devices[a.deviceId].ospf.routerId &&
        s.devices[a.deviceId].ospf.routerId === s.devices[b.deviceId].ospf.routerId
      )
        continue;
      const key = `${endpointKey(a)}>${endpointKey(b)}`;
      const since = old[key]?.since ?? s.tick;
      const state = s.tick - since >= 2 ? 'FULL' : s.tick - since >= 1 ? 'EXCHANGE' : 'INIT';
      neighbors[key] = {
        deviceId: a.deviceId,
        neighborId: b.deviceId,
        interface: a.interface,
        address: b.ipAddress,
        since,
        state,
      };
      if (state === 'FULL')
        edges.push({
          from: a.deviceId,
          to: b.deviceId,
          interface: a.interface,
          nextHop: b.ipAddress,
          cost: a.ospfCost || 1,
        });
    }
  s.ospfNeighbors = neighbors;
  for (const [id, d] of Object.entries(s.devices)) {
    d.ospfRoutes = [];
    if (d.deviceType !== 'ROUTER' || !d.ospf) continue;
    const distances = { [id]: 0 };
    const first = {};
    const done = new Set();
    while (true) {
      const current = Object.keys(distances)
        .filter((k) => !done.has(k))
        .sort((a, b) => distances[a] - distances[b] || a.localeCompare(b))[0];
      if (!current) break;
      done.add(current);
      for (const edge of edges.filter((e) => e.from === current)) {
        const cost = distances[current] + edge.cost;
        if (cost < (distances[edge.to] ?? Infinity)) {
          distances[edge.to] = cost;
          first[edge.to] = current === id ? edge : first[current];
        }
      }
    }
    for (const other of Object.keys(distances).filter((k) => k !== id)) {
      for (const route of connectedRoutes(s, other)) {
        const iface = { deviceId: other, ...s.devices[other].interfaces[route.interface] };
        if (!ospfEnabled(s, iface)) continue;
        d.ospfRoutes.push({
          ...route,
          interface: first[other].interface,
          nextHop: first[other].nextHop,
          protocol: 'O',
          distance: 110,
          cost: distances[other] + 1,
        });
      }
    }
  }
  convergeEigrp(s);
  return s;
}

function routeTable(s, id) {
  const d = s.devices[id];
  const connected = connectedRoutes(s, id);
  const statics = (d.staticRoutes || []).flatMap((route) => {
    const out = connected.find((c) => inSubnet(route.nextHop, c.network, c.mask));
    return out ? [{ ...route, interface: out.interface, protocol: 'S', distance: 1, cost: 0 }] : [];
  });
  return [...connected, ...statics, ...(d.ospfRoutes || []), ...(d.eigrpRoutes || [])].sort(
    (a, b) =>
      prefixLength(b.mask) - prefixLength(a.mask) || a.distance - b.distance || a.cost - b.cost
  );
}
module.exports = {
  ipNumber,
  ipText,
  inSubnet,
  wildcardMatch,
  prefixLength,
  endpointKey,
  port,
  linkUp,
  spanningTree,
  layer2Path,
  routedInterfaces,
  connectedRoutes,
  eigrpEnabled,
  eigrpInterfaceMetric,
  converge,
  routeTable,
};
