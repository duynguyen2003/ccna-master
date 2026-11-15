import engine from '@ccna/shared/simulation/networkEngine';
import { transmit } from '@ccna/shared/simulation/networkPackets';
import { networkTemplate } from '../data/networkLabTemplates';
import { packetAnimationKey, packetAnimationSteps } from './topologyPackets';

const routed = () => {
  const state = engine.initial(networkTemplate);
  state.devices.R1.staticRoutes.push({
    network: '192.168.2.0',
    mask: '255.255.255.0',
    nextHop: '10.0.0.2',
  });
  state.devices.R2.staticRoutes.push({
    network: '192.168.1.0',
    mask: '255.255.255.0',
    nextHop: '10.0.0.1',
  });
  return state;
};

test('real ping traces retain every interface hop and separate the request from the reply', () => {
  const packet = transmit(routed(), 'PC1', '192.168.2.10');
  expect(packet.success).toBe(true);
  const before = JSON.stringify(packet);
  const hops = packetAnimationSteps(packet).filter((step) => step.kind === 'hop');
  const frames = packet.events.filter((event) => event.type === 'FRAME');
  expect(hops.map((hop) => [hop.from, hop.fromInterface, hop.to, hop.toInterface])).toEqual(
    frames.map((event) => [
      event.from.deviceId,
      event.from.interface,
      event.to.deviceId,
      event.to.interface,
    ])
  );
  expect(hops.map((hop) => hop.phase)).toEqual([
    'request',
    'request',
    'request',
    'reply',
    'reply',
    'reply',
  ]);
  expect(hops[0].label).toBe('Ping · Yêu cầu');
  expect(hops.at(-1).label).toBe('Ping · Phản hồi');
  expect(JSON.stringify(packet)).toBe(before);
});

test('a failed return path keeps the actual reply hops then marks the failing router', () => {
  const state = routed();
  state.devices.R2.staticRoutes = [];
  const packet = transmit(state, 'PC1', '192.168.2.10');
  expect(packet.success).toBe(false);
  const steps = packetAnimationSteps(packet);
  const reply = steps.filter((step) => step.kind === 'hop' && step.phase === 'reply');
  expect(reply.map((hop) => [hop.from, hop.to])).toEqual([['PC2', 'R2']]);
  expect(steps.at(-1)).toMatchObject({ kind: 'drop', deviceId: 'R2' });
});

test('ARP and route metadata do not create imaginary packet travel', () => {
  const packet = {
    events: [
      { type: 'ROUTE', deviceId: 'R1' },
      { type: 'ARP_REQUEST', deviceId: 'R1' },
      { type: 'ARP_TIMEOUT', deviceId: 'R2' },
      { type: 'DROP', deviceId: 'R1' },
    ],
  };
  expect(packetAnimationSteps(packet).map((step) => step.kind)).toEqual(['signal', 'drop']);
});

test('identical polling data has a stable signature but a new probe can replay the same route', () => {
  const packet = transmit(routed(), 'PC1', '192.168.2.10');
  expect(packetAnimationKey(JSON.parse(JSON.stringify(packet)))).toBe(packetAnimationKey(packet));
  expect(packetAnimationKey({ ...packet, animationKey: 'probe-1' })).not.toBe(
    packetAnimationKey({ ...packet, animationKey: 'probe-2' })
  );
  expect(packetAnimationKey(null)).toBe('');
});
