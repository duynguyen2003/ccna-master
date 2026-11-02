import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import GradingSpecBuilder from './GradingSpecBuilder';

test('editor preserves route policy and serializes dependencies and strict save checks', () => {
  let current;
  function Editor() {
    const [value, setValue] = useState({
      policyVersion: 2,
      passingScore: 100,
      checks: [
        {
          id: 'route',
          title: 'Route EIGRP',
          type: 'route_exists',
          deviceId: 'R1',
          destination: '4.4.4.4',
          protocol: 'D',
          source: 'learned',
          points: 50,
        },
        {
          id: 'save',
          title: 'Lưu cấu hình',
          type: 'startup_config_saved',
          deviceId: 'R1',
          points: 50,
        },
      ],
    });
    current = value;
    return (
      <GradingSpecBuilder
        value={value}
        initialState={{ devices: [{ id: 'R1', interfaces: [] }] }}
        onChange={setValue}
      />
    );
  }
  render(<Editor />);
  fireEvent.click(screen.getAllByText('Điều kiện tiên quyết (0)')[1]);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Lưu cấu hình: cần Route EIGRP' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Bản lưu phải khớp cấu hình hiện tại' }));
  expect(current.policyVersion).toBe(2);
  expect(current.checks[0]).toMatchObject({ protocol: 'D', source: 'learned' });
  expect(current.checks[1]).toMatchObject({ matchesRunning: true, dependsOn: ['route'] });
});

test('hint editor preserves levels and removes the optional field when all hints are cleared', () => {
  let current;
  function Editor() {
    const [value, setValue] = useState({
      checks: [{ id: 'name', type: 'hostname_equals', expected: 'R1', points: 100 }],
    });
    current = value;
    return (
      <GradingSpecBuilder value={value} initialState={{ interfaces: [] }} onChange={setValue} />
    );
  }
  render(<Editor />);
  fireEvent.click(screen.getByText('Gợi ý và phản hồi cho học viên'));
  fireEvent.change(screen.getByLabelText('Gợi ý mức 2'), { target: { value: 'Kiểm tra process' } });
  expect(current.checks[0].hints).toEqual(['', 'Kiểm tra process']);
  fireEvent.change(screen.getByLabelText('Gợi ý mức 1'), { target: { value: 'Cùng AS' } });
  expect(current.checks[0].hints).toEqual(['Cùng AS', 'Kiểm tra process']);
  fireEvent.change(screen.getByLabelText('Gợi ý mức 2'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Gợi ý mức 1'), { target: { value: '' } });
  expect(current.checks[0].hints).toBeUndefined();
});
