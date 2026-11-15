import React, { useState } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import PacketTracePanel from './PacketTracePanel';
import { createObservation } from '../../protocols/model/observation';

const snapshot = { src: '10.0.0.1', dst: '10.0.2.3', protocol: 'icmp' };
const model = createObservation(
  {
    success: true,
    events: [
      { type: 'ROUTE', deviceId: 'R1', packet: snapshot },
      { type: 'FRAME', from: { deviceId: 'R1' }, to: { deviceId: 'R2' }, packet: snapshot },
      { type: 'ROUTE', deviceId: 'R2', packet: snapshot },
      { type: 'FRAME', from: { deviceId: 'R2' }, to: { deviceId: 'R3' }, packet: snapshot },
      { type: 'DELIVERED', deviceId: 'R3', packet: snapshot },
      { type: 'REPLY_DELIVERED', deviceId: 'R1', packet: snapshot },
    ],
  },
  'multi-hop'
);

function Harness({ source = model }) {
  const [mode, setMode] = useState('closed');
  const [index, select] = useState(0);
  const playback = {
    model: source,
    index,
    select,
    status: 'paused',
    speed: 1,
    play: jest.fn(),
    pause: jest.fn(),
    reset: () => select(0),
    setSpeed: jest.fn(),
    step: (direction) => select((current) => current + direction),
  };
  return (
    <>
      <button onClick={() => setMode('quick')}>Mở lại khung</button>
      <PacketTracePanel playback={playback} mode={mode} onModeChange={setMode} />
    </>
  );
}

test('collapse removes playback controls, hiding removes the panel, reopening keeps the selected event', () => {
  render(<Harness />);
  expect(screen.queryByRole('group', { name: 'Điều khiển hành trình' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mở hành trình gói tin' }));
  const preview = screen.getByRole('region', { name: 'Sequence: thứ tự gửi và nhận' });
  expect(within(preview).getAllByRole('button')).toHaveLength(2);
  fireEvent.click(screen.getByRole('combobox', { name: 'Chuyển đến sự kiện' }));
  fireEvent.click(screen.getByRole('option', { name: '5. Đã tới đích · R3' }));
  expect(screen.getByLabelText('Vị trí sự kiện')).toHaveTextContent('5/6');
  expect(within(preview).getByRole('button', { name: /Sự kiện 5:/ })).toHaveAttribute(
    'aria-current',
    'step'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Thu gọn hành trình gói tin' }));
  expect(screen.queryByLabelText('Vị trí sự kiện')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Ẩn hành trình gói tin' }));
  expect(
    screen.queryByRole('region', { name: 'Hành trình gói tin', exact: true })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mở lại khung' }));
  expect(screen.getByLabelText('Vị trí sự kiện')).toHaveTextContent('5/6');
});

test('multi-hop details open as a full sequence and share the same event with preview and list', () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Mở lại khung' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sự kiện tiếp theo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết' }));
  expect(screen.getByRole('button', { name: 'Trình tự', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  const sequence = screen.getByRole('region', { name: 'Sequence: thứ tự gửi và nhận' });
  expect(within(sequence).getAllByRole('button')).toHaveLength(6);
  fireEvent.keyDown(within(sequence).getByRole('button', { name: /Sự kiện 4:/ }), { key: 'Enter' });
  expect(screen.getByLabelText('Vị trí sự kiện')).toHaveTextContent('4/6');
  fireEvent.click(screen.getByRole('button', { name: 'Sự kiện', exact: true }));
  expect(screen.getByRole('button', { name: 'Sự kiện 4: Chuyển frame' })).toHaveAttribute(
    'aria-current',
    'step'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Về bản xem nhanh' }));
  expect(screen.getByLabelText('Vị trí sự kiện')).toHaveTextContent('4/6');
  fireEvent.keyDown(screen.getByRole('button', { name: 'Sự kiện tiếp theo' }), { key: 'Escape' });
  expect(screen.getByRole('button', { name: 'Mở hành trình gói tin' })).toHaveAttribute(
    'aria-expanded',
    'false'
  );
});

test('a self ping stays a local timeline and explains that no network link is involved', () => {
  const packet = { src: '192.1.12.1', dst: '192.1.12.1', protocol: 'icmp' };
  const local = createObservation({
    success: true,
    events: [
      { type: 'DELIVERED', deviceId: 'R1', packet },
      { type: 'REPLY_DELIVERED', deviceId: 'R1', packet },
    ],
  });
  render(<Harness source={local} />);
  fireEvent.click(screen.getByRole('button', { name: 'Mở lại khung' }));
  expect(screen.queryByRole('region', { name: /Sequence:/ })).not.toBeInTheDocument();
  expect(screen.getByText(/không đi qua liên kết mạng/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sự kiện 2: Đã nhận phản hồi' }));
  expect(screen.getByLabelText('Vị trí sự kiện')).toHaveTextContent('2/2');
});
