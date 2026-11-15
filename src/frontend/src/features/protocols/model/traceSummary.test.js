import engine from '@ccna/shared/simulation/networkEngine';
import { transmit } from '@ccna/shared/simulation/networkPackets';
import eigrp from '@ccna/shared/labs/eigrp01';
import { createObservation } from './observation';
import { traceSummary } from './traceSummary';

test('R1 pinging its own actual interface has only local delivery and no invented router hops', () => {
  const state = engine.initial(eigrp.initialState);
  const packet = transmit(state, 'R1', '192.1.12.1');
  const summary = traceSummary(createObservation(packet), state.devices);
  expect(packet.success).toBe(true);
  expect(summary).toMatchObject({
    sourceId: 'R1',
    src: '192.1.12.1',
    dst: '192.1.12.1',
    local: true,
    sequence: false,
    actors: ['R1'],
  });
  expect(summary.notice).toMatch(/không đi qua liên kết/);
  expect(packet.events.some((event) => event.type === 'FRAME')).toBe(false);
});

test('missing fields stay absent and metadata alone does not select a multi-column sequence', () => {
  const value = traceSummary(createObservation({ events: [{ type: 'ROUTE', deviceId: 'R1' }] }));
  expect(value.src).toBeUndefined();
  expect(value.dst).toBeUndefined();
  expect(value.notice).toBe('');
  expect(value.sequence).toBe(false);
});

test('a configured EIGRP ping exposes only its real forward and reply frame hops', () => {
  const configured = eigrp.solutionActions.reduce(
    (state, action) => engine.execute(state, action).state,
    engine.initial(eigrp.initialState)
  );
  const original = JSON.stringify(configured);
  const packet = transmit(configured, 'R1', '4.4.4.4');
  const summary = traceSummary(createObservation(packet), configured.devices);
  expect(packet.success).toBe(true);
  expect(summary).toMatchObject({
    sourceId: 'R1',
    dst: '4.4.4.4',
    local: false,
    sequence: true,
    actors: ['R1', 'R2', 'R3', 'R4'],
  });
  expect(
    packet.events
      .filter((event) => event.type === 'FRAME')
      .map((event) => [event.from.deviceId, event.to.deviceId])
  ).toEqual([
    ['R1', 'R2'],
    ['R2', 'R3'],
    ['R3', 'R4'],
    ['R4', 'R3'],
    ['R3', 'R2'],
    ['R2', 'R1'],
  ]);
  expect(summary.notice).toBe('');
  expect(JSON.stringify(configured)).toBe(original);
});
