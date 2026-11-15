import React from 'react';
/* eslint-disable testing-library/no-container, testing-library/no-node-access -- SVG arrow geometry has no semantic query. */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import PacketSequenceView from './PacketSequenceView';
import { createObservation } from '../model/observation';

test('only frames get arrows, local decisions remain annotations and keyboard selects shared event', () => {
  const select = jest.fn();
  const model = createObservation({
    events: [
      { type: 'ROUTE', deviceId: 'R1' },
      { type: 'FRAME', from: { deviceId: 'R1' }, to: { deviceId: 'R2' } },
    ],
  });
  const { container, rerender } = render(
    <PacketSequenceView playback={{ model, index: 0, select }} />
  );
  expect(container.querySelectorAll('.packet-sequence__arrow')).toHaveLength(1);
  const arrow = container.querySelector('.packet-sequence__arrow');
  expect(Number(arrow.getAttribute('y2'))).toBeGreaterThan(Number(arrow.getAttribute('y1')));
  fireEvent.keyDown(screen.getByRole('button', { name: /Sự kiện 2/ }), { key: 'Enter' });
  expect(select).toHaveBeenCalledWith(1);
  rerender(<PacketSequenceView playback={{ model, index: 1, select }} />);
  expect(screen.getByRole('button', { name: /Sự kiện 2/ })).toHaveAttribute('aria-current', 'step');
});

test('preview follows the global index with two adjacent rows and preserves exact frame direction', () => {
  const select = jest.fn();
  const model = createObservation({
    events: Array.from({ length: 12 }, (_, index) =>
      index % 2 === 0
        ? { type: 'ROUTE', deviceId: 'R2' }
        : { type: 'FRAME', from: { deviceId: 'R2' }, to: { deviceId: 'R1' } }
    ),
  });
  const { container, rerender } = render(
    <PacketSequenceView
      playback={{ model: { ...model, lifelines: ['R1', 'R2'] }, index: 8, select }}
      preview
    />
  );
  expect(screen.getAllByRole('button')).toHaveLength(2);
  expect(screen.getByRole('button', { name: /Sự kiện 9:/ })).toHaveAttribute(
    'aria-current',
    'step'
  );
  const arrow = container.querySelector('.packet-sequence__arrow');
  expect(Number(arrow.getAttribute('x1'))).toBeGreaterThan(Number(arrow.getAttribute('x2')));
  fireEvent.keyDown(screen.getByRole('button', { name: /Sự kiện 8:/ }), { key: ' ' });
  expect(select).toHaveBeenCalledWith(7);
  rerender(<PacketSequenceView playback={{ model, index: 11, select }} preview />);
  expect(screen.getByRole('button', { name: /Sự kiện 12:/ })).toHaveAttribute(
    'aria-current',
    'step'
  );
  expect(screen.queryByRole('button', { name: /Sự kiện 8:/ })).not.toBeInTheDocument();
});

test('fit columns uses a wide sidebar without forcing the full-page minimum canvas width', () => {
  const measure = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(620);
  try {
    const model = createObservation({
      events: [
        { type: 'FRAME', from: { deviceId: 'R1' }, to: { deviceId: 'R2' } },
        { type: 'FRAME', from: { deviceId: 'R2' }, to: { deviceId: 'R3' } },
        { type: 'FRAME', from: { deviceId: 'R3' }, to: { deviceId: 'R4' } },
      ],
    });
    const { container } = render(
      <PacketSequenceView playback={{ model, index: 0, select: jest.fn() }} fitColumns />
    );
    expect(container.querySelector('svg')).toHaveAttribute('width', '620');
    expect(screen.getAllByRole('button')).toHaveLength(3);
  } finally {
    measure.mockRestore();
  }
});
