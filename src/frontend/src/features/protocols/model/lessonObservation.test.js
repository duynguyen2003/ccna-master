import { createLessonObservation } from './lessonObservation';
import { lessonVietnamese } from '../data/lessonVietnamese';
import { protocolCatalog, protocolForLesson, setLessonProtocol } from '../data/lessonCatalog';
import scene from '../data/lessons/scene.json';
import { compactLessonPositions, lessonCamera, lessonFlight, lessonRoute } from './lessonScene';

test('all 39 lessons and 231 translated phases preserve source events and valid routes', () => {
  let steps = 0;
  let events = 0;
  for (const { id } of protocolCatalog) {
    const lesson = require(`../data/lessons/${id}.json`);
    const model = createLessonObservation(lesson, id);
    steps += lesson.steps.length;
    expect(lesson.teaching?.steps || lessonVietnamese[id]).toHaveLength(lesson.steps.length);
    events += model.events.length;
    expect(model.events.map((event) => event.raw)).toEqual(
      lesson.steps.flatMap((step) =>
        step.events.flatMap((event) => (event.type === 'stream' ? event.packets : [event]))
      )
    );
    expect(new Set(model.events.map((event) => event.id)).size).toBe(model.events.length);
    model.events.forEach((event) => {
      expect(event.description.length).toBeGreaterThan(30);
    });
    model.events
      .filter((event) => event.kind === 'frame')
      .forEach((event) => {
        const route = lessonRoute(event.raw, lesson);
        expect(route.length).toBeGreaterThan(0);
        expect(route[0].split('>')[0]).toBe(event.from.deviceId);
        expect(route[route.length - 1].split('>')[1]).toBe(event.to.deviceId);
        route
          .flatMap((edge) => edge.split('>'))
          .forEach((node) => {
            expect(scene.positions[node]).toBeDefined();
            expect(event.visible).toContain(node);
          });
        const segments = lessonFlight(event.raw, undefined, lesson).segments;
        expect(segments.length).toBeGreaterThan(0);
        expect(segments.length).toBeLessThanOrEqual(route.length);
        expect(segments.length === route.length || event.failure).toBe(true);
      });
    for (const event of model.events) {
      const positions = compactLessonPositions(event.visible);
      const camera = lessonCamera(undefined, event.visible, positions).split(' ').map(Number);
      expect(camera.every(Number.isFinite)).toBe(true);
      event.visible.forEach((id) => expect(lesson.nodes).toContain(id));
    }
  }
  expect(protocolCatalog).toHaveLength(39);
  expect(steps).toBe(231);
  expect(events).toBe(694);
});

test('address changes are reversible snapshots and preserve existing DHCP progress IDs', () => {
  const model = createLessonObservation(require('../data/lessons/ipv6.json'), 'ipv6');
  expect(model.events[0].nodeLabels.client[1]).toBe('Chưa có địa chỉ IPv6');
  const labels = model.events.filter((event) => event.raw.type === 'label');
  expect(labels.map((event) => event.nodeLabels.client[1])).toEqual([
    'fe80::8d2e:4f61:a9b0:7c13',
    '2001:db8:1234:5678:…',
  ]);
  expect(model.events[0].nodeLabels.client[1]).toBe('Chưa có địa chỉ IPv6');
  const dhcp = createLessonObservation(require('../data/lessons/dhcp.json'), 'dhcp');
  const withoutNewLabels = dhcp.events.filter((event) => event.raw.type !== 'label');
  expect(withoutNewLabels.map((event, i) => event.id)).toEqual(
    withoutNewLabels.map((event, i) => `dhcp-${event.stepIndex}-${i}`)
  );
  expect(dhcp.events.find((event) => event.raw.type === 'label').nodeLabels.client[1]).toBe(
    '192.168.1.10'
  );
});

test('switched routes follow physical links and MAC addresses are not taught as IP addresses', () => {
  const lesson = require('../data/lessons/ethernet.json');
  expect(lessonRoute({ from: 'client', to: 'lan' }, lesson)).toEqual([
    'client>switch',
    'switch>lan',
  ]);
  const model = createLessonObservation(lesson, 'ethernet');
  const packet = model.events.find((event) => event.raw.row?.src?.includes(':'));
  expect(
    packet.groups.flatMap((group) => group.fields).find(([name]) => name === 'IP nguồn')
  ).toBeUndefined();
  expect(
    packet.groups
      .flatMap((group) => group.fields)
      .some(([name]) => ['MAC nguồn', 'Nguồn'].includes(name))
  ).toBe(true);
  expect(model.lifelines).toEqual(lesson.lifelines);
});
test('lost TCP and UDP packets remain explicit, preserving wire facts without synthesizing TTL', () => {
  for (const id of ['tcp', 'udp']) {
    const model = createLessonObservation(require(`../data/lessons/${id}.json`), id);
    expect(model.events.filter((event) => event.failure)).toHaveLength(1);
    expect(model.events[model.firstFailure].kind).toBe('frame');
    expect(model.events[model.firstFailure].groups[0].fields.some(([name]) => name === 'TTL')).toBe(
      false
    );
  }
});

test('stream packets overlap using the source spacing and reserve the longest flight', () => {
  const lesson = require('../data/lessons/tcp.json');
  const source = lesson.steps
    .flatMap((step) => step.events)
    .find((event) => event.type === 'stream' && event.packets.length > 1);
  const model = createLessonObservation(lesson, 'stream');
  const first = model.events.findIndex((event) => event.raw === source.packets[0]);
  const next = model.events.findIndex((event) => event.raw === source.packets[1]);
  expect(model.starts[next] - model.starts[first]).toBeCloseTo((source.spacing ?? 480) / 1000);
  expect(model.starts[next]).toBeLessThan(model.starts[first] + model.events[first].duration);
  const after = first + source.packets.length;
  expect(model.starts[after]).toBeGreaterThanOrEqual(
    Math.max(
      ...source.packets.map((_, i) => model.starts[first + i] + model.events[first + i].duration)
    )
  );
});
test('lesson association is explicit, rejects ambiguous/unknown IDs and preserves other content', () => {
  const text = '# HTTP is a topic\n\nSome content';
  expect(protocolForLesson(text)).toBeNull();
  expect(protocolForLesson(setLessonProtocol(text, 'dns'))).toBe('dns');
  expect(setLessonProtocol(setLessonProtocol(text, 'dns'))).toBe(text);
  expect(protocolForLesson('<!-- netmaster-protocol:wat -->')).toBeNull();
  expect(
    protocolForLesson('<!-- netmaster-protocol:dns --><!-- netmaster-protocol:ip -->')
  ).toBeNull();
  expect(setLessonProtocol(null)).toBe('');
  expect(setLessonProtocol(setLessonProtocol('Draft\n\n ', 'tcp'))).toBe('Draft\n\n ');
});
