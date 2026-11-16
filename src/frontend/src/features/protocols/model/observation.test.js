import { createObservation, observationKey, observationWire } from './observation';

test('ARP metadata stays separate from the waiting IP probe; missing fields stay absent', () => {
  const packet = {
    events: [
      {
        type: 'ARP_REQUEST',
        deviceId: 'R1',
        srcMac: 'aa',
        dstMac: 'ff',
        packet: { src: '10.0.0.1', dst: '10.0.0.2', protocol: 'udp', ttl: 0, srcPort: 0 },
      },
    ],
  };
  const model = createObservation(packet, 'probe-1');
  expect(model.events[0].groups).toEqual([
    {
      title: 'Thiết bị và liên kết',
      fields: [
        ['Thiết bị', 'R1'],
        ['MAC nguồn', 'aa'],
        ['MAC đích', 'ff'],
      ],
    },
    {
      title: 'Probe liên quan đến ARP',
      fields: [
        ['IP nguồn', '10.0.0.1'],
        ['IP đích', '10.0.0.2'],
        ['Giao thức', 'UDP'],
        ['Cổng nguồn', 0],
        ['TTL', 0],
      ],
    },
  ]);
  expect(JSON.stringify(model)).not.toMatch(/checksum|hex|srcPort.*40000/);
  expect(packet.events[0]).not.toHaveProperty('phase');
});

test('request/reply and the first recorded failure follow events without rewriting DROP headers', () => {
  const model = createObservation(
    {
      success: false,
      reason: 'ACL inbound',
      events: [
        { type: 'DELIVERED', deviceId: 'PC2' },
        { type: 'FRAME', from: { deviceId: 'PC2' }, to: { deviceId: 'R1' }, packet: { ttl: 31 } },
        { type: 'ACL_IN', deviceId: 'R1', detail: 'deny ip any any' },
        { type: 'DROP', deviceId: 'R1', packet: { ttl: 32 } },
      ],
    },
    'p'
  );
  expect(model.events.map((e) => e.phase)).toEqual(['request', 'reply', 'reply', 'reply']);
  expect(model.firstFailure).toBe(2);
  expect(model.events[3].groups[1].fields).toEqual([['TTL', 32]]);
  expect(model.events[3].description).toMatch(/đầu vào/);
  expect(model.reason).toBe('ACL inbound');
});

test('parallel links require a unique match and preserve both interface endpoints', () => {
  const wires = [1, 2].map((n) => ({
    link: {
      id: `L${n}`,
      a: { deviceId: 'R1', interface: `Gi0/${n}` },
      b: { deviceId: 'R2', interface: `Gi1/${n}` },
    },
  }));
  expect(
    observationWire(wires, { type: 'FRAME', from: { deviceId: 'R1' }, to: { deviceId: 'R2' } })
  ).toBeNull();
  expect(
    observationWire(wires, {
      type: 'FRAME',
      from: { deviceId: 'R2', interface: 'Gi1/2' },
      to: { deviceId: 'R1', interface: 'Gi0/2' },
    })
  ).toBe(wires[1]);
  expect(
    observationWire(wires, { type: 'ROUTE', from: wires[0].link.a, to: wires[0].link.b })
  ).toBeNull();
});

test('generic probe port metadata is not presented as ICMP transport ports', () => {
  const [event] = createObservation({
    events: [{ type: 'FRAME', packet: { protocol: 'icmp', srcPort: 40000, dstPort: 0, ttl: 32 } }],
  }).events;
  const fields = event.groups.flatMap((group) => group.fields);
  expect(fields).toContainEqual(['TTL', 32]);
  expect(fields.some(([label]) => label === 'Cổng nguồn' || label === 'Cổng đích')).toBe(false);
});

test('equivalent polls keep identity; different runs or changed facts replace it', () => {
  const packet = { events: [{ type: 'FRAME', packet: { ttl: 4 } }] };
  expect(observationKey(packet, 'run1')).toBe(
    observationKey(JSON.parse(JSON.stringify(packet)), 'run1')
  );
  expect(observationKey(packet, 'run1')).not.toBe(observationKey(packet, 'run2'));
  expect(observationKey(packet, 'run1')).not.toBe(
    observationKey({ ...packet, success: true }, 'run1')
  );
  expect(createObservation(null).events).toEqual([]);
});
