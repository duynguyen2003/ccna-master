import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LabAccessPolicyEditor from './LabAccessPolicyEditor';
const modules = [
  {
    id: 'm1',
    title: 'Cơ bản',
    lessons: [
      { id: 1, title: 'Địa chỉ IPv4' },
      { id: 2, title: 'Kết nối mạng' },
    ],
  },
];
test('selects prerequisite lessons with labels and search without altering publication state', () => {
  const change = jest.fn();
  render(
    <LabAccessPolicyEditor
      value={{ mode: 'LESSONS', lessonIds: [], requiredForCompletion: true }}
      onChange={change}
      courseId="c1"
      modules={modules}
    />
  );
  fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm bài tiên quyết' }), {
    target: { value: 'IPv4' },
  });
  expect(screen.queryByRole('checkbox', { name: /Kết nối mạng/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: /Địa chỉ IPv4/ }));
  expect(change).toHaveBeenCalledWith({
    mode: 'LESSONS',
    lessonIds: [1],
    requiredForCompletion: true,
  });
});
test('keeps legacy rules until explicitly choosing a mode; errors can be retried', () => {
  const change = jest.fn();
  const retry = jest.fn();
  const view = render(
    <LabAccessPolicyEditor value={null} onChange={change} courseId="c1" modules={[]} />
  );
  expect(screen.getByRole('combobox', { name: 'Điều kiện mở lab' })).toHaveTextContent(
    'Theo lộ trình hiện tại'
  );
  expect(change).not.toHaveBeenCalled();
  view.rerender(
    <LabAccessPolicyEditor
      value={{ mode: 'LESSONS', lessonIds: [], requiredForCompletion: true }}
      onChange={change}
      courseId="c1"
      modules={[]}
      error="Không tải được"
      onRetry={retry}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(retry).toHaveBeenCalledTimes(1);
});
