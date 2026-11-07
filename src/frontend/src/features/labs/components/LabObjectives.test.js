import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import LabObjectives from './LabObjectives';
test('objectives hide points before grading and fold only after their work is complete', async () => {
  const tasks = [
    { id: 'as', title: 'Bật AS', type: 'eigrp_as_configured', points: 10, deviceId: 'R2' },
    { id: 'save', title: 'Lưu R1', type: 'startup_config_saved', points: 10 },
  ];
  const props = {
    tasks,
    selectedTaskId: 'as',
    onSelect: jest.fn(),
    progress: { checks: [] },
    graded: false,
  };
  const view = render(<LabObjectives {...props} />);
  expect(screen.getByRole('group', { name: 'Cấu hình thiết bị' })).toHaveAttribute('open');
  expect(screen.getByLabelText('Thiết bị R2')).toHaveTextContent('R2');
  expect(screen.getAllByLabelText('0 trên 1 nhiệm vụ hoàn thành')).toHaveLength(2);
  expect(screen.queryByText('10 điểm')).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: 'Chọn nhiệm vụ Bật AS' }));
  expect(props.onSelect).toHaveBeenCalledWith(tasks[0]);
  view.rerender(
    <LabObjectives
      {...props}
      graded
      progress={{ checks: [{ id: 'as', status: 'completed', passed: true }] }}
    />
  );
  await waitFor(() =>
    expect(screen.getByRole('group', { name: 'Cấu hình thiết bị' })).not.toHaveAttribute('open')
  );
  fireEvent.click(screen.getByText('Cấu hình thiết bị'));
  expect(
    within(screen.getByRole('group', { name: 'Cấu hình thiết bị' })).getByText('10 điểm')
  ).toBeInTheDocument();
});

test('first unfinished group opens while completed groups stay folded', () => {
  render(
    <LabObjectives
      tasks={[
        { id: 'as', title: 'Bật AS', type: 'eigrp_as_configured' },
        { id: 'route', title: 'Kiểm tra route', type: 'route_exists', deviceId: 'R1' },
      ]}
      progress={{ checks: [{ id: 'as', status: 'completed' }] }}
      onSelect={jest.fn()}
    />
  );
  expect(screen.getByRole('group', { name: 'Cấu hình thiết bị' })).not.toHaveAttribute('open');
  expect(screen.getByRole('group', { name: 'Kiểm tra kết nối và định tuyến' })).toHaveAttribute(
    'open'
  );
});
