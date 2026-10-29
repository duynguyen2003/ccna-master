import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import HeroTerminal from './HeroTerminal';
test('returns static demonstration output and rejects arbitrary commands', () => {
  render(<HeroTerminal />);
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: 'show version' } });
  fireEvent.click(screen.getByRole('button', { name: 'Chạy' }));
  expect(screen.getByRole('log')).toHaveTextContent('NetMaster');
  fireEvent.change(input, { target: { value: 'curl https://example.invalid' } });
  fireEvent.click(screen.getByRole('button', { name: 'Chạy' }));
  expect(screen.getByRole('log')).toHaveTextContent('help');
  fireEvent.change(input, { target: { value: 'constructor' } });
  fireEvent.click(screen.getByRole('button', { name: 'Chạy' }));
  expect(screen.getByRole('log')).not.toHaveTextContent('function Object');
});

test('shows the interface details, supports help and clears the terminal log', () => {
  render(<HeroTerminal />);
  const input = screen.getByRole('textbox', { name: 'Lệnh terminal minh họa' });
  const run = screen.getByRole('button', { name: 'Chạy' });
  const log = screen.getByRole('log', { name: 'Kết quả terminal minh họa' });

  fireEvent.change(input, { target: { value: 'show ip interface brief' } });
  fireEvent.click(run);
  expect(within(log).getByText('192.0.2.1')).toBeInTheDocument();
  expect(within(log).getByText('up')).toBeInTheDocument();
  expect(within(log).getByText('down')).toBeInTheDocument();
  expect(
    within(log).getByRole('group', { name: 'Kết quả show ip interface brief' })
  ).toHaveAttribute('tabindex', '0');
  expect(log).toHaveTextContent('GigabitEthernet0/0');
  expect(input).toHaveFocus();

  fireEvent.change(input, { target: { value: 'help' } });
  fireEvent.click(run);
  expect(log).toHaveTextContent('Lệnh minh họa:');
  fireEvent.change(input, { target: { value: 'clear' } });
  fireEvent.click(run);
  expect(log).toBeEmptyDOMElement();
  expect(input).toHaveValue('');
  expect(input).toHaveFocus();
});
