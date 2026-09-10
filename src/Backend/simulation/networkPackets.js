const {
  inSubnet,
  wildcardMatch,
  routeTable,
  routedInterfaces,
  layer2Path,
  endpointKey,
} = require('./networkProtocols');
const macFor = (key) => {
  let n = 2166136261;
  for (const c of key) n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0;
  return `02:00:${[24, 16, 8, 0].map((shift) => ((n >>> shift) & 255).toString(16).padStart(2, '0')).join(':')}`;
};
const addressMatches = (ip, spec) =>
  spec.kind === 'any' ||
  (spec.kind === 'host' ? ip === spec.ip : wildcardMatch(ip, spec.ip, spec.wildcard));
const aclAllows = (device, name, packet) => {
  if (!name) return { allowed: true, rule: 'unfiltered' };
  for (const rule of device.acls?.[name] || []) {
    if (rule.protocol !== 'ip' && rule.protocol !== packet.protocol) continue;
    if (!addressMatches(packet.src, rule.source) || !addressMatches(packet.dst, rule.destination))
      continue;
    if (rule.port !== undefined && rule.port !== packet.dstPort) continue;
    return { allowed: rule.action === 'permit', rule: rule.text };
  }
  return { allowed: false, rule: 'implicit deny' };
};

function transmit(s, sourceId, destination, options = {}) {
  const events = [];
  const devices = s.devices;
  const source = devices[sourceId];
  if (!source) throw new Error('Unknown source device');
  const initialRoutes = routeTable(s, sourceId);
  const firstRoute = initialRoutes.find((r) => inSubnet(destination, r.network, r.mask));
  const sourcePort =
    source.interfaces[firstRoute?.interface] ||
    Object.values(source.interfaces).find((p) => p.ipAddress && !p.shutdown);
  if (!sourcePort?.ipAddress)
    return { success: false, reason: 'Source has no active IPv4 interface', events };
  const initial = {
    src: sourcePort.ipAddress,
    dst: destination,
    protocol: options.protocol || 'icmp',
    srcPort: options.srcPort || 40000,
    dstPort: options.dstPort || 0,
    ttl: options.ttl || 32,
  };
  const add = (type, deviceId, detail, packet, extra = {}) =>
    events.push({ tick: s.tick, type, deviceId, detail, packet: { ...packet }, ...extra });
  const run = (start, packet, reply) => {
    let current = start;
    let incoming = null;
    for (let hop = 0; hop < 64; hop += 1) {
      const d = devices[current];
      if (incoming) {
        const policy = aclAllows(d, d.interfaces[incoming].aclIn, packet);
        add('ACL_IN', current, policy.rule, packet);
        if (!policy.allowed)
          return {
            ok: false,
            deviceId: current,
            reason: `ACL inbound on ${current}: ${policy.rule}`,
          };
        if (d.interfaces[incoming].natRole === 'outside') {
          const mapping =
            (d.natStatic || []).find((m) => m.global === packet.dst) ||
            (d.natTranslations || []).find(
              (m) =>
                m.global === packet.dst &&
                m.globalPort === packet.dstPort &&
                m.protocol === packet.protocol &&
                m.remote === packet.src &&
                (m.remotePort === undefined || m.remotePort === packet.srcPort)
            );
          if (mapping) {
            packet.dst = mapping.local;
            if (mapping.localPort) packet.dstPort = mapping.localPort;
            add('NAT_DESTINATION', current, `Destination translated to ${packet.dst}`, packet);
          }
        }
      }
      if (Object.values(d.interfaces).some((p) => p.ipAddress === packet.dst && !p.shutdown)) {
        add(reply ? 'REPLY_DELIVERED' : 'DELIVERED', current, 'Packet delivered', packet);
        return { ok: true, deviceId: current, packet };
      }
      if (incoming && d.deviceType !== 'ROUTER')
        return { ok: false, deviceId: current, reason: `${current} cannot forward IP packets` };
      if (incoming && --packet.ttl <= 0) {
        add('TTL_EXCEEDED', current, 'TTL expired', packet);
        return { ok: false, deviceId: current, reason: `TTL exceeded at ${current}` };
      }
      const route = routeTable(s, current).find((r) => inSubnet(packet.dst, r.network, r.mask));
      if (!route)
        return { ok: false, deviceId: current, reason: `No route to ${packet.dst} on ${current}` };
      const outgoing = d.interfaces[route.interface];
      add(
        'ROUTE',
        current,
        `${route.protocol} ${route.network}/${route.mask} via ${route.nextHop || 'connected'}`,
        packet
      );
      if (
        incoming &&
        d.interfaces[incoming].natRole === 'inside' &&
        outgoing.natRole === 'outside'
      ) {
        let mapping = (d.natStatic || []).find((m) => m.local === packet.src);
        if (
          !mapping &&
          d.natOverload?.interface === route.interface &&
          aclAllows(d, d.natOverload.acl, packet).allowed
        ) {
          d.natTranslations ||= [];
          mapping = d.natTranslations.find(
            (m) =>
              m.local === packet.src &&
              m.localPort === packet.srcPort &&
              m.protocol === packet.protocol &&
              m.remote === packet.dst &&
              (m.remotePort === undefined || m.remotePort === packet.dstPort)
          );
          if (mapping) mapping.tick = s.tick;
          if (!mapping) {
            if (d.natTranslations.length >= 256)
              return { ok: false, deviceId: current, reason: 'NAT translation limit reached' };
            const usedPorts = new Set(d.natTranslations.map((entry) => entry.globalPort));
            let globalPort = 10000;
            while (usedPorts.has(globalPort)) globalPort += 1;
            mapping = {
              local: packet.src,
              global: outgoing.ipAddress,
              localPort: packet.srcPort,
              globalPort,
              protocol: packet.protocol,
              remote: packet.dst,
              remotePort: packet.dstPort,
              tick: s.tick,
            };
            d.natTranslations.push(mapping);
          }
        }
        if (mapping) {
          packet.src = mapping.global;
          if (mapping.globalPort) packet.srcPort = mapping.globalPort;
          add(
            'NAT_SOURCE',
            current,
            `Source translated to ${packet.src}:${packet.srcPort}`,
            packet
          );
        }
      }
      const policy = aclAllows(d, outgoing.aclOut, packet);
      add('ACL_OUT', current, policy.rule, packet);
      if (!policy.allowed)
        return {
          ok: false,
          deviceId: current,
          reason: `ACL outbound on ${current}: ${policy.rule}`,
        };
      const nextIp = route.nextHop || packet.dst;
      const from = { deviceId: current, interface: route.interface };
      const currentDeviceId = current;
      const candidates = routedInterfaces(s).filter(
        (e) =>
          e.deviceId !== currentDeviceId &&
          (e.ipAddress === nextIp ||
            (devices[e.deviceId].natStatic || []).some(
              (m) => m.global === nextIp && e.natRole === 'outside'
            ))
      );
      let peer;
      let path;
      for (const candidate of candidates) {
        if (!inSubnet(nextIp, outgoing.ipAddress, outgoing.subnetMask)) continue;
        const found = layer2Path(s, from, candidate);
        if (found) {
          peer = candidate;
          path = found;
          break;
        }
      }
      if (!peer) {
        add('ARP_TIMEOUT', current, `No L2 neighbor responds for ${nextIp}`, packet);
        return { ok: false, deviceId: current, reason: `ARP unresolved: ${nextIp} on ${current}` };
      }
      const srcMac = macFor(endpointKey(from));
      const dstMac = macFor(endpointKey(peer));
      d.arp ||= {};
      if (!d.arp[nextIp])
        add('ARP_REQUEST', current, `Who has ${nextIp}?`, packet, {
          srcMac,
          dstMac: 'ff:ff:ff:ff:ff:ff',
        });
      d.arp[nextIp] = { mac: dstMac, interface: route.interface, tick: s.tick };
      add('ARP_REPLY', peer.deviceId, `${nextIp} is at ${dstMac}`, packet, {
        srcMac: dstMac,
        dstMac: srcMac,
      });
      for (const edge of path.path) {
        const receiver = devices[edge.to.deviceId];
        if (receiver.deviceType === 'SWITCH') {
          receiver.macTable ||= {};
          receiver.macTable[`${path.vlan}:${srcMac}`] = {
            interface: edge.to.interface,
            vlan: path.vlan,
            tick: s.tick,
          };
        }
        add(
          'FRAME',
          edge.from.deviceId,
          `${edge.from.interface} → ${edge.to.deviceId}:${edge.to.interface}`,
          packet,
          { ...edge, vlan: path.vlan, srcMac, dstMac }
        );
      }
      current = peer.deviceId;
      incoming = peer.interface;
    }
    return { ok: false, deviceId: current, reason: 'Forwarding loop / hop limit' };
  };
  const forward = run(sourceId, { ...initial }, false);
  if (!forward.ok) {
    add('DROP', forward.deviceId || sourceId, forward.reason, initial);
    return { success: false, reason: forward.reason, events };
  }
  if (options.oneWay) return { success: true, reason: 'Destination reached', events };
  const response = {
    src: forward.packet.dst,
    dst: forward.packet.src,
    protocol: initial.protocol,
    srcPort: forward.packet.dstPort,
    dstPort: forward.packet.srcPort,
    ttl: options.ttl || 32,
  };
  const backward = run(forward.deviceId, response, true);
  const success = backward.ok && backward.deviceId === sourceId;
  const reason = success
    ? 'Request and reply delivered'
    : `Return path failed: ${backward.reason || 'wrong destination'}`;
  if (!success) add('DROP', backward.deviceId || forward.deviceId, reason, response);
  return { success, reason, events };
}
module.exports = { transmit, aclAllows, addressMatches, macFor };
