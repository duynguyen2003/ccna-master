import engine from '@ccna/shared/simulation/networkEngine';
import { transmit } from '@ccna/shared/simulation/networkPackets';
import { networkTemplate } from '../../labs/data/networkLabTemplates';
import { createObservation } from './observation';
import { packetPayload, packetTitle, packetTone } from './packetPresentation';

function routed() {
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
}

test('real ping cards show the engine IP snapshot in both directions; ARP names the actual next hop', () => {
  const packet = transmit(routed(), 'PC1', '192.168.2.10');
  const before = JSON.stringify(packet);
  const events = createObservation(packet).events;
  const frames = events.filter((event) => event.type === 'FRAME');
  expect(packetTitle(frames[0])).toBe('ICMP · Yêu cầu');
  expect(packetPayload(frames[0])).toEqual(['192.168.1.10 → 192.168.2.10', 'ICMP · TTL 32']);
  expect(packetTitle(frames.at(-1))).toBe('ICMP · Phản hồi');
  expect(packetPayload(frames.at(-1))[0]).toBe('192.168.2.10 → 192.168.1.10');
  const arp = events.find((event) => event.type === 'ARP_REQUEST');
  expect(packetTitle(arp)).toBe('ARP REQUEST');
  expect(packetPayload(arp)[0]).toBe('Who has 192.168.1.1?');
  expect(packetPayload(arp).join(' ')).not.toContain('192.168.2.10');
  expect(packetTone(arp)).toBe('amber');
  expect(JSON.stringify(packet)).toBe(before);
});

test('NAT cards use the translated snapshot and TTL failures preserve zero without inventing headers', () => {
  let state = routed();
  for (const command of [
    'enable',
    'conf t',
    'ip nat inside source static 192.168.1.10 10.0.0.100',
    'interface g0/0',
    'ip nat inside',
    'exit',
    'interface g0/1',
    'ip nat outside',
    'end',
  ]) {
    const result = engine.execute(state, { type: 'command', deviceId: 'R1', command });
    expect(result.isError).toBe(false);
    state = result.state;
  }
  const events = createObservation(transmit(state, 'PC1', '192.168.2.10')).events;
  const source = events.find((event) => event.type === 'NAT_SOURCE');
  const destination = events.find((event) => event.type === 'NAT_DESTINATION');
  expect(packetTitle(source)).toBe('SNAT');
  expect(packetTone(source)).toBe('teal');
  expect(packetPayload(source)[0]).toBe('10.0.0.100 → 192.168.2.10');
  expect(packetTitle(destination)).toBe('DNAT');
  expect(packetPayload(destination)[0]).toBe('192.168.2.10 → 192.168.1.10');
  const ttl = createObservation(transmit(routed(), 'PC1', '192.168.2.10', { ttl: 1 })).events.find(
    (event) => event.type === 'TTL_EXCEEDED'
  );
  expect(packetTitle(ttl)).toBe('TTL EXCEEDED');
  expect(packetPayload(ttl)[1]).toBe('ICMP · TTL 0');
  expect(packetTone(ttl)).toBe('danger');
});

test('native lesson payloads and supported IP aliases retain their existing content', () => {
  const native = { label: 'ACK', raw: { color: 'slate', payload: ['seq=1 ack=1'] } };
  expect(packetTitle(native)).toBe('ACK');
  expect(packetPayload(native)).toEqual(['seq=1 ack=1']);
  expect(packetTone(native)).toBe('slate');
  expect(packetPayload({ raw: { packet: { srcIp: '10.0.0.1', dstIp: '10.0.0.2' } } })).toEqual([
    '10.0.0.1 → 10.0.0.2',
  ]);
  expect(packetPayload({ label: 'No data' })).toEqual([]);
});
