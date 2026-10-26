const { inSubnet, layer2Path, routeTable } = require('@ccna/shared/simulation/networkProtocols');
const { selectedRoute } = require('./probe');
const { LIMITS } = require('./catalog');

function findingsFor(context, target, path, state, trace) {
  const devices = new Map(context.devices.map((device) => [device.id, device]));
  const port = (endpoint) =>
    devices.get(endpoint.deviceId).interfaces.find((p) => p.name === endpoint.interface);
  const findings = [];
  const add = (ruleId, key, observation, extra = {}) => {
    if (findings.length < LIMITS.findings && !findings.some((f) => f.key === key))
      findings.push({ ruleId, key, observation, ...extra });
  };
  for (const edge of path) {
    if (!edge.link.enabled)
      add(
        'LINK_DOWN',
        `link:${edge.link.id}`,
        `Liên kết ${edge.link.id} trên đường kết nối đang ngắt.`
      );
    for (const endpoint of [edge.from, edge.to])
      if (port(endpoint).shutdown)
        add(
          'INTERFACE_ADMIN_DOWN',
          `port:${endpoint.deviceId}:${endpoint.interface}`,
          `Cổng ${endpoint.deviceId} ${endpoint.interface} trên đường kết nối đang shutdown.`,
          endpoint
        );
  }
  // Do not report missing routes caused by a down port as independent causes.
  if (findings.length) return findings;
  const routed = [];
  for (const edge of path)
    for (const endpoint of [edge.from, edge.to])
      if (
        devices.get(endpoint.deviceId).deviceType !== 'SWITCH' &&
        !routed.some((p) => p.deviceId === endpoint.deviceId && p.interface === endpoint.interface)
      ) {
        const p = port(endpoint);
        routed.push(endpoint);
        if (!p.ipAddress || !p.subnetMask)
          add(
            'IP_ADDRESS_MISSING',
            `ip:${endpoint.deviceId}:${endpoint.interface}`,
            `Cổng ${endpoint.deviceId} ${endpoint.interface} trên đường kết nối chưa có IPv4/mask.`,
            endpoint
          );
      }
  if (findings.length) return findings;
  if (
    !trace.success &&
    routed.length === 2 &&
    devices.get(path[0]?.to.deviceId)?.deviceType === 'SWITCH'
  ) {
    const from = routed[0],
      to = routed[1];
    if (!layer2Path(state, from, to)) {
      const accessEnds = [path[0].to, path[path.length - 1].from];
      const vlanIds = accessEnds.map((endpoint) => port(endpoint).accessVlan || 1);
      if (vlanIds[0] !== vlanIds[1])
        add(
          'VLAN_PATH_MISMATCH',
          'access-membership',
          `Hai cổng access ở hai đầu đường kết nối thuộc VLAN ${vlanIds[0]} và ${vlanIds[1]} khác nhau.`
        );
      else
        for (const edge of path)
          for (const endpoint of [edge.from, edge.to]) {
            const device = devices.get(endpoint.deviceId);
            if (device.deviceType !== 'SWITCH') continue;
            const p = port(endpoint);
            if (
              (p.switchportMode === 'trunk' &&
                !device.vlans.some((v) => v.vlanId === vlanIds[0])) ||
              (p.switchportMode !== 'trunk' && (p.accessVlan || 1) !== vlanIds[0])
            )
              add(
                'VLAN_PATH_MISMATCH',
                `vlan:${endpoint.deviceId}:${endpoint.interface}`,
                `Cổng ${endpoint.deviceId} ${endpoint.interface} không chuyển VLAN ${vlanIds[0]} trên đường đang xét.`,
                endpoint
              );
          }
    }
  }
  if (findings.length) return findings;
  for (let index = 0; index + 1 < routed.length; index++) {
    const left = routed[index],
      right = routed[index + 1];
    if (left.deviceId === right.deviceId) continue; // Routing connects different subnets.
    const a = port(left),
      b = port(right);
    if (
      !inSubnet(a.ipAddress, b.ipAddress, b.subnetMask) ||
      !inSubnet(b.ipAddress, a.ipAddress, a.subnetMask)
    )
      add(
        'IP_SUBNET_INCONSISTENCY',
        `subnet:${left.deviceId}:${left.interface}:${right.deviceId}:${right.interface}`,
        `IPv4/mask của ${left.deviceId} ${left.interface} và ${right.deviceId} ${right.interface} không cùng subnet hai chiều trên đoạn kết nối trực tiếp.`,
        left
      );
  }
  if (findings.length || trace.success) return findings;
  const sourceIp = trace.events[0]?.packet?.src;
  const ids = [...new Set([target.sourceId, ...path.map((edge) => edge.to.deviceId)])];
  for (const deviceId of ids) {
    if (devices.get(deviceId).deviceType !== 'ROUTER') continue;
    for (const [direction, destination] of [
      ['đi', target.destination],
      ['về', sourceIp],
    ]) {
      if (!destination) continue;
      if (!selectedRoute(state, deviceId, destination))
        add(
          'NO_USABLE_ROUTE',
          `route:${deviceId}:${destination}`,
          `${deviceId} không có route dùng được tới ${destination} ở chiều ${direction}; đã xét connected, static và default route.`,
          { deviceId }
        );
    }
  }
  if (findings.length) return findings;
  const timeout = trace.events.find((event) => event.type === 'ARP_TIMEOUT');
  if (timeout) {
    const route = routeTable(state, timeout.deviceId).find((r) =>
      inSubnet(timeout.packet.dst, r.network, r.mask)
    );
    if (route?.nextHop)
      add(
        'NEXT_HOP_UNRESOLVED',
        `next-hop:${timeout.deviceId}:${route.nextHop}`,
        `${timeout.deviceId} chọn route ${route.network} mask ${route.mask}, nhưng next hop ${route.nextHop} không phản hồi qua đường Layer 2.`,
        { deviceId: timeout.deviceId }
      );
  }
  return findings;
}
module.exports = { findingsFor };
