// Synthetic eval export only. Production context/redaction is a separate BE-05 task.
const engine = require('@ccna/shared/simulation/networkEngine');

const projectSnapshot = (state) => ({
  revision: state.revision,
  tick: state.tick,
  devices: Object.fromEntries(
    Object.entries(state.devices).map(([id, device]) => [
      id,
      {
        hostname: device.hostname,
        deviceType: device.deviceType,
        interfaces: Object.fromEntries(
          Object.entries(device.interfaces).map(([name, port]) => [
            name,
            {
              ipAddress: port.ipAddress,
              subnetMask: port.subnetMask,
              shutdown: port.shutdown,
              switchportMode: port.switchportMode,
              accessVlan: port.accessVlan,
            },
          ])
        ),
        vlans: Object.fromEntries(
          Object.entries(device.vlans).map(([id, vlan]) => [id, { name: vlan.name }])
        ),
        staticRoutes: device.staticRoutes.map((route) => ({
          network: route.network,
          mask: route.mask,
          nextHop: route.nextHop,
        })),
      },
    ])
  ),
  links: state.links.map((link) => ({
    id: link.id,
    a: { deviceId: link.a.deviceId, interface: link.a.interface },
    b: { deviceId: link.b.deviceId, interface: link.b.interface },
    enabled: link.enabled,
  })),
});

const apply = (initial, actions) =>
  actions.reduce((state, action) => {
    const result = engine.execute(state, action);
    if (result.isError) throw new Error(`${action.deviceId}: ${action.command}: ${result.output}`);
    return result.state;
  }, initial);

const buildPublicDataset = (lab) => {
  const solved = apply(engine.initial(lab.initialState), lab.goldenActions);
  return {
    fixtureVersion: 'disc03-v1',
    lab: {
      id: lab.id,
      title: lab.title,
      objective: lab.objective,
      commandProfile: lab.commandProfile,
      simulatorVersion: lab.simulatorVersion,
      limitations: [...lab.limitations],
    },
    cases: lab.cases.map((scenario) => {
      const probe = scenario.requestProbe || lab.probes[0];
      return {
        id: scenario.id,
        request: {
          intent: 'DIAGNOSE',
          sourceId: probe.sourceId,
          destination: probe.destination,
          question:
            'Kiểm tra kết nối này: đã đủ bằng chứng kết luận lỗi chưa và nên kiểm tra gì tiếp theo?',
        },
        context: projectSnapshot(apply(solved, scenario.actions)),
      };
    }),
  };
};

module.exports = { buildPublicDataset, projectSnapshot };
