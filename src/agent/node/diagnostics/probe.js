const engine = require('@ccna/shared/simulation/networkEngine');
const { converge, routeTable, inSubnet } = require('@ccna/shared/simulation/networkProtocols');
const { transmit } = require('@ccna/shared/simulation/networkPackets');

function simulationClone(context) {
  const state = engine.initial({
    devices: context.devices.map((device) => ({
      id: device.id,
      deviceType: device.deviceType,
      hostname: device.id,
      interfaces: structuredClone(device.interfaces),
    })),
    links: structuredClone(context.links),
  });
  for (const device of context.devices) {
    state.devices[device.id].vlans = Object.fromEntries(
      device.vlans.map((vlan) => [vlan.vlanId, { name: `VLAN${vlan.vlanId}`, status: 'active' }])
    );
    state.devices[device.id].staticRoutes = device.routes.map((route) => ({
      network: route.network,
      mask: route.mask,
      nextHop: route.nextHop,
    }));
  }
  state.revision = context.sourceRevision;
  return converge(state);
}
function resolveTarget(context, request) {
  const source = context.devices.find((device) => device.id === request.selectedDeviceId);
  if (!source || source.deviceType === 'SWITCH') return null;
  const addressed = context.devices.flatMap((device) =>
    device.interfaces
      .filter((port) => port.ipAddress)
      .map((port) => ({ deviceId: device.id, interface: port.name, ip: port.ipAddress }))
  );
  const targets = request.target?.ipv4
    ? addressed.filter((port) => port.ip === request.target.ipv4)
    : addressed.filter((port) => port.deviceId === request.target?.deviceId);
  if (targets.length !== 1) return { ambiguous: targets.length > 1 };
  const target = targets[0];
  if (addressed.filter((port) => port.ip === target.ip).length !== 1) return { ambiguous: true };
  return { sourceId: source.id, destination: target.ip, targetId: target.deviceId };
}
// Enumerate at most two paths without treating a shutdown/cut cable as absent.
// More than one candidate means the rules must not assume a unique path.
function physicalPaths(context, sourceId, targetId) {
  const found = [];
  function visit(current, visited, path) {
    if (found.length === 2) return;
    if (current === targetId) {
      found.push(path);
      return;
    }
    for (const link of context.links) {
      const local =
        link.a.deviceId === current ? link.a : link.b.deviceId === current ? link.b : null;
      if (!local) continue;
      const peer = local === link.a ? link.b : link.a;
      if (!visited.has(peer.deviceId))
        visit(peer.deviceId, new Set([...visited, peer.deviceId]), [
          ...path,
          { link, from: local, to: peer },
        ]);
    }
  }
  visit(sourceId, new Set([sourceId]), []);
  return found;
}
const selectedRoute = (state, deviceId, destination) =>
  routeTable(state, deviceId).find((route) => inSubnet(destination, route.network, route.mask));
function probe(context, target) {
  const state = simulationClone(context);
  // transmit writes ARP/MAC caches; it only ever receives this detached clone.
  const trace = transmit(state, target.sourceId, target.destination);
  return { state, trace };
}
module.exports = { simulationClone, resolveTarget, physicalPaths, selectedRoute, probe };
