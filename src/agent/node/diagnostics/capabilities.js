const { VERSION, LIMITS } = require('./catalog');
// Captured from the complete server state before BE-02 projects out advanced
// features. Only this boolean/version is retained; never private field values.
function snapshotSupport(state) {
  const devices = Object.values(state?.devices || {});
  const advanced = devices.some(
    (device) =>
      device.ospf ||
      device.eigrp ||
      Object.keys(device.acls || {}).length ||
      device.natOverload ||
      (device.natStatic || []).length ||
      (device.natTranslations || []).length ||
      Object.keys(device.stpPriority || {}).length ||
      (device.ospfRoutes || []).length ||
      (device.eigrpRoutes || []).length ||
      Object.entries(device.interfaces || {}).some(
        ([name, port]) =>
          name.startsWith('Loopback') ||
          port.aclIn ||
          port.aclOut ||
          port.natRole ||
          port.allowedVlans != null ||
          port.nativeVlan != null
      ) ||
      (device.staticRoutes || []).some(
        (route) => route.adminDistance != null && route.adminDistance !== 1
      )
  );
  const types = new Set(devices.map((device) => device.deviceType));
  const bounded =
    devices.length > 0 &&
    devices.length <= LIMITS.devices &&
    (state?.links || []).length <= LIMITS.links &&
    devices.every(
      (device) =>
        ['ROUTER', 'SWITCH', 'PC'].includes(device.deviceType) &&
        Object.keys(device.interfaces || {}).length <= LIMITS.interfaces &&
        (device.staticRoutes || []).length <= LIMITS.routes
    );
  return {
    version: VERSION,
    supported: Boolean(bounded && !advanced && !(types.has('ROUTER') && types.has('SWITCH'))),
  };
}
module.exports = { snapshotSupport };
