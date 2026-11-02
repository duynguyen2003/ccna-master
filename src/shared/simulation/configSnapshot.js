// Configuration only: never include CLI context, learned routes or packet caches.
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, canonical(value[key])])
    );
  }
  return value;
};
const unordered = (entries = []) =>
  [
    ...new Map(
      entries.map((entry) => {
        const normalized = canonical(entry);
        return [JSON.stringify(normalized), normalized];
      })
    ).entries(),
  ]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, entry]) => entry);

const configurationSnapshot = (device) =>
  canonical({
    hostname: device.hostname,
    deviceType: device.deviceType,
    interfaces: device.interfaces || {},
    vlans: device.vlans || {},
    defaultGateway: device.defaultGateway || null,
    // Equal-prefix/AD routes are selected in insertion order by this simulator.
    staticRoutes: device.staticRoutes || [],
    ospf: device.ospf ? { ...device.ospf, networks: unordered(device.ospf.networks) } : null,
    eigrp: device.eigrp
      ? {
          ...device.eigrp,
          networks: unordered(device.eigrp.networks),
          neighbors: unordered(device.eigrp.neighbors),
          passiveInterfaces: unordered(device.eigrp.passiveInterfaces),
        }
      : null,
    stpPriority: device.stpPriority || {},
    // ACL order affects behavior. Ignore only the original command's display text.
    acls: Object.fromEntries(
      Object.entries(device.acls || {}).map(([name, rules]) => [
        name,
        rules.map(({ text, ...rule }) => rule),
      ])
    ),
    natStatic: unordered(device.natStatic),
    natOverload: device.natOverload || null,
  });

const startupMatchesRunning = (device) =>
  Boolean(device.startupConfigModel) &&
  JSON.stringify(canonical(device.startupConfigModel)) ===
    JSON.stringify(configurationSnapshot(device));

module.exports = { configurationSnapshot, startupMatchesRunning };
