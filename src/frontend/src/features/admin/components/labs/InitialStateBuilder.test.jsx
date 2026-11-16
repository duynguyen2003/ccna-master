import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import InitialStateBuilder from './InitialStateBuilder';
import { validateInitialState } from '../../utils/adminLabConfig';

test('editing a single device does not save its synthetic selection ID', () => {
  const onChange = jest.fn();
  render(
    <InitialStateBuilder
      value={{ deviceType: 'ROUTER', hostname: 'Router', interfaces: ['GigabitEthernet0/0'] }}
      onChange={onChange}
    />
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Hostname' }), { target: { value: 'R1' } });
  const result = onChange.mock.calls[0][0];
  expect(result.hostname).toBe('R1');
  expect(result).not.toHaveProperty('id');
  expect(validateInitialState(result)).toEqual([]);
});

test('adding a topology device preserves simulator and topology metadata', () => {
  const onChange = jest.fn();
  render(
    <InitialStateBuilder
      value={{
        simulatorVersion: '3.0.0',
        devices: [
          { id: 'R1', deviceType: 'ROUTER', hostname: 'R1', interfaces: ['GigabitEthernet0/0'] },
        ],
        links: [],
      }}
      onChange={onChange}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Thêm thiết bị' }));
  expect(onChange.mock.calls[0][0].simulatorVersion).toBe('3.0.0');
  expect(onChange.mock.calls[0][0].devices).toHaveLength(2);
});
