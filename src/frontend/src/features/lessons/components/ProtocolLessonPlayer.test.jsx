import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import ProtocolLessonPlayer, { LoadedProtocolLesson } from './ProtocolLessonPlayer';
import lesson from '../../protocols/data/lessons/tcp.json';
import { loadProtocolLesson } from '../../protocols/data/lessonCatalog';

jest.mock('../../protocols/data/lessonCatalog', () => ({
  catalogVersion: 'test',
  loadProtocolLesson: jest.fn(),
}));
beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});
test('switching Network/Sequence preserves event, speed and timeline; viewing persists separately', () => {
  const { unmount } = render(<LoadedProtocolLesson lesson={lesson} userId={7} lessonId={12} />);
  fireEvent.click(screen.getByRole('combobox', { name: 'Sự kiện' }));
  fireEvent.click(screen.getByRole('option', { name: /^6\./ }));
  fireEvent.click(screen.getByRole('combobox', { name: 'Tốc độ phát' }));
  fireEvent.click(screen.getByRole('option', { name: '2×', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Trình tự' }));
  expect(screen.getByRole('combobox', { name: 'Sự kiện' })).toHaveTextContent(/^6\./);
  expect(screen.getByRole('combobox', { name: 'Tốc độ phát' })).toHaveTextContent('2×');
  expect(
    within(screen.getByRole('region', { name: 'Sequence: thứ tự gửi và nhận' })).getByRole(
      'button',
      { current: 'step' }
    )
  ).toHaveAccessibleName(/Sự kiện 6:/);
  fireEvent.click(screen.getByRole('button', { name: 'Sơ đồ mạng' }));
  expect(screen.getByRole('combobox', { name: 'Sự kiện' })).toHaveTextContent(/^6\./);
  expect(JSON.parse(localStorage.getItem('netmaster:protocol-view:test:tcp:12:7'))).toHaveLength(1);
  expect(localStorage.length).toBe(1);
  unmount();
});
test('preview never writes progress; denied storage keeps the player usable', () => {
  const { unmount } = render(<LoadedProtocolLesson lesson={lesson} />);
  fireEvent.click(screen.getByRole('button', { name: 'Sự kiện tiếp theo' }));
  expect(localStorage.length).toBe(0);
  unmount();
  const blocked = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  render(<LoadedProtocolLesson lesson={lesson} userId={7} />);
  expect(screen.getByText(/Không lưu được tiến độ/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sự kiện tiếp theo' }));
  expect(screen.getByRole('combobox', { name: 'Sự kiện' })).toHaveTextContent(/^2\./);
  blocked.mockRestore();
});

test('scrolling long information survives a view change and resets for the next event', () => {
  render(<LoadedProtocolLesson lesson={lesson} />);
  fireEvent.click(screen.getByRole('button', { name: 'Sự kiện tiếp theo' }));
  const explanation = screen.getByRole('region', { name: 'Giải thích sự kiện' });
  const inspector = screen.getByRole('region', { name: 'Chi tiết sự kiện' });
  const information = screen.getByRole('group', { name: 'Thông tin sự kiện' });
  expect(explanation).toHaveAttribute('tabindex', '0');
  expect(inspector).toHaveAttribute('tabindex', '0');
  explanation.scrollTop = 90;
  inspector.scrollTop = 220;
  information.scrollTop = 120;
  fireEvent.click(screen.getByRole('button', { name: 'Trình tự' }));
  expect(explanation.scrollTop).toBe(90);
  expect(inspector.scrollTop).toBe(220);
  fireEvent.click(screen.getByRole('button', { name: 'Sự kiện tiếp theo' }));
  expect(explanation.scrollTop).toBe(0);
  expect(inspector.scrollTop).toBe(0);
  expect(information.scrollTop).toBe(0);
});

test('phase selection synchronizes events and hides empty technical details at the final HTTP render', () => {
  const http = require('../../protocols/data/lessons/http.json');
  render(<LoadedProtocolLesson lesson={http} userId={8} />);
  const phases = screen.getByRole('navigation', { name: 'Các giai đoạn mô phỏng' });
  fireEvent.click(within(phases).getAllByRole('button')[3]);
  expect(screen.getByRole('combobox', { name: 'Sự kiện', exact: true })).toHaveTextContent(
    '10. GET /'
  );
  expect(within(phases).getAllByRole('button')[3]).toHaveAttribute('aria-current', 'step');
  expect(screen.getByRole('heading', { name: 'Chi tiết sự kiện' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('combobox', { name: 'Sự kiện', exact: true }));
  fireEvent.click(screen.getByRole('option', { name: /^13\./ }));
  expect(screen.queryByRole('heading', { name: 'Chi tiết sự kiện' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Điều gì đang xảy ra?' })).toBeInTheDocument();
  expect(screen.queryByText(/Simulator chưa ghi/)).not.toBeInTheDocument();
});
test('failed lesson load can retry and late requests cannot replace a new protocol', async () => {
  loadProtocolLesson.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(lesson);
  const { rerender } = render(<ProtocolLessonPlayer protocolId="tcp" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByRole('heading', { name: 'TCP' })).toBeInTheDocument();
  let resolveOld;
  loadProtocolLesson
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        })
    )
    .mockResolvedValueOnce(lesson);
  rerender(<ProtocolLessonPlayer protocolId="udp" />);
  rerender(<ProtocolLessonPlayer protocolId="tcp" />);
  expect(await screen.findByRole('heading', { name: 'TCP' })).toBeInTheDocument();
  await act(async () => {
    resolveOld({ ...lesson, id: 'udp', name: 'UDP' });
  });
  expect(screen.queryByRole('heading', { name: 'UDP' })).not.toBeInTheDocument();
});
