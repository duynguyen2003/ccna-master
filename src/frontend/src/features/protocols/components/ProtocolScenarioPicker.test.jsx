import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProtocolScenarioPicker from './ProtocolScenarioPicker';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

test('large catalogs preserve protocol/scenario hierarchy, search accents, filter and select the exact scenario', () => {
  const scenarios = Array.from({ length: 45 }, (_, i) => ({
    id: 'case' + i,
    protocolId: 'protocol' + Math.floor(i / 3),
    protocolName: i < 3 ? 'HTTP' : 'Giao thức ' + Math.floor(i / 3),
    group: i < 3 ? 'application' : 'security',
    title: i === 1 ? 'Truy cập có bộ nhớ đệm' : 'Kịch bản ' + i,
    summary: 'Dữ liệu mẫu cho bộ chọn',
  }));
  const onSelect = jest.fn(),
    onClose = jest.fn();
  render(
    <ProtocolScenarioPicker
      scenarios={scenarios}
      currentId="case0"
      onSelect={onSelect}
      onClose={onClose}
    />
  );
  const dialog = screen.getByRole('dialog', { name: 'Chọn mô phỏng' });
  expect(within(dialog).getByRole('status')).toHaveTextContent('45 kịch bản · 15 giao thức');
  expect(
    within(within(dialog).getByRole('region', { name: 'Giao thức HTTP' })).getAllByRole('button')
  ).toHaveLength(3);
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Tìm mô phỏng' }), {
    target: { value: 'truy cap co bo nho' },
  });
  expect(within(dialog).getByRole('status')).toHaveTextContent('1 kịch bản');
  fireEvent.click(within(dialog).getByRole('button', { name: /Bảo mật/ }));
  expect(
    within(dialog).getByRole('heading', { name: 'Không tìm thấy mô phỏng' })
  ).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa bộ lọc' }));
  fireEvent.click(within(dialog).getByRole('button', { name: /Truy cập có bộ nhớ đệm/ }));
  expect(onSelect).toHaveBeenCalledWith('case1');
  expect(onClose).toHaveBeenCalledTimes(1);
});
