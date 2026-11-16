import { createObservation } from './observation';
import { compareObservationEvent } from './observationComparison';

const packet = {
  src: '10.0.0.1',
  dst: '10.0.0.2',
  protocol: 'tcp',
  srcPort: 40000,
  dstPort: 80,
  ttl: 32,
};
const compare = (before, after) =>
  compareObservationEvent(createObservation({ events: [before, after] }).events, 1);
const event = (type, changes = {}, extra = {}) => ({
  type,
  deviceId: 'R1',
  packet: { ...packet, ...changes },
  ...extra,
});
test('TTL and source/destination NAT compare recorded fields at the same actor', () => {
  expect(compare(event('ACL_IN'), event('ROUTE', { ttl: 31 })).fields).toEqual([
    { label: 'TTL', before: 32, after: 31 },
  ]);
  expect(
    compare(event('ROUTE'), event('NAT_SOURCE', { src: '203.0.113.1', srcPort: 10000 })).fields
  ).toHaveLength(2);
  expect(
    compare(event('ACL_IN'), event('NAT_DESTINATION', { dst: '192.168.1.2' })).fields[0].label
  ).toBe('IP đích');
  expect(
    compare(event('ACL_IN', { ttl: 1 }), event('TTL_EXCEEDED', { ttl: 0 })).fields[0].after
  ).toBe(0);
});
test('never compares different flows, direction, actors, missing snapshots or DROP/ARP', () => {
  for (const previous of [
    event('ARP_REPLY'),
    event('DROP'),
    event('ACL_IN', {}, { deviceId: 'R2' }),
    event('ACL_IN', { dst: 'other' }),
    event('ACL_IN', {}, { packet: null }),
  ])
    expect(compare(previous, event('ROUTE', { ttl: 31 }))).toBeNull();
  expect(compare(event('ACL_IN'), event('ROUTE', { ttl: 31 }, { reply: true }))).toBeNull();
  expect(compare(event('ROUTE'), event('DROP', { ttl: 1 }))).toBeNull();
});
