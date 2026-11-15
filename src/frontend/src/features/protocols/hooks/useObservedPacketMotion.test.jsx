// SVG path geometry and visibility have no accessible role to query.
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from 'react';
import { act, render } from '@testing-library/react';
import '@testing-library/jest-dom';
import engine from '@ccna/shared/simulation/networkEngine';
import NetworkTopology from '../../labs/components/NetworkTopology';
import { networkTemplate } from '../../labs/data/networkLabTemplates';
import { gsap } from '../../labs/utils/labMotion';
import { createObservation } from '../model/observation';
import useObservationPlayback from './useObservationPlayback';

const snapshot = { src: '192.168.1.10', dst: '192.168.2.10', protocol: 'icmp', ttl: 32 };
const packet = {
  events: [
    { type: 'ARP_REQUEST', deviceId: 'PC1', detail: 'Who has 192.168.1.1?', packet: snapshot },
    {
      type: 'FRAME',
      from: networkTemplate.links[0].a,
      to: networkTemplate.links[0].b,
      packet: snapshot,
    },
    { type: 'TTL_EXCEEDED', deviceId: 'R1', packet: { ...snapshot, ttl: 0 } },
  ],
};
let playback;
function Harness({ state, trace = packet }) {
  playback = useObservationPlayback(createObservation(trace, 'trace-1'), { autoPlay: false });
  return <NetworkTopology {...state} observation={playback} />;
}

test('seeking and equivalent polling preserve one clock; changed geometry only rebuilds its visual child', () => {
  const spy = jest.spyOn(gsap, 'timeline');
  const state = engine.initial(networkTemplate);
  const { container, rerender, unmount } = render(<Harness state={state} />);
  const clock = playback.timelineRef.current.timeline;
  const visualBuilds = () => spy.mock.calls.filter(([options]) => options?.onUpdate).length;
  const builds = visualBuilds();
  act(() => playback.select(1));
  expect(container.querySelector('.packet-visual__title')).toHaveTextContent('ICMP · Yêu cầu');
  expect(container.querySelector('.network-traffic-layer')).toHaveAttribute(
    'visibility',
    'visible'
  );
  expect(container.querySelector('.network-link.is-observed')).not.toBeNull();
  expect(Number(container.querySelector('.network-packet-gsap').style.opacity)).toBe(1);
  expect(Number(gsap.getProperty(container.querySelector('.network-packet-gsap'), 'x'))).toBe(100);
  expect(Number(gsap.getProperty(container.querySelector('.network-packet-gsap'), 'y'))).toBe(280);
  const time = clock.time();
  rerender(
    <Harness state={JSON.parse(JSON.stringify(state))} trace={JSON.parse(JSON.stringify(packet))} />
  );
  expect(playback.timelineRef.current.timeline).toBe(clock);
  expect(visualBuilds()).toBe(builds);
  expect(clock.time()).toBe(time);
  const moved = JSON.parse(JSON.stringify(state));
  moved.devices.R1.position.x += 40;
  rerender(<Harness state={moved} />);
  expect(playback.timelineRef.current.timeline).toBe(clock);
  expect(clock.time()).toBe(time);
  expect(visualBuilds()).toBe(builds + 1);
  act(() => playback.select(2));
  expect(container.querySelector('.packet-visual__title')).toHaveTextContent('TTL EXCEEDED');
  expect(container.querySelector('.network-diagram')).toHaveClass('packet-tone--danger');
  unmount();
  spy.mockRestore();
});

test('reduced motion keeps each selected event visible with a static real path or failure marker', () => {
  const original = window.matchMedia;
  window.matchMedia = () => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  try {
    const { container, unmount } = render(<Harness state={engine.initial(networkTemplate)} />);
    const clock = playback.timelineRef.current.timeline;
    act(() => playback.select(0));
    expect(container.querySelector('.network-traffic-layer')).toHaveAttribute(
      'visibility',
      'visible'
    );
    expect(container.querySelector('.packet-visual__title')).toHaveTextContent('ARP REQUEST');
    expect(container.querySelector('.network-link.is-observed')).toBeNull();
    act(() => playback.select(1));
    const path = container.querySelector('.network-packet-route');
    expect(path.getAttribute('d')).toMatch(/^M 100 280 /);
    expect(Number(path.style.opacity)).toBeGreaterThan(0);
    act(() => playback.select(2));
    expect(Number(container.querySelector('.network-packet-cross').style.opacity)).toBe(1);
    const visual = clock.getChildren(false, false, true)[0];
    expect(visual.getChildren().every((child) => child.duration() === 0)).toBe(true);
    expect(playback.status).toBe('paused');
    act(() => playback.reset());
    expect(container.querySelector('.packet-visual__title')).toHaveTextContent('ARP REQUEST');
    expect(container.querySelector('.network-traffic-layer')).toHaveAttribute(
      'visibility',
      'visible'
    );
    expect(Number(container.querySelector('.network-packet-gsap').style.opacity)).toBe(1);
    unmount();
  } finally {
    window.matchMedia = original;
  }
});

test('an ambiguous wire never invents a flight but node events remain available', () => {
  const state = engine.initial(networkTemplate);
  state.links.push({ ...state.links[0], id: 'ambiguous-wire' });
  const { container, unmount } = render(<Harness state={state} />);
  act(() => playback.select(1));
  expect(container.querySelector('.network-traffic-layer')).toHaveAttribute('visibility', 'hidden');
  expect(container.querySelector('.network-link.is-observed')).toBeNull();
  act(() => playback.reset());
  expect(container.querySelector('.network-traffic-layer')).toHaveAttribute(
    'visibility',
    'visible'
  );
  expect(container.querySelector('[data-device-id="PC1"]')).toHaveClass('is-observed');
  unmount();
});
